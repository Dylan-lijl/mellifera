
import net from 'node:net'
import {
    createServer,
    type Server as HttpServer,
} from 'node:http'
import {
    WebSocket,
    WebSocketServer,
    type RawData,
} from 'ws'
import type { Duplex } from 'node:stream'
import type { IncomingMessage } from 'node:http'

export interface ControlMessage {
    type: string
    id?: string
    data?: unknown
}

interface Listener {
    host: string
    server: HttpServer
    wsServer: WebSocketServer
    started: boolean
}

export class ControlServer {
    private readonly listeners: Listener[] = []
    private readonly clients = new Set<WebSocket>()

    private starting = false
    private stopping = false

    onMessage?: (
        client: WebSocket,
        message: ControlMessage,
    ) => void

    onClientConnected?: (client: WebSocket) => void
    onClientDisconnected?: (client: WebSocket) => void
    onClientError?: (client: WebSocket, error: Error) => void
    onServerError?: (host: string, error: Error) => void

    get clientCount(): number {
        return this.clients.size
    }

    async start(config: {port:number,hosts:string[]}): Promise<void> {
        if (
            this.starting ||
            this.stopping ||
            this.listeners.length > 0
        ) {
            throw new Error('ControlServer is already started or busy')
        }

        this.starting = true

        try {
            for (const host of config.hosts) {
                const listener = this.createListener(host)
                this.listeners.push(listener)

                try {
                    await this.startListener(listener, config.port)

                    const address = listener.server.address()

                    if (!address || typeof address === 'string') {
                        throw new Error(`无法获取监听地址：${host}`)
                    }
                } catch (error) {
                    throw new Error(
                        `监听 ${host}:${config.port} 失败：${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                        { cause: error },
                    )
                }
            }
        } catch (error) {
            await this.closeListeners()
            throw error
        } finally {
            this.starting = false
        }
    }

    send(
        client: WebSocket,
        message: ControlMessage,
    ): boolean {
        if (client.readyState !== WebSocket.OPEN) {
            return false
        }

        client.send(JSON.stringify(message))
        return true
    }

    broadcast(message: ControlMessage): void {
        const data = JSON.stringify(message)

        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data)
            }
        }
    }

    async stop(): Promise<void> {
        if (this.stopping) {
            return
        }

        if (this.starting) {
            throw new Error('ControlServer is starting')
        }

        this.stopping = true

        try {
            await this.closeListeners()
        } finally {
            this.stopping = false
        }
    }

    private createListener(host: string): Listener {
        const server = createServer()

        const wsServer = new WebSocketServer({
            noServer: true,
            maxPayload: 1024 * 1024,
        })

        server.on('upgrade', (
            request: IncomingMessage,
            socket: Duplex,
            head: Buffer,
        ) => {
            if (this.stopping) {
                socket.destroy()
                return
            }

            wsServer.handleUpgrade(
                request,
                socket,
                head,
                client => {
                    wsServer.emit('connection', client, request)
                },
            )
        })

        wsServer.on('connection', client => {
            this.clients.add(client)
            this.onClientConnected?.(client)

            client.on('message', (raw: RawData) => {
                try {
                    const message: unknown = JSON.parse(
                        raw.toString(),
                    )

                    if (
                        typeof message !== 'object' ||
                        message === null ||
                        !('type' in message) ||
                        typeof message.type !== 'string'
                    ) {
                        throw new Error('Invalid control message')
                    }

                    this.onMessage?.(
                        client,
                        message as ControlMessage,
                    )
                } catch {
                    // 忽略格式错误的消息。
                    // 后续可以在这里增加日志或错误响应。
                }
            })

            client.on('close', () => {
                this.clients.delete(client)
                this.onClientDisconnected?.(client)
            })

            client.on('error', error => {
                this.onClientError?.(client, error)
            })
        })

        return {
            host,
            server,
            wsServer,
            started: false,
        }
    }

    private async startListener(
        listener: Listener,
        port: number,
    ): Promise<void> {
        const { server, host } = listener

        server.on('error', error => {
            if (listener.started) {
                this.onServerError?.(host, error)
            }
        })

        await new Promise<void>((resolve, reject) => {
            const onListening = () => {
                cleanup()
                listener.started = true
                resolve()
            }

            const onError = (error: Error) => {
                cleanup()
                reject(error)
            }

            const cleanup = () => {
                server.off('listening', onListening)
                server.off('error', onError)
            }

            server.once('listening', onListening)
            server.once('error', onError)

            server.listen({
                host,
                port,
                ...(net.isIP(host) === 6
                    ? { ipv6Only: true }
                    : {}),
            })
        })
    }

    private async closeListeners(): Promise<void> {
        const listeners = this.listeners.splice(0)

        for (const client of this.clients) {
            client.terminate()
        }

        this.clients.clear()

        await Promise.all(
            listeners.map(listener => this.closeListener(listener)),
        )
    }

    private async closeListener(
        listener: Listener,
    ): Promise<void> {
        const { server, wsServer } = listener

        const closeWebSocket = new Promise<void>(resolve => {
            wsServer.close(() => resolve())
        })

        const closeHttp = new Promise<void>(resolve => {
            if (!server.listening) {
                resolve()
                return
            }

            server.close(() => resolve())
        })

        await Promise.all([closeWebSocket, closeHttp])
        listener.started = false
    }
}
