import type {ChannelHandler} from '@/network/core/ChannelHandler';
import type {ChannelHandlerContext} from '@/network/core/ChannelHandlerContext';
import type {
    RpcNotification,
    RpcRequest,
    RpcResponse,
} from '@/rpc/protocol/RpcProtocol';
import {ResultApiException} from "@mellifera/common/CustomException";
import {SYSTEM_ERROR} from "@mellifera/common/ResultCode";

type RpcMethodHandler = (request: any) => Promise<unknown>;
type ControllerClass = new () => object;

type ControllerModules = Record<string, ControllerClass>;
export class ServerCommandDispatcher implements ChannelHandler {

    private readonly map = new Map<string, RpcMethodHandler>();

    constructor(controllers: ControllerModules) {
        this.registerControllers(controllers);
    }

    private registerControllers(controllers: ControllerModules): void {
        for (const [name, Controller] of Object.entries(controllers)) {
            const instance = new Controller();

            const prototype = Object.getPrototypeOf(instance);

            for (const method of Object.getOwnPropertyNames(prototype)) {
                if (method === 'constructor') {
                    continue;
                }

                const handler = (instance as any)[method];

                if (typeof handler !== 'function') {
                    continue;
                }

                const key = [
                    name.replace(/Controller$/, '').replace(/^[A-Z]/, c => c.toLowerCase()),
                    method,
                ].join('.');

                this.map.set(key, handler.bind(instance));
            }
        }
    }

    register(method: string, handler: RpcMethodHandler): void {
        this.map.set(method, handler);
    }

    async dispatch(method: string, request: any): Promise<unknown> {
        const handler = this.map.get(method);

        if (!handler) {
            throw new Error(`Method not found: ${method}`);
        }

        return handler(request);
    }

    async channelRead(
        ctx: ChannelHandlerContext,
        message: RpcRequest | RpcNotification,
    ): Promise<void> {
        // JSON-RPC Notification 不需要响应
        const isNotification = !('id' in message);
        try {
            const result = await this.dispatch(message.method, {
                ...message.params,
                clientId: ctx.channel.getContext().clientId
            });
            if (isNotification) {
                return;
            }
            const response: RpcResponse = {
                jsonrpc: '2.0',
                id: message.id,
                result,
            };

            await ctx.write(response);
        } catch (error) {
            if (isNotification) {
                return;
            }
            const response: RpcResponse = {
                jsonrpc: '2.0',
                id: message.id,
                error: (error instanceof ResultApiException ? {...error.code} : {
                    ...SYSTEM_ERROR,
                    other: error instanceof Error ? error.message : error + ''
                }),
            };

            await ctx.write(response);
        }
    }
}