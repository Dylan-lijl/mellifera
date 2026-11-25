import net, {type Socket} from 'node:net';

import dgram, {
    type Socket as DatagramSocket,
    type RemoteInfo,
} from 'node:dgram';

import type {NetworkClientContext,} from '@/types/network';
import {
    decodePayload,
    decodeUdpFrame,
    encodeFrame,
    encodePayload,
    type ProtocolFrame,
    TcpFrameDecoder,
} from '@/utils/network';

import {logger} from "@/utils";
import {registerControllers, RpcDispatcher} from "@/network/RpcDispatcher";
import {Buffer} from "node:buffer";


// ============================================================
// Types
// ============================================================

export type Constructor<T = object> = new (...args: any[]) => T;
interface RpcServiceContext extends NetworkClientContext {
}

export interface TcpAndUdpBootstrapOptions {
    host: string;
    port: number;
    /** 本地 UDP 绑定地址，默认 0.0.0.0 */
    localHost?: string;
    /** 本地 UDP 绑定端口，默认 0（系统分配） */
    localPort?: number;
    /** RPC 请求超时时间，默认 15000ms */
    timeout?: number;
}

export interface TcpAndUdpBootstrapState {
    cmdState: boolean,
    streamState: {
        available: number,
        total: number,
    },
    datagramState: {
        available: number,
        total: number,
    }
}


// ============================================================
// TCP Writer
// ============================================================

function writeTcp(
    socket: Socket,
    data: Buffer
): Promise<void> {
    return new Promise((resolve, reject) => {

        if (socket.destroyed || !socket.writable) {
            reject(new Error('TCP socket 不可写'));
            return;
        }

        let settled = false;

        const cleanup = () => {
            socket.off('drain', onDrain);
            socket.off('error', onError);
            socket.off('close', onClose);
        };

        const finish = (error?: Error) => {
            if (settled) return;

            settled = true;
            cleanup();

            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        const onDrain = () => finish();
        const onError = (error: Error) => finish(error);
        const onClose = () => finish(new Error('TCP socket 已关闭'));

        socket.on('drain', onDrain);
        socket.once('error', onError);
        socket.once('close', onClose);

        try {
            if (socket.write(data)) {
                finish();
            }
        } catch (error) {
            finish(
                error instanceof Error
                    ? error
                    : new Error(String(error))
            );
        }
    });
}


// ============================================================
// UDP Writer
// ============================================================

function writeUdp(
    socket: DatagramSocket,
    data: Buffer,
    host: string,
    port: number
): Promise<void> {
    return new Promise((resolve, reject) => {

        socket.send(data, port, host, error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}



// ============================================================
// TcpAndUdpBootstrap
// ============================================================
type CmdSocket = {
    socket: Socket, context: RpcServiceContext, waitQueue: Promise<void>[]
}
type CommonChannel = {
    channelId: number,
    context: RpcServiceContext,
    waitQueue: Promise<void>[]
}
type StreamChannel = CommonChannel & {
    type: 'stream',
    socket: Socket,
}
type DatagramChannel = CommonChannel & {
    type: 'datagram',
    socket: DatagramSocket,
}
type DataChannel = StreamChannel | DatagramChannel;

export class TcpAndUdpBootstrap {
    cmdStream?: CmdSocket;
    dataSockets = new Map<number, DataChannel>

    private starting = false;

    private host = '';

    private port = 0;

    private readonly options: TcpAndUdpBootstrapOptions;

    constructor(
        options: TcpAndUdpBootstrapOptions
    ) {
        this.options = options;
    }

    // ========================================================
    // Connect
    // ========================================================

    /**
     * 连接服务端。
     *
     */
    async connectCmd(controllers: Constructor[]): Promise<void> {
        if (this.starting || this.cmdStream?.context?.available) {
            throw new Error('Bootstrap 已连接或正在连接');
        }
        this.starting = true;
        this.host = this.options.host;
        this.port = this.options.port;
        try {
            let {channelId, ...channel} = await this.connectTcp(controllers, 0, this.host, this.port);
            this.cmdStream = channel;
        } catch (error) {
            await this.close();
            throw error;
        } finally {
            this.starting = false;
        }
    }

    async connectData(
        controllers: Constructor[],
        channelId: number,
        type: 'stream',
        host: string,
        port: number,
    ): Promise<StreamChannel>;
    async connectData(
        controllers: Constructor[],
        channelId: number,
        type: 'datagram',
        host: string,
        port: number,
    ): Promise<DatagramChannel>;
    async connectData(
        controllers: Constructor[],
        channelId: number,
        type: 'stream' | 'datagram',
        host: string,
        port: number,
    ): Promise<StreamChannel | DatagramChannel> {
        if (!this.cmdStream?.context?.available) {
            throw new Error('命令连接尚未认证');
        }

        if (this.dataSockets.has(channelId)) {
            throw new Error(`数据通道已存在: ${channelId}`);
        }

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error(`无效端口: ${port}`);
        }

        try {
            const isStream = type === 'stream';
            const channel = isStream
                ? await this.connectTcp(controllers, channelId, host, port)
                : await this.createUdp(controllers, channelId, host, port);

            // 避免创建期间命令连接已经断开
            if (!this.cmdStream?.context?.available) {
                (isStream ? (channel as StreamChannel).socket.destroy() : (channel as DatagramChannel).socket.close());
                throw new Error('命令连接已断开');
            }

            this.dataSockets.set(channel.channelId, channel);

            return channel;
        } catch (error) {
            throw error;
        }
    }

    // ========================================================
    // TCP Connect
    // ========================================================

    private async connectTcp(controllers: Constructor[], channelId: number, host: string, port: number) {
        const socket = net.createConnection({
            host,
            port,
        });
        socket.setNoDelay(true);
        await new Promise<void>((resolve, reject) => {
            const onConnect = () => {
                cleanup();
                resolve();
            };
            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };
            const cleanup = () => {
                socket.off('connect', onConnect);
                socket.off('error', onError);
            };

            socket.once('connect', onConnect);
            socket.once('error', onError);
        });
        const context: RpcServiceContext = {
            getEndpoint: () => ({
                type: 'socket',
                endpoint: socket,
            }),
            rpcMap:new Map(),
            getAddress: () => ({
                host: this.host,
                port: this.port,
            }),
            dispatcher: new RpcDispatcher(async (frame) => {
                await writeTcp(socket, encodeFrame(frame))
            }, {
                encode(value: any): Buffer {
                    return encodePayload(value)
                },
                decode<T = any>(buffer: Buffer): T {
                    return decodePayload(buffer) as T
                }
            }, {
                timeout: 15 * 1000, onError: (error: any) => {
                    logger.error(error)
                }
            }),
            bootstrap: this,
            available: false,
        };
        registerControllers(controllers, context);
        // ----------------------------------------------------
        // TCP Data
        // ----------------------------------------------------

        let queue = Promise.resolve();
        let tcpDecoder = new TcpFrameDecoder();
        socket.on('data', chunk => {
            queue = queue.then(async () => {
                let frames: ProtocolFrame[];
                try {
                    frames = tcpDecoder.push(
                        Buffer.isBuffer(chunk)
                            ? chunk
                            : Buffer.from(chunk)
                    );
                } catch (error) {
                    socket.destroy();
                    return;
                }
                for (const frame of frames) {
                    try {
                        await context.dispatcher.dispatch(frame);
                    } catch (error) {
                    }
                }
            }).catch(error => {
                logger.error(error);
                socket.destroy();
            });
        });
        const streamChannel: StreamChannel = {
            type: 'stream',
            socket,
            channelId,
            context,
            waitQueue: [],
        }
        // ----------------------------------------------------
        // TCP Close
        // ----------------------------------------------------

        socket.once('close', () => {
            context.available = false;
            tcpDecoder.reset();
            context.dispatcher.destroy(
                new Error('TCP 命令连接已关闭')
            );
        });

        socket.on('error', error => {
            logger.error(error);
        });

        return streamChannel;
    }

    // ========================================================
    // UDP Bind
    // ========================================================

    private async createUdp(controllers: Constructor[], channelId: number, host: string, port: number) {

        const udpType = host.includes(':')
            ? 'udp6'
            : 'udp4';
        const socket = dgram.createSocket(udpType);
        const localHost = this.options.localHost ?? '0.0.0.0';
        const localPort = this.options.localPort ?? 0;
        await new Promise<void>((resolve, reject) => {
            const onListening = () => {
                cleanup();
                resolve();
            };
            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };
            const cleanup = () => {
                socket.off('listening', onListening);
                socket.off('error', onError);
            };
            socket.once('listening', onListening);
            socket.once('error', onError);
            socket.bind({
                port: localPort,
                address: localHost,
            });
        });
        const context: RpcServiceContext = {
            getEndpoint: () => ({
                type: 'datagram',
                endpoint: socket,
            }),
            rpcMap:new Map(),
            getAddress: () => ({
                host: host,
                port: port,
            }),
            bootstrap: this,
            dispatcher: new RpcDispatcher(async (frame) => {
                await writeUdp(socket, encodeFrame(frame), host, port)
            }, {
                encode(value: any): Buffer {
                    return encodePayload(value)
                },
                decode<T = any>(buffer: Buffer): T {
                    return decodePayload(buffer) as T
                }
            }, {
                timeout: 15 * 1000, onError: (error: any) => {
                    logger.error(error)
                }
            }),
            available: false,
        };

        registerControllers(
            controllers,
            context
        );

        // ----------------------------------------------------
        // UDP Message
        // ----------------------------------------------------

        socket.on('message', (message, remoteInfo) => {
            void this.handleUdpMessage(
                context.dispatcher,
                message,
                remoteInfo,
                socket
            ).catch(error => {
                logger.error(error);
            });
        });

        socket.on('error', error => {
            logger.error(error);
        });

        socket.once('close', () => {
            context.available = false;
            context.dispatcher.destroy(
                new Error('UDP Socket 已关闭')
            );
        });
        return {
            type: 'datagram',
            socket,
            context,
            channelId,
            waitQueue: [],
        } as DatagramChannel;
    }

    // ========================================================
    // UDP Message
    // ========================================================

    private async handleUdpMessage(
        dispatcher: RpcDispatcher,
        message: Buffer,
        remoteInfo: RemoteInfo,
        socket: DatagramSocket
    ): Promise<void> {

        let frame: ProtocolFrame | null;

        try {
            frame = decodeUdpFrame(message);
        } catch (error) {
            logger.error(error);
            return;
        }
        if (!frame) {
            logger.warn('protocolError', 'frame is empty', 'udp', remoteInfo)
            return;
        }
        await dispatcher.dispatch(
            frame,
            data => writeUdp(
                socket,
                encodeFrame(data),
                remoteInfo.address,
                remoteInfo.port
            )
        );
    }

    // ========================================================
    // Public API
    // ========================================================

    /* /!**
      * 发送 UDP RPC 请求。
      *!/
     invokeUdp(
         path: string,
         params: unknown,
         ack: boolean
     ): Promise<unknown> | void {

         if (!this.udpDispatcher) {
             throw new Error('UDP 尚未初始化');
         }

         return this.udpDispatcher.invoke(
             path,
             params,
             ack
         );
     }

     /!**
      * 发送 TCP RPC 请求。
      *!/
     invokeTcp(
         path: string,
         params: unknown,
         ack: boolean
     ): Promise<unknown> | void {

         if (!this.tcpDispatcher) {
             throw new Error('TCP 尚未初始化');
         }

         return this.tcpDispatcher.invoke(
             path,
             params,
             ack
         );
     }
 */
    // ========================================================
    // Close
    // ========================================================

    async close(): Promise<void> {
        if (this.cmdStream) {
            if (this.cmdStream.socket) {
                if (!this.cmdStream.socket.destroyed) {
                    this.cmdStream.socket.destroy();
                }
            }
            if (this.cmdStream.waitQueue.length) {
                await Promise.allSettled(this.cmdStream.waitQueue)
            }
            if (this.cmdStream.context) {
                this.cmdStream.context.dispatcher.destroy();
                this.cmdStream.context.available = false;
            }
            this.cmdStream = undefined;
        }
        if (this.dataSockets.size) {
            const tasks: Promise<void>[] = [];
            this.dataSockets.forEach((v) => {
                if (v.type === 'stream') {
                    if (!v.socket.destroyed) {
                        tasks.push((async () => {
                            v.socket.destroy();
                            if (v.waitQueue.length) {
                                await Promise.allSettled(v.waitQueue)
                            }
                        })())
                    }
                    v.context.available = false;
                } else if (v.type === 'datagram') {
                    if (!v.socket.disconnect) {
                        tasks.push((async () => {
                            v.socket.close();
                            if (v.waitQueue.length) {
                                await Promise.allSettled(v.waitQueue)
                            }
                        })())
                    }
                    v.context.available = false;
                }
            });
            await Promise.all(tasks)
        }
        this.dataSockets.clear();
    }

    /* private closeTcp(socket?: Socket): Promise<void> {

         return new Promise(resolve => {

             if (!socket || socket.destroyed) {
                 resolve();
                 return;
             }

             socket.destroy();
             resolve();
         });
     }

     private closeUdp(socket?: DatagramSocket): Promise<void> {

         return new Promise(resolve => {

             if (!socket) {
                 resolve();
                 return;
             }

             try {
                 socket.close(() => resolve());
             } catch {
                 resolve();
             }
         });
     }*/

    // ========================================================
    // State
    // ========================================================

    get state() {
        const state: TcpAndUdpBootstrapState = {
            cmdState: this.cmdStream?.context?.available ?? false,
            streamState: {
                available: 0,
                total: 0,
            },
            datagramState: {
                available: 0,
                total: 0,
            }
        };
        this.dataSockets.forEach(v => {
            if (v.type === 'stream') {
                state.streamState.total += 1;
                if (v.context.available) {
                    state.datagramState.available += 1;
                }
            } else if (v.type === 'datagram') {
                state.datagramState.total += 1;
                if (v.context.available) {
                    state.datagramState.available += 1;
                }
            }
        })
        return state;
    }
}
