import {
    listen,
    type QuicEndpoint,
    type QuicSession,
    type QuicStream,
} from 'node:quic';

import {createPrivateKey} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {app} from 'electron';

import {connectionType, type ConnectionTypeType, runState, type RunStateType} from '@mellifera/common/constant';

import type {ConnectionDispatcher} from './ConnectionDispatcher';
import type {AuthRequest, ConnectionContext} from './ConnectionHandler';

export interface QuicServerOptions {
    hosts: readonly string[];
    port: number;
    key?: string | Buffer;
    cert?: string | Buffer;
    alpn?: string;
}

interface AuthFrameResult {
    auth: AuthRequest;
    initialData: Uint8Array;
}

const CertificatePath = {
    get certificate(): string {
        return app.isPackaged
            ? path.join(process.resourcesPath, 'public/certs/server.cert')
            : path.join(process.cwd(), 'public/certs/server.cert');
    },

    get privateKey(): string {
        return app.isPackaged
            ? path.join(process.resourcesPath, 'public/certs/server.key')
            : path.join(process.cwd(), 'public/certs/server.key');
    },
};

const MAX_AUTH_FRAME_SIZE = 4096;

export class QuicServer {

    private endpoint?: QuicEndpoint;

    private readonly sessions = new Set<QuicSession>();

    private readonly pendingTasks = new Set<Promise<void>>();

    private state: RunStateType = runState.idle.value;

    private startPromise?: Promise<void>;

    private stopPromise?: Promise<void>;
    private readonly options: QuicServerOptions
    private readonly dispatcher: ConnectionDispatcher

    constructor(
        options: QuicServerOptions,
        dispatcher: ConnectionDispatcher,
    ) {
        this.dispatcher = dispatcher;
        this.options = options;
    }

    /**
     * 启动 QUIC 服务
     */
    start(): Promise<void> {
        if (this.state === runState.running.value) {
            return Promise.resolve();
        }

        if (this.state === runState.starting.value) {
            return this.startPromise!;
        }

        if (this.state === runState.stopping.value) {
            return Promise.reject(new Error('QuicServer is stopping'));
        }

        this.state = runState.starting.value;

        this.startPromise = this.startInternal()
            .then(() => {
                this.state = runState.running.value;
            })
            .catch(async error => {
                await this.closeEndpoint();
                this.destroySessions();
                this.state = runState.idle.value;
                throw error;
            })
            .finally(() => {
                this.startPromise = undefined;
            });

        return this.startPromise;
    }

    private async startInternal(): Promise<void> {
        const {hosts, port} = this.options;

        if (!hosts.length) {
            throw new Error('At least one listen host is required');
        }

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('Invalid listen port');
        }

        const {cert, key} = await this.loadCertificates();

        const addresses = [...new Set(hosts)]
            .map(host => this.formatEndpointAddress(host, port));

        if (addresses.length !== 1) {
            throw new Error(
                'This implementation creates one QUIC Endpoint; configure exactly one listen address',
            );
        }

