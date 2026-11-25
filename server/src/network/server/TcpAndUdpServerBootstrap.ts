import net, {
    type Server,
    type Socket
} from 'node:net'
import dgram, {
    type Socket as DatagramSocket,
    type RemoteInfo
} from 'node:dgram'
import type {
    NetworkServerContext
} from '@/types/network'

import {
    decodePayload,
    decodeUdpFrame,
    encodeFrame,
    encodePayload,
    type ProtocolFrame,
    TcpFrameDecoder
} from '@/utils/network'
import {Buffer} from "node:buffer";
import {registerControllers, RpcDispatcher} from "../RpcDispatcher"
import {logger} from "@/utils";
import type {Constructor} from "@/network/client/TcpAndUdpBootstrap";


// ============================================================
// Types
// ============================================================

export interface TcpAndUdpServerOptions {
    commandControllers: Constructor[],
    dataControllers: Constructor[],
}

interface RpcServiceContext extends NetworkServerContext {
}


// ============================================================
// TCP Writer
// ============================================================

/**
 * TCP 写入。
 *
 * write() 返回 false 表示写入缓冲区达到背压阈值，
 * 需要等待 drain 后才能继续写入。
 *
 * 这里不等待远端收到数据，只等待本地背压解除。
 */
function writeTcp(
    socket: Socket,
    data: Buffer
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (socket.destroyed || !socket.writable) {
            reject(new Error('TCP socket 不可写'))
            return
        }

        let settled = false

        const cleanup = () => {
            socket.off('drain', onDrain)
            socket.off('error', onError)
            socket.off('close', onClose)
        }

        const finish = (error?: Error) => {
            if (settled) return

            settled = true
            cleanup()

            if (error) {
                reject(error)
            } else {
                resolve()
            }
        }

        const onDrain = () => {
            finish()
        }

        const onError = (error: Error) => {
            finish(error)
        }

        const onClose = () => {
            finish(new Error('TCP socket 已关闭'))
        }

        // 先注册监听，避免 write() 后 drain 已经触发。
        socket.on('drain', onDrain)
        socket.once('error', onError)
        socket.once('close', onClose)

        try {
            const writable = socket.write(data)

            // true：缓冲区仍然可以继续写入。
            // false：等待 drain。
            if (writable) {
                finish()
            }
        } catch (error) {
            finish(
                error instanceof Error
                    ? error
                    : new Error(String(error))
            )
        }
    })
}


// ============================================================
// UDP Writer
// ============================================================

/**
 * UDP 写入。
 *
 * Promise 只代表本地 send 回调完成，
 * 不代表远端已经收到数据。
 */
function writeUdp(
    socket: DatagramSocket,
    data: Buffer,
    remoteInfo: RemoteInfo
): Promise<void> {
    return new Promise((resolve, reject) => {
        socket.send(
            data,
            remoteInfo.port,
            remoteInfo.address,
            error => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            }
        )
    })
}

export class TcpAndUdpServerBootstrap {

    private tcpServer?: Server

    private udpSocket?: DatagramSocket

    private listening = false

    private starting = false

    private host = ''

    private port = 0
    private readonly clients = new Set<Socket>()
    private readonly options: TcpAndUdpServerOptions;

    constructor(options: TcpAndUdpServerOptions) {
        this.options = options
    }

    // ========================================================
    // Listen
    // ========================================================

