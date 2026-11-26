import {
    CMD, type ControllerClass, parseControllers,
    type ProtocolFrame, type RpcMethodMetadata,
    type RpcMethodOptions
} from "@/utils/network";
import type {Constructor} from "@/network/client/TcpAndUdpBootstrap";
import type {NetworkContext} from "@/types/network";
import type {Result} from "@mellifera/common/Result";

/**
 * RPC 方法执行器
 */
export type RpcHandler<P = any, R = any> = (
    params: P
) => R | Promise<R>;

/**
 * RPC 响应结构
 */
export type RpcResponse<T = any> =
    | {
    success: true;
    data: T;
}
    | {
    success: false;
    error: {
        code: number;
        message: string;
    };
};

/**
 * RPC 发送器
 *
 * 可以接入：
 * TCP: socket.write(...)
 * QUIC: stream.write(...)
 */
export type RpcSender = (
    frame: ProtocolFrame
) => void | Promise<void>;

/**
 * Payload 编解码器
 *
 * 这里直接接入你之前实现的 encodePayload/decodePayload。
 */
export interface RpcCodec {
    encode(value: any): Buffer;

    decode<T = any>(buffer: Buffer): T;
}

/**
 * Pending 请求
 */
interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
}

/**
 * 已注册的本地方法
 */
interface RegisteredMethod {
    metadata: RpcMethodOptions;
    handler: RpcHandler;
}

/**
 * RPC 错误
 */
export class RpcError extends Error {
    public readonly code: number

    constructor(
        code: number,
        message: string
    ) {
        super(message);
        this.code = code;
        this.name = 'RpcError';
    }
}

/**
 * RPC Dispatcher
 *
 * 负责：
 * 1. 注册本地 Controller 方法
 * 2. 发送 RPC 请求
 * 3. 接收 RPC 请求
 * 4. 接收 RPC 响应
 * 5. 匹配并发请求
 * 6. 请求超时
 * 7. 连接断开时清理 Pending
 */
export class RpcDispatcher {

    private readonly methods = new Map<string, RegisteredMethod>();

    private readonly pending = new Map<number, PendingRequest>();

    private seq = 0;

    private destroyed = false;

    private readonly defaultTimeout: number;
    private readonly send: RpcSender
    private readonly codec: RpcCodec

    constructor(
        send: RpcSender,
        codec: RpcCodec,
        options?: {
            timeout?: number;
            onError?: (error: unknown) => void;
        }
    ) {
        this.send = send;
        this.codec = codec;
        this.defaultTimeout = options?.timeout ?? 15000;
        this.onError = options?.onError ?? (() => {
        });
    }

    private readonly onError: (error: unknown) => void;

    /**
     * 注册本地方法
     */
    register(
        path: string,
        metadata: RpcMethodOptions,
        handler: RpcHandler
    ): void {
        this.assertAvailable();

        if (!path) {
            throw new Error('RPC path cannot be empty');
        }

        if (this.methods.has(path)) {
            throw new Error(`RPC method already registered: ${path}`);
        }

        this.methods.set(path, {
            metadata: {...metadata},
            handler,
        });
    }

    /**
     * 批量注册
     */
    registerAll(
        methods: Array<{
            path: string;
            metadata: RpcMethodOptions;
            handler: RpcHandler;
        }>
    ): void {
        for (const method of methods) {
            this.register(
                method.path,
                method.metadata,
                method.handler
            );
        }
    }

    /**
     * 注销方法
     */
    unregister(path: string): boolean {
        return this.methods.delete(path);
    }

    unregisterAll() {
        this.methods.clear();
    }

    /**
     * 代理调用入口
     *
     * ack=true:
     *   返回 Promise，等待远端响应
     *
     * ack=false:
     *   返回 void，不等待远端响应
     */
    invoke<T = any>(
        path: string,
        params: any,
        ack?: boolean,
        timeout?: number
    ): Promise<T> | void {
        this.assertAvailable();

        if (ack !== false) {
            return this.request<T>(path, params, timeout);
        }

        this.notify(path, params);
    }