        this.endpoint = await listen(
            session => this.handleSession(session),
            {
                endpoint: {
                    address: addresses[0],
                },
                keys: createPrivateKey(key),
                certs: cert,
                alpn: this.options.alpn ?? 'mellifera/1',
            },
        );
    }

    /**
     * 加载证书
     */
    private async loadCertificates(): Promise<{
        cert: Buffer;
        key: string | Buffer;
    }> {
        const [cert, key] = await Promise.all([
            this.options.cert
                ? Promise.resolve(this.options.cert)
                : readFile(CertificatePath.certificate),

            this.options.key
                ? Promise.resolve(this.options.key)
                : readFile(CertificatePath.privateKey),
        ]);

        return {
            cert: Buffer.isBuffer(cert) ? cert : Buffer.from(cert),
            key,
        };
    }

    /**
     * 格式化监听地址
     */
    private formatEndpointAddress(host: string, port: number): string {
        if (host.includes(':') && !host.startsWith('[')) {
            return `[${host}]:${port}`;
        }

        return `${host}:${port}`;
    }

    /**
     * 接收 QUIC Session
     */
    private handleSession(session: QuicSession): void {
        if (this.state !== runState.running.value) {
            session.destroy();
            return;
        }

        this.sessions.add(session);

        let initialized = false;

        session.closed
            .catch(() => undefined)
            .finally(() => {
                this.sessions.delete(session);
            });

        /**
         * 第一个双向 Stream 用于连接认证。
         *
         * 后续 Stream 的管理交给对应的 ConnectionHandler。
         */
        session.onstream = stream => {
            if (initialized || session.destroyed) {
                stream.destroy();
                return;
            }

            if (stream.direction !== 'bidi') {
                stream.destroy();
                return;
            }

            initialized = true;

            this.trackTask(
                this.initializeConnection(session, stream),
            );
        };
    }

    /**
     * 读取认证信息并分发连接
     */
    private async initializeConnection(
        session: QuicSession,
        stream: QuicStream,
    ): Promise<void> {
        try {
            const result = await this.readAuthRequest(stream);

            if (
                session.destroyed ||
                stream.destroyed ||
                this.state !== runState.running.value
            ) {
                return;
            }

            const context: ConnectionContext = {
                session,
                stream,
                auth: result.auth,
                initialData: result.initialData,
            };

            await this.dispatcher.dispatch(context);

        } catch (error) {
            stream.destroy();

            if (!session.destroyed) {
                session.destroy();
            }

            this.reportError(error);
        }
    }

    /**
     * 读取认证帧
     *
     * 格式：
     * {"type":"control","token":"xxx"}\n
     */
    private async readAuthRequest(
        stream: QuicStream,
    ): Promise<AuthFrameResult> {
        const reader = stream.readable.getReader();

        const chunks: Uint8Array[] = [];

        let totalLength = 0;

        try {
            while (true) {
                const {value, done} = await reader.read();

                if (done) {
                    throw new Error('Stream closed before authentication');
                }

                if (!value?.length) {
                    continue;
                }

                const newlineIndex = value.indexOf(0x0a);

                if (newlineIndex !== -1) {
                    const frameChunk = value.subarray(0, newlineIndex);

                    if (
                        totalLength + frameChunk.length >
                        MAX_AUTH_FRAME_SIZE
                    ) {
                        throw new Error('Authentication frame is too large');
                    }

                    chunks.push(frameChunk);

                    const frame = this.concatChunks(chunks);

                    return {
                        auth: this.parseAuthRequest(frame),
                        initialData: value.slice(newlineIndex + 1),
                    };
                }

                totalLength += value.length;

                if (totalLength > MAX_AUTH_FRAME_SIZE) {
                    throw new Error('Authentication frame is too large');
                }

                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * 解析认证帧
     */
    private parseAuthRequest(data: Uint8Array): AuthRequest {
        const text = new TextDecoder('utf-8', {
            fatal: true,
        }).decode(data).trim();

        let value: unknown;

        try {
            value = JSON.parse(text);
        } catch {
            throw new Error('Invalid authentication JSON');
        }

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('Invalid authentication request');
        }

        const auth = value as Record<string, unknown>;

        const validType =
            auth.type === connectionType.controller.value ||
            auth.type === connectionType.data.value;

        if (!validType) {
            throw new Error('Invalid connection type');
        }

        if (typeof auth.token !== 'string' || !auth.token.trim()) {
            throw new Error('Invalid authentication token');
        }

        return {
            type: auth.type as ConnectionTypeType,
            token: auth.token,
        };
    }

    /**
     * 合并数据块
     */
    private concatChunks(chunks: Uint8Array[]): Uint8Array {
        const length = chunks.reduce(
            (total, chunk) => total + chunk.length,
            0,
        );

        const result = new Uint8Array(length);

        let offset = 0;

        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }

    /**
     * 跟踪异步初始化任务
     */
    private trackTask(task: Promise<void>): void {
        this.pendingTasks.add(task);

        task.finally(() => {
            this.pendingTasks.delete(task);
        }).catch(error => {
            this.reportError(error);
        });
    }

    /**
     * 停止服务
     */
    stop(): Promise<void> {
        if (this.state === runState.idle.value) {
            return Promise.resolve();
        }

        if (this.state === runState.stopping.value) {
            return this.stopPromise!;
        }

        this.state = runState.stopping.value;

        this.stopPromise = this.stopInternal()
            .finally(() => {
                this.state = runState.idle.value;
                this.stopPromise = undefined;
            });

        return this.stopPromise;
    }

    private async stopInternal(): Promise<void> {
        /**
         * 等待正在执行的启动流程
         */
        if (this.startPromise) {
            await this.startPromise.catch(() => undefined);
        }

        /**
         * 关闭所有 Session
         */
        this.destroySessions();

        /**
         * 等待初始化任务结束
         */
        await Promise.allSettled([...this.pendingTasks]);

        /**
         * 关闭 Endpoint
         */
        await this.closeEndpoint();
    }

    private destroySessions(): void {
        for (const session of this.sessions) {
            session.destroy();
        }

        this.sessions.clear();
    }

    private async closeEndpoint(): Promise<void> {
        const endpoint = this.endpoint;

        this.endpoint = undefined;

        if (endpoint) {
            await endpoint.close().catch(() => undefined);
        }
    }

    private reportError(error: unknown): void {
        // TODO: 接入项目统一日志系统
        error
    }

    get isRunning(): boolean {
        return this.state === runState.running.value;
    }

    get sessionCount(): number {
        return this.sessions.size;
    }
}