    /**
     * 启动 TCP 和 UDP 监听。
     */
    async listen(
        host: string,
        port: number
    ): Promise<void> {

        if (this.listening || this.starting) {
            throw new Error('Server is already listening or starting')
        }

        this.starting = true

        this.host = host
        this.port = port

        const udpType = host.includes(':')
            ? 'udp6'
            : 'udp4'

        const tcpServer = net.createServer()

        const udpSocket = dgram.createSocket(udpType)

        this.tcpServer = tcpServer
        this.udpSocket = udpSocket

        // ----------------------------------------------------
        // TCP Connection
        // ----------------------------------------------------

        tcpServer.on('connection', socket => {
            this.handleTcpConnection(socket)
        })

        // ----------------------------------------------------
        // UDP Message
        // ----------------------------------------------------

        this.handleUdpSocket(udpSocket, host, port)

        // ----------------------------------------------------
        // Error
        // ----------------------------------------------------

        tcpServer.on('error', error => {
            logger.error(error)
        })

        udpSocket.on('error', error => {
            logger.error(error)
        })

        try {

            const results = await Promise.allSettled([
                this.listenTcp(tcpServer, host, port),
                this.listenUdp(udpSocket, host, port)
            ])
            const failed = results.find(
                result => result.status === 'rejected'
            )
            if (failed?.status === 'rejected') {
                throw failed.reason
            }
            this.listening = true
        } catch (error) {
            await this.close()
            throw error

        } finally {
            this.starting = false
        }
    }


    // ========================================================
    // TCP Connection
    // ========================================================

    /**
     * 处理一个 TCP 连接。
     *
     * 每个 TCP 连接独立拥有：
     * - NetworkContext
     * - Controller 实例
     * - RpcDispatcher
     * - TcpFrameDecoder
     * - Promise 消息队列
     */
    private handleTcpConnection(socket: Socket): void {
        this.clients.add(socket)
        const context: RpcServiceContext = {
            getEndpoint: () => ({
                type: 'socket',
                endpoint: socket
            }),

            getAddress: () => ({
                host: this.host,
                port: this.port
            }),
            dispatcher: new RpcDispatcher(
                (data) => writeTcp(socket, encodeFrame(data)),
                {
                    encode(value: any): Buffer {
                        return encodePayload(value);
                    },
                    decode<T = any>(buffer: Buffer): T {
                        return decodePayload(buffer) as T;
                    }
                }, {
                    timeout: 15 * 1000
                }),
            rpcMap: new Map(),
            available: false
        }
        registerControllers(this.options.commandControllers, context);
        const decoder = new TcpFrameDecoder()
        // 保证同一个 TCP 连接内的 RPC 顺序。
        let queue = Promise.resolve()
        socket.on('data', chunk => {
            queue = queue.then(async () => {
                let frames: ProtocolFrame[]
                // Frame 解码
                try {
                    frames = decoder.push(
                        Buffer.isBuffer(chunk)
                            ? chunk
                            : Buffer.from(chunk)
                    )
                } catch (error) {
                    console.error(
                        'TCP Frame 解码失败:',
                        error
                    )
                    decoder.reset()

                    socket.destroy()
                    return
                }

                // 逐个处理 Frame
                for (const frame of frames) {
                    try {
                        await context.dispatcher.dispatch(
                            frame,
                            data => writeTcp(socket, encodeFrame(data))
                        )

                    } catch (error) {

                        console.error(
                            `RPC 执行失败: ${frame.path}`,
                            error
                        )

                        // 单个 RPC 失败不影响后续 Frame。
                    }
                }

            }).catch(error => {

                console.error(
                    'TCP 消息队列异常:',
                    error
                )

                socket.destroy()
            })
        })
        // ----------------------------------------------------
        // Socket Close
        // ----------------------------------------------------
        socket.once('close', () => {
            context.available = false
            decoder.reset()
            this.clients.delete(socket)
        })
        socket.once('error', error => {
            context.available = false
            logger.error(error)
        })
    }


    // ========================================================
    // UDP Socket
    // ========================================================

