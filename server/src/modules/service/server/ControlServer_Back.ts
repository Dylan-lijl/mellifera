import {RpcPeer} from "@/rpc/peer/RpcPeer"
import type {RpcServerContext} from "@/rpc/type"
import {createServer, type IncomingMessage, type Server as HttpServer,} from 'node:http'
import WebSocket, {WebSocketServer,} from 'ws'
import {RpcRouter} from "@/rpc/router/RpcRouter";
import {WebSocketTransport} from "@/rpc/transport/WebSocketTransport";
import type {Duplex} from "node:stream";
import {registerLocalControllers} from "@/rpc/client/RpcClientFactory";
import StateSyncManager from "@/StateSyncManager";

/**
 * create 方法的返回值。
 *
 * key：连接管理使用的唯一标识。
 * context：绑定到 RpcPeer 的上下文。
 */
export interface CreateResult {
    key: any
    context: RpcServerContext
}

/**
 * 创建客户端连接上下文。
 *
 * 返回 null 表示认证失败。
 */
export type Creator = (
    request: IncomingMessage,
) => Promise<CreateResult | null>

/**
 * 监听配置。
 */
export interface ControlServerOptions {
    readonly hosts: readonly string[]
    readonly port: number
}

/**
 * ControlServer。
 *
 * 一个 key 同一时间只对应一个有效的 RpcPeer。
 */
export class ControlServer {
    /**
     * 唯一的连接管理 Map。
     *
     * key -> RpcPeer
     */
    private readonly clients = new Map<
        number,
        RpcPeer<RpcServerContext>
    >()

    /**
     * HTTP / WebSocket 监听器。
     */
    private readonly listeners: Array<{
        server: HttpServer
        wsServer: WebSocketServer
        started: boolean
    }> = []

    /**
     * 正在初始化的连接。
     */
    private readonly pendingPeers = new Set<Promise<void>>()

    private started = false
    private stopping = false

    private startPromise?: Promise<void>
    private stopPromise?: Promise<void>
    private readonly creator: Creator;

    constructor(creator: Creator) {
        this.creator = creator;
    }

    /**
     * 启动监听。
     */
    async start(options: ControlServerOptions): Promise<void> {
        if (this.started) {
            throw new Error('ControlServer 已启动')
        }

        if (this.stopping) {
            throw new Error('ControlServer 正在停止')
        }

        if (this.startPromise) {
            return this.startPromise
        }

        this.startPromise = this.startInternal(options)

        try {
            await this.startPromise
        } finally {
            this.startPromise = undefined
        }
    }

    private async startInternal(
        options: ControlServerOptions,
    ): Promise<void> {
        const {hosts, port} = options

        if (hosts.length === 0) {
            throw new Error('至少需要配置一个监听地址')
        }

        if (!Number.isInteger(port) || port < 0 || port > 65535) {
            throw new Error('监听端口无效')
        }

        const uniqueHosts = [...new Set(hosts)]
        const startedListeners: typeof this.listeners = []

        try {
            for (const host of uniqueHosts) {
                const server = createServer()

                const wsServer = new WebSocketServer({
                    noServer: true,
                    maxPayload: 1024 * 1024,
                })

                const listener = {
                    server,
                    wsServer,
                    started: false,
                }

                server.on('upgrade', (request, socket, head) => {
                    void this.handleUpgrade(
                        listener,
                        request,
                        socket,
                        head,
                    )
                })

                server.on('error', error => {
                    this.reportError(error)
                })

                wsServer.on('error', error => {
                    this.reportError(error)
                })

                this.listeners.push(listener)

                await this.listen(server, host, port)

                listener.started = true
                startedListeners.push(listener)
            }

            this.started = true
        } catch (error) {
            await Promise.allSettled(
                startedListeners.map(listener =>
                    this.closeListener(listener),
                ),
            )

            this.listeners.length = 0

            throw error
        }
    }