    /**
     * 发送一个需要响应的请求
     */
    request<T = any>(
        path: string,
        params?: any,
        timeout = this.defaultTimeout
    ): Promise<T> {
        this.assertAvailable();

        const seq = this.nextSeq();

        const frame: ProtocolFrame = {
            cmd: CMD.request,
            seq,
            path,
            payload: this.codec.encode(params),
        };

        return new Promise<T>((resolve, reject) => {

            const pending: PendingRequest = {
                resolve,
                reject,
            };

            /**
             * 先注册 Pending，再发送数据。
             * 避免对端响应过快导致找不到 Pending。
             */
            this.pending.set(seq, pending);

            /**
             * timeout:
             * 0  = 使用默认超时
             * >0 = 指定超时
             * <0 = 无限等待
             */
            const actualTimeout = timeout === 0
                ? this.defaultTimeout
                : timeout;

            if (actualTimeout > 0) {
                pending.timer = setTimeout(() => {
                    this.rejectPending(
                        seq,
                        new RpcError(
                            408,
                            `RPC request timeout: ${path}`
                        )
                    );
                }, actualTimeout);
            }

            try {
                const result = this.send(frame);

                if (result instanceof Promise) {
                    result.catch(error => {
                        this.rejectPending(
                            seq,
                            this.toError(error)
                        );
                    });
                }
            } catch (error) {
                this.rejectPending(
                    seq,
                    this.toError(error)
                );
            }
        });
    }

    /**
     * 发送一个不需要响应的请求
     *
     * 注意：
     * 不等待远端执行结果。
     * 但本地发送失败仍然会通过 onError 报告。
     */
    notify(
        path: string,
        params?: any
    ): void {
        this.assertAvailable();

        const frame: ProtocolFrame = {
            cmd: CMD.request,
            seq: this.nextSeq(),
            path,
            payload: this.codec.encode(params),
        };

        try {
            const result = this.send(frame);

            if (result instanceof Promise) {
                result.catch(error => {
                    this.onError(error);
                });
            }
        } catch (error) {
            this.onError(error);
        }
    }

    /**
     * 接收一帧完整 RPC 数据
     *
     * 注意：
     * TCP 解帧完成后再调用此方法。
     */
    async dispatch(frame: ProtocolFrame, sender?: RpcSender): Promise<void> {
        if (this.destroyed) {
            return;
        }

        switch (frame.cmd) {

            case CMD.request:
                await this.handleRequest(frame, sender);
                break;

            case CMD.response:
                this.handleResponse(frame);
                break;

            default:
                this.onError(
                    new RpcError(
                        400,
                        `Unknown RPC command: ${frame.cmd}`
                    )
                );
        }
    }

    /**
     * 处理远端请求
     */
    private async handleRequest(frame: ProtocolFrame, sender?: RpcSender): Promise<void> {
        const entry = this.methods.get(frame.path);
        /**
         * 未知方法：
         * 无法知道对端是否期待响应。
         *
         * 这里统一发送错误 RESPONSE。
         * ack=false 的调用方没有 Pending，会直接忽略该响应。
         */
        if (!entry) {
            await this.sendResponse(frame, {
                success: false,
                error: {
                    code: 404,
                    message: `RPC method not found: ${frame.path}`,
                },
            }, sender);

            return;
        }

        const {metadata, handler} = entry;

        /**
         * 禁用的方法不执行。
         */
        if (metadata.disabled) {

            if (metadata.ack) {
                await this.sendResponse(frame, {
                    success: false,
                    error: {
                        code: 403,
                        message: `RPC method disabled: ${frame.path}`,
                    },
                }, sender);
            }

            return;
        }

        try {
            /**
             * 解码参数
             */
            const params = this.codec.decode(frame.payload);

            /**
             * 执行 Controller 方法
             */
            const result = await handler(params);

            /**
             * ack=true 才返回执行结果
             */
            if (metadata.ack) {
                await this.sendResponse(frame, {
                    success: true,
                    data: result,
                }, sender);
            }

        } catch (error) {

            /**
             * ack=true：
             * 返回错误给调用方。
             *
             * ack=false：
             * 不返回响应，只记录错误。
             */
            if (metadata.ack) {
                await this.sendResponse(frame, {
                    success: false,
                    error: {
                        code: 500,
                        message: this.getErrorMessage(error),
                    },
                }, sender);
            } else {
                this.onError(error);
            }
        }
    }

