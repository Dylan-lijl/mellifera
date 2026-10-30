import net from 'node:net'

import type {
    MappingListener,
    MappingListenerConfig,
    MappingListenerStartResult, TransportListenerMetadata,
} from '@/types'
import {transportProtocol} from "@mellifera/common/constant";

export interface TcpListenerOptions {
    /**
     * 监听地址。
     * 默认监听所有 IPv4 网卡。
     */
    listenHost?: string

    /**
     * 收到外部 TCP 连接时调用。
     *
     * 后续由转发会话管理器接管 socket。
     */
    onConnection?: (
        socket: net.Socket,
        config: MappingListenerConfig,
    ) => void | Promise<void>
}

export class TcpListener implements MappingListener {
    private server?: net.Server

    private startPromise?: Promise<MappingListenerStartResult>

    private stopPromise?: Promise<void>

    private actualPort: number | null = null

    private readonly config: MappingListenerConfig
    private options: TcpListenerOptions | undefined

    constructor(
        config: MappingListenerConfig,
    ) {
        this.config = config;
    }

    setOptions(options: any) {
        this.options = options
    }

    async start(): Promise<MappingListenerStartResult> {
        if (this.stopPromise) {
            throw new Error(
                `TCP 映射正在停止，不能启动：${this.config.id}`,
            )
        }

        if (this.startPromise) {
            return this.startPromise
        }

        this.startPromise = this.startInternal()

        try {
            return await this.startPromise
        } catch (error) {
            this.startPromise = undefined
            throw error
        }
    }

    private async startInternal(): Promise<MappingListenerStartResult> {
        const server = net.createServer({
            pauseOnConnect: false,
        })

        this.server = server

        server.on('connection', socket => {
            void this.handleConnection(socket)
        })

        return new Promise<MappingListenerStartResult>((resolve, reject) => {
            let settled = false

            const cleanupStartupListeners = () => {
                server.removeListener('listening', onListening)
                server.removeListener('error', onError)
            }

            const onListening = () => {
                if (settled) return
                settled = true

                cleanupStartupListeners()

                const address = server.address()

                if (!address || typeof address === 'string') {
                    void this.closeServer(server).finally(() => {
                        reject(new Error('无法获取 TCP 监听端口'))
                    })
                    return
                }

                this.actualPort = address.port

                resolve({
                    listenPort: address.port,
                })
            }

            const onError = (error: Error) => {
                if (settled) {
                    console.error(
                        `[TCP] 监听器发生错误，mappingId=${this.config.id}`,
                        error,
                    )
                    return
                }

                settled = true
                cleanupStartupListeners()

                void this.closeServer(server).finally(() => {
                    if (this.server === server) {
                        this.server = undefined
                        this.actualPort = null
                    }

                    reject(error)
                })
            }

            server.once('listening', onListening)
            server.on('error', onError)

            server.listen({
                host: '0.0.0.0',
                port: this.config.listenPort,
            })
        })
    }

    /**
     * 将新连接交给转发会话管理器。
     */
    private async handleConnection(socket: net.Socket): Promise<void> {
        if (this.stopPromise) {
            socket.destroy()
            return
        }

        const handler = this.options?.onConnection

        if (!handler) {
            socket.destroy()
            return
        }

        try {
            await handler(socket, this.config)
        } catch (error) {
            console.error(
                `[TCP] 处理连接失败，mappingId=${this.config.id}`,
                error,
            )

            socket.destroy()
        }
    }

    async stop(): Promise<void> {
        if (this.stopPromise) {
            return this.stopPromise
        }

        this.stopPromise = this.stopInternal()

        try {
            await this.stopPromise
        } finally {
            this.stopPromise = undefined
        }
    }

    private async stopInternal(): Promise<void> {
        const server = this.server

        if (!server) {
            this.actualPort = null
            this.startPromise = undefined
            return
        }

        try {
            await this.closeServer(server)
        } finally {
            if (this.server === server) {
                this.server = undefined
                this.actualPort = null
                this.startPromise = undefined
            }
        }
    }

    /**
     * 关闭 Server。
     * 如果尚未开始监听，或已经关闭，则视为完成。
     */
    private closeServer(server: net.Server): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!server.listening) {
                resolve()
                return
            }

            server.close(error => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }

    get port(): number | null {
        return this.actualPort
    }
}

export default {
    protocol: transportProtocol.tcp.value,
    order: 0,
    clazz: TcpListener
} satisfies TransportListenerMetadata