    private listen(
        server: HttpServer,
        host: string,
        port: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const onError = (error: Error) => {
                server.off('listening', onListening)
                reject(error)
            }

            const onListening = () => {
                server.off('error', onError)
                resolve()
            }

            server.once('error', onError)
            server.once('listening', onListening)
            server.listen(port, host)
        })
    }

    /**
     * 处理 WebSocket 握手。
     *
     * create 负责认证并返回 key 和 context。
     */
    private async handleUpgrade(
        listener: {
            server: HttpServer
            wsServer: WebSocketServer
            started: boolean
        },
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer,
    ): Promise<void> {
        if (this.stopping) {
            this.rejectUpgrade(socket, 503, 'Service Unavailable')
            return
        }

        let result;

        try {
            result = await this.creator(request)
        } catch (error) {
            this.reportError(error)
            this.rejectUpgrade(socket, 500, 'Internal Server Error')
            return
        }

        if (!result) {
            this.rejectUpgrade(socket, 401, 'Unauthorized')
            return
        }

        if (this.stopping || socket.destroyed) {
            socket.destroy()
            return
        }

        listener.wsServer.handleUpgrade(
            request,
            socket,
            head,
            ws => {
                this.trackPeerInitialization(
                    this.attachClient(
                        ws,
                        result.key,
                        result.context,
                    ),
                )
            },
        )
    }

    /**
     * 将 WebSocket 转换为 RpcPeer 并注册。
     *
     * 这里使用项目现有的 RpcPeer 创建方式，
     * context 必须绑定到 Peer。
     */
    private async attachClient(
        socket: WebSocket,
        key: any,
        context: RpcServerContext,
    ): Promise<void> {
        let peer: RpcPeer<RpcServerContext> | undefined
        try {
            peer = await this.createPeer(socket, context)
            if (this.stopping || socket.readyState !== WebSocket.OPEN) {
                await this.closePeer(peer)
                return
            }
            const previous = this.clients.get(key)
            /*
             * 新 Peer 先注册。
             */
            this.clients.set(key, peer)

            /*
             * 新连接替换旧连接。
             */
            if (previous && previous !== peer) {
                await this.closePeer(previous)
            }

            /*
             * 旧连接的关闭事件不能删除新连接。
             */
            socket.once('close', () => {
                if (this.clients.get(key) === peer) {
                    this.clients.delete(key)
                    const clientId = peer?.getContext()?.clientId;
                    if (clientId) {
                        StateSyncManager.getState().server.connected = StateSyncManager.getState().server.connected.filter((item:number) => item !== clientId)
                    }
                }
            })

            socket.once('error', error => {
                this.reportError(error)
            })
        } catch (error) {
            this.reportError(error)

            if (peer) {
                await this.closePeerSafely(peer)
            } else if (socket.readyState !== WebSocket.CLOSED) {
                socket.terminate()
            }
        }
    }

    /**
     * 创建 RpcPeer。
     *
     * 请将此方法体替换为你项目现有的 RpcPeer 初始化逻辑。
     */
    private createPeer(
        socket: WebSocket,
        context: RpcServerContext,
    ): Promise<RpcPeer<RpcServerContext>> | RpcPeer<RpcServerContext> {
        const router = new RpcRouter<RpcServerContext>()
        registerLocalControllers("server", router)
        return new RpcPeer(new WebSocketTransport(socket), router, {context});
    }

    /**
     * 关闭 RpcPeer。
     *
     * 请替换为项目中现有的 Peer 关闭方法。
     */
    private async closePeer(
        peer: RpcPeer<RpcServerContext>,
    ): Promise<void> {
        peer.close()
    }

    private async closePeerSafely(
        peer: RpcPeer<RpcServerContext>,
    ): Promise<void> {
        try {
            await this.closePeer(peer)
        } catch (error) {
            this.reportError(error)
        }
    }

    /**
     * 获取客户端 Peer。
     */
    getClient(
        key: number,
    ): RpcPeer<RpcServerContext> | undefined {
        return this.clients.get(key)
    }

    /**
     * 获取当前连接数。
     */
    get clientCount(): number {
        return this.clients.size
    }

    /**
     * 跟踪异步初始化任务。
     */
    private trackPeerInitialization(
        task: Promise<void>,
    ): void {
        this.pendingPeers.add(task)

        void task.then(
            () => this.pendingPeers.delete(task),
            error => {
                this.pendingPeers.delete(task)
                this.reportError(error)
            },
        )
    }

    /**
     * 停止服务。
     */
    stop(): Promise<void> {
        if (this.stopPromise) {
            return this.stopPromise
        }

        this.stopping = true
        this.stopPromise = this.stopInternal().finally(() => {
            this.stopPromise = undefined // 关键：停止结束后必须重置！
            this.stopping = false
        })

        return this.stopPromise
    }

    private async stopInternal(): Promise<void> {
        /*
         * 等待启动流程结束，避免 start/stop 竞态。
         */
        if (this.startPromise) {
            await this.startPromise.catch(() => undefined)
        }

        /*
         * 关闭所有监听器。
         */
        await Promise.allSettled(
            this.listeners.map(listener =>
                this.closeListener(listener),
            ),
        )

        this.listeners.length = 0

        /*
         * 等待已开始的 Peer 初始化结束。
         */
        while (this.pendingPeers.size > 0) {
            await Promise.allSettled([
                ...this.pendingPeers,
            ])
        }

        /*
         * 清理当前连接。
         */
        const peers = [...this.clients.values()]
        this.clients.clear()

        await Promise.allSettled(
            peers.map(peer => this.closePeerSafely(peer)),
        )

        this.started = false
    }

    private async closeListener(
        listener: {
            server: HttpServer
            wsServer: WebSocketServer
            started: boolean
        },
    ): Promise<void> {
        const {server, wsServer} = listener

        /*
         * 先关闭 WebSocket 客户端。
         */
        for (const socket of wsServer.clients) {
            socket.terminate()
        }

        const serverClose = new Promise<void>(resolve => {
            if (!server.listening) {
                resolve()
                return
            }

            server.close(() => resolve())
        })

        const wsClose = new Promise<void>(resolve => {
            try {
                wsServer.close(() => resolve())
            } catch {
                resolve()
            }
        })

        await Promise.all([serverClose, wsClose])

        listener.started = false
    }

    private rejectUpgrade(
        socket: Duplex,
        statusCode: number,
        statusText: string,
    ): void {
        if (socket.destroyed) {
            return
        }

        socket.end(
            `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
            'Connection: close\r\n' +
            'Content-Length: 0\r\n' +
            '\r\n',
        )
    }

    private reportError(error: unknown): void {
        const normalized = error instanceof Error
            ? error
            : new Error(String(error))

        // 可以在这里接入项目现有的 logger。
        console.error(normalized)
    }

    async closeItem(token: string) {
        const item = this.findByToken(token);
        if (!item) {
            return
        }
        await this.closePeer(item)
    }

    findByToken(token: any) {
        let key;
        for (const [k, v] of this.clients) {
            if (v.getContext()?.token === token) {
                key = k;
                break
            }
        }
        if (!key) {
            return
        }
        const item = this.clients.get(key);
        if (!item) {
            return
        }
        return item;
    }
}