    /**
     * 发送 RPC 响应
     */
    private async sendResponse(
        request: ProtocolFrame,
        response: RpcResponse,
        sender?: RpcSender,
    ): Promise<void> {

        const frame: ProtocolFrame = {
            cmd: CMD.response,
            seq: request.seq,
            path: request.path,
            payload: this.codec.encode(response),
        };

        await (sender ?? this.send)(frame);
    }

    /**
     * 处理 RPC 响应
     */
    private handleResponse(frame: ProtocolFrame): void {
        const pending = this.pending.get(frame.seq);

        /**
         * 可能是：
         * 1. ack=false 请求产生的未知方法错误响应
         * 2. 已超时请求的迟到响应
         * 3. 已取消或已清理请求的响应
         */
        if (!pending) {
            return;
        }

        let response: RpcResponse;

        try {
            response = this.codec.decode<RpcResponse>(frame.payload);
        } catch (error) {
            this.rejectPending(
                frame.seq,
                this.toError(error)
            );
            return;
        }

        if (!response || typeof response.success !== 'boolean') {
            this.rejectPending(
                frame.seq,
                new RpcError(400, 'Invalid RPC response')
            );
            return;
        }

        if (!response.success) {
            this.rejectPending(
                frame.seq,
                new RpcError(
                    response.error?.code ?? 500,
                    response.error?.message ?? 'Remote RPC error'
                )
            );
            return;
        }

        const result = response.data;

        // 处理业务 Result
        if (
            result !== null &&
            typeof result === 'object' &&
            typeof result.code === 'number' &&
            typeof result.message === 'string'
        ) {
            if (result.code !== 200) {
                this.rejectPending(
                    frame.seq,
                    new RpcError(
                        result.code,
                        result.message
                    )
                );
                return;
            }

            this.resolvePending(
                frame.seq,
                result.data
            );
            return;
        }

        // 普通 RPC 返回值
        this.resolvePending(
            frame.seq,
            result
        );
    }

    /**
     * 成功完成 Pending
     */
    private resolvePending(
        seq: number,
        value: any
    ): void {
        const pending = this.pending.get(seq);

        if (!pending) {
            return;
        }

        this.pending.delete(seq);

        if (pending.timer) {
            clearTimeout(pending.timer);
        }

        pending.resolve(value);
    }

    /**
     * 失败完成 Pending
     */
    private rejectPending(
        seq: number,
        error: Error
    ): void {
        const pending = this.pending.get(seq);

        if (!pending) {
            return;
        }

        this.pending.delete(seq);

        if (pending.timer) {
            clearTimeout(pending.timer);
        }

        pending.reject(error);
    }

    /**
     * 生成不冲突的 uint32 seq
     */
    private nextSeq(): number {

        for (let i = 0; i <= 0xffffffff; i++) {

            this.seq = (this.seq + 1) >>> 0;

            if (!this.pending.has(this.seq)) {
                return this.seq;
            }
        }

        throw new RpcError(
            429,
            'RPC sequence space exhausted'
        );
    }

    /**
     * 连接关闭时调用
     *
     * 拒绝所有尚未完成的请求。
     */
    destroy(
        reason: Error = new RpcError(
            503,
            'RPC connection closed'
        )
    ): void {

        if (this.destroyed) {
            return;
        }

        this.destroyed = true;

        for (const [seq] of this.pending) {
            this.rejectPending(seq, reason);
        }

        this.pending.clear();
        this.methods.clear();
    }

