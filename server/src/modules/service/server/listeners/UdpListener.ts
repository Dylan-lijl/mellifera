import dgram from 'node:dgram'

import type {
    MappingListener,
    MappingListenerConfig,
    MappingListenerStartResult, TransportListenerMetadata,
} from '@/types'
import {transportProtocol} from "@mellifera/common/constant";

export interface UdpListenerOptions {
    /**
     * 监听地址，默认监听所有 IPv4 网卡。
     */
    listenHost?: string

    /**
     * 收到 UDP 数据报时调用。
     *
     * rinfo 包含发送方的地址、端口和地址族。
     * socket 可用于向原发送方回包。
     */
    onMessage?: (
        message: Buffer,
        rinfo: dgram.RemoteInfo,
        socket: dgram.Socket,
        config: MappingListenerConfig,
    ) => void | Promise<void>
}

export class UdpListener implements MappingListener {
    private socket?: dgram.Socket

    private startPromise?: Promise<MappingListenerStartResult>

    private stopPromise?: Promise<void>

    private actualPort: number | null = null

    private readonly config: MappingListenerConfig
    private options: UdpListenerOptions | undefined
    constructor(
        config: MappingListenerConfig,
    ) {
        this.config = config
    }
    setOptions(options: any) {
        this.options = options
    }

    async start(): Promise<MappingListenerStartResult> {
        if (this.stopPromise) {
            throw new Error(
                `UDP 映射正在停止，不能启动：${this.config.id}`,
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
        const socket = dgram.createSocket('udp4')

        this.socket = socket

        socket.on('message', (message, rinfo) => {
            void this.handleMessage(message, rinfo, socket)
        })

        socket.on('error', error => {
            console.error(
                `[UDP] Socket 错误，mappingId=${this.config.id}`,
                error,
            )
        })

        return new Promise<MappingListenerStartResult>((resolve, reject) => {
            let settled = false

            const onListening = () => {
                if (settled) return
                settled = true

                socket.removeListener('listening', onListening)
                socket.removeListener('error', onStartupError)

                const address = socket.address()

                this.actualPort = address.port

                resolve({
                    listenPort: address.port,
                })
            }

            const onStartupError = (error: Error) => {
                if (settled) return
                settled = true

                socket.removeListener('listening', onListening)
                socket.removeListener('error', onStartupError)

                void this.closeSocket(socket).finally(() => {
                    if (this.socket === socket) {
                        this.socket = undefined
                        this.actualPort = null
                    }

                    reject(error)
                })
            }

            socket.once('listening', onListening)
            socket.once('error', onStartupError)

            socket.bind({
                address: '0.0.0.0',
                port: this.config.listenPort,
            })
        })
    }

    /**
     * 将数据报交给转发会话管理器。
     */
    private async handleMessage(
        message: Buffer,
        rinfo: dgram.RemoteInfo,
        socket: dgram.Socket,
    ): Promise<void> {
        if (this.stopPromise || this.socket !== socket) {
            return
        }

        const handler = this.options?.onMessage

        // 没有转发处理器时直接丢弃数据报。
        if (!handler) {
            return
        }

        try {
            await handler(message, rinfo, socket, this.config)
        } catch (error) {
            console.error(
                `[UDP] 处理数据报失败，mappingId=${this.config.id}`,
                error,
            )
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
        const socket = this.socket

        if (!socket) {
            this.actualPort = null
            this.startPromise = undefined
            return
        }

        try {
            await this.closeSocket(socket)
        } finally {
            if (this.socket === socket) {
                this.socket = undefined
                this.actualPort = null
                this.startPromise = undefined
            }
        }
    }

    private closeSocket(socket: dgram.Socket): Promise<void> {
        return new Promise(resolve => {
            try {
                socket.close(() => resolve())
            } catch {
                // Socket 尚未成功绑定或已经关闭。
                resolve()
            }
        })
    }

    get port(): number | null {
        return this.actualPort
    }
}
export default {
    protocol: transportProtocol.udp.value,
    order: 0,
    clazz: UdpListener
} satisfies TransportListenerMetadata