    /**
     * 初始化 UDP RPC。
     *
     * UDP 是无连接的：
     * 整个 UDP Socket 共用一套 Controller 和 Dispatcher。
     */
    private handleUdpSocket(
        socket: DatagramSocket,
        host: string,
        port: number
    ): void {

        const context: RpcServiceContext = {
            getEndpoint: () => ({
                type: 'datagram',
                endpoint: socket
            }),
            rpcMap: new Map(),
            getAddress: () => ({
                host,
                port
            }),
            dispatcher: new RpcDispatcher((data) => writeUdp(socket, encodeFrame(data), {
                address: host,
                family: host.includes("::") ? "IPv6" : "IPv4",
                port,
            } as RemoteInfo), {
                encode(value: any): Buffer {
                    return encodePayload(value)
                },
                decode<T = any>(buffer: Buffer): T {
                    return decodePayload(buffer) as T;
                }
            }, {timeout: 15 * 1000}),
            available: false
        }
        registerControllers(this.options.dataControllers, context);
        context.available = true
        socket.on('message', (message, remoteInfo) => {
            void this.handleUdpMessage(
                context.dispatcher,
                message,
                remoteInfo,
                socket
            ).catch(error => {

                console.error(
                    'UDP RPC 处理失败:',
                    error
                )

            })
        })

        socket.once('close', () => {
            context.available = false
        })
    }


    /**
     * 处理单个 UDP 数据包。
     */
    private async handleUdpMessage(
        dispatcher: RpcDispatcher,
        message: Buffer,
        remoteInfo: RemoteInfo,
        socket: DatagramSocket
    ): Promise<void> {

        let frame: ProtocolFrame | null

        try {

            frame = decodeUdpFrame(message)

        } catch (error) {

            console.error(
                'UDP Frame 解码失败:',
                error
            )

            return
        }

        if (!frame) return

        await dispatcher.dispatch(
            frame,
            data => writeUdp(socket, encodeFrame(data), remoteInfo)
        )
    }


    // ========================================================
    // TCP Listen
    // ========================================================

    private listenTcp(
        server: Server,
        host: string,
        port: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                server.off('error', onError)
                server.off('listening', onListening)
            }
            const onError = (error: Error) => {
                cleanup()
                reject(error)
            }
            const onListening = () => {
                cleanup()
                resolve()
            }
            server.once('error', onError)
            server.once('listening', onListening)

            server.listen(port, host)
        })
    }


    // ========================================================
    // UDP Listen
    // ========================================================

    private listenUdp(
        socket: DatagramSocket,
        host: string,
        port: number
    ): Promise<void> {

        return new Promise((resolve, reject) => {

            const cleanup = () => {
                socket.off('error', onError)
                socket.off('listening', onListening)
            }

            const onError = (error: Error) => {
                cleanup()
                reject(error)
            }

            const onListening = () => {
                cleanup()
                resolve()
            }

            socket.once('error', onError)
            socket.once('listening', onListening)

            socket.bind(port, host)
        })
    }


    // ========================================================
    // Close
    // ========================================================

    /**
     * 关闭 TCP 和 UDP。
     */
    async close(): Promise<void> {
        const tcpServer = this.tcpServer
        const udpSocket = this.udpSocket
        await Promise.all([
            this.closeTcp(tcpServer),
            this.closeUdp(udpSocket)
        ])
        this.tcpServer = undefined
        this.udpSocket = undefined
        this.listening = false
    }


    /**
     * 关闭 TCP Server。
     */
    private closeTcp(
        server?: Server
    ): Promise<void> {
        return new Promise(resolve => {
            if (!server) {
                resolve()
                return
            }
            if (!server.listening) {
                resolve()
                return
            }
            server.close(() => {
                resolve()
            })
        })
    }


    /**
     * 关闭 UDP Socket。
     */
    private closeUdp(
        socket?: DatagramSocket
    ): Promise<void> {
        return new Promise(resolve => {
            if (!socket) {
                resolve()
                return
            }
            try {
                socket.close(() => {
                    resolve()
                })
            } catch {
                resolve()
            }
        })
    }


    // ========================================================
    // State
    // ========================================================

    get isListening(): boolean {
        return this.listening
    }

    get isStarting(): boolean {
        return this.starting
    }
}