    /**
     * 当前等待中的请求数
     */
    get pendingCount(): number {
        return this.pending.size;
    }

    /**
     * 当前注册的方法数
     */
    get methodCount(): number {
        return this.methods.size;
    }

    private assertAvailable(): void {
        if (this.destroyed) {
            throw new RpcError(
                503,
                'RPC dispatcher has been destroyed'
            );
        }
    }

    private toError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }

        return new Error(String(error));
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }
}

type RpcMethodFn<F, Ack extends boolean = true> =
    F extends (...args: infer A) => infer R
        ? Ack extends true
            ? (...args: A) => Promise<Awaited<R>>
            : (...args: A) => void
        : never;

type RpcMethods<T> = {
    [K in keyof T as T[K] extends (...args: any[]) => any
        ? K extends 'constructor'
            ? never
            : K
        : never]: RpcMethodFn<T[K]>;
};

export type RpcProxy<T extends readonly Constructor[]> = {
    [C in T[number] as C extends ControllerClass<Constructor, infer N extends PropertyKey>
        ? N
        : never]: RpcMethods<InstanceType<C>>;
};

export function createRpcProxy<const T extends readonly Constructor[]>(
    controllers: T,
    context: NetworkContext
): RpcProxy<T> {
    const proxy: Record<string, any> = {};

    parseControllers(controllers, context).forEach((definition) => {
        const {name: path, metadata} = definition;

        const names = path.split('.');

        if (names.length < 2 || names.some(name => !name)) {
            throw new Error(`Invalid RPC path: ${path}`);
        }

        let current = proxy;

        // 创建控制器层级
        for (const name of names.slice(0, -1)) {
            if (!Object.prototype.hasOwnProperty.call(current, name)) {
                current[name] = {};
            } else if (
                typeof current[name] !== 'object' ||
                current[name] === null
            ) {
                throw new Error(`RPC path conflict: ${path}`);
            }

            current = current[name];
        }

        const methodName = names[names.length - 1];

        if (Object.prototype.hasOwnProperty.call(current, methodName)) {
            throw new Error(`Duplicate RPC proxy method: ${path}`);
        }

        const ack = metadata.ack;

        current[methodName] = (...args: any[]) => {
            const params = args.length <= 1 ? args[0] : args;

            if (!ack) {
                void context.dispatcher.invoke(path, params, false);
                return;
            }

            return context.dispatcher.invoke(path, params, true);
        };
    });

    return proxy as RpcProxy<T>;
}

export function getOrCreateRpcProxy<const T extends readonly Constructor[]>(
    controllers: T,
    context: NetworkContext
): RpcProxy<T> {
    const key = controllers.map(item => {
        return item.name
    }).join(",");
    const rpc = context.rpcMap.get(key);
    if (rpc) {
        return rpc as RpcProxy<T>;
    }
    context.rpcMap.set(key, createRpcProxy(controllers, context));
    return context.rpcMap.get(key)! as RpcProxy<T>;
}

interface RpcMethodEntry {
    handler: (params?: unknown) => Promise<Result<unknown> | undefined>;
    metadata: RpcMethodMetadata;
}

// ============================================================
// TCP And UDP Server Bootstrap
// ============================================================
export function registerControllers(controllerList: Constructor[], context: NetworkContext, clear = false): void {
    if (clear) {
        context.dispatcher.unregisterAll()
    }
    parseControllers(controllerList, context).forEach((value, path) => {
        const metadata = value.metadata as RpcMethodMetadata;
        const handler: RpcMethodEntry['handler'] = async params => {
            if (metadata.disabled) {
                return {
                    code: 403,
                    message: '方法已被禁用，禁止访问！',
                };
            }
            try {
                return {
                    code: 200,
                    message: '成功',
                    data: await value.handler(params),
                };
            } catch (error) {
                return {
                    code: 400,
                    message: error instanceof Error
                        ? error.message
                        : String(error),
                };
            }
        };
        context.dispatcher.register(path, metadata, handler);
    });
}