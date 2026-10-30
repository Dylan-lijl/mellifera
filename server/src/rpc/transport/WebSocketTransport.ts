import WebSocket from 'ws'
import type {RpcTransport} from './RpcTransport'
import {ResultApiException} from "@mellifera/common/CustomException";
import {CONNECTION_FAILED} from "@mellifera/common/ResultCode";

export class WebSocketTransport implements RpcTransport {
    private readonly socket: WebSocket;

    constructor(socket: WebSocket) {
        this.socket = socket
    }

    async connect(): Promise<void> {
        if (this.socket.readyState === WebSocket.OPEN) {
            return
        }

        return new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                this.socket.off('open', onOpen)
                this.socket.off('error', onError)
                this.socket.off('close', onClose)
            }

            const onOpen = () => {
                cleanup()
                resolve()
            }

            const onError = (error: Error) => {
                cleanup()
                if(error instanceof AggregateError&&(error as AggregateError).errors.length){
                    let message='其他连接错误'+error;
                    switch ((error as AggregateError).errors[0].code) {
                        case 'ECONNREFUSED':
                            message='连接被拒绝：服务器可能未启动或端口未监听';
                            break;
                        case 'ETIMEDOUT':
                            message='连接超时';
                            break;
                        case 'ENOTFOUND':
                            message='域名解析失败';
                            break;
                        case 'EHOSTUNREACH':
                            message='目标主机不可达';
                            break;
                        case 'ECONNRESET':
                            message='连接被对端重置';
                            break;
                    }
                    reject(new ResultApiException({...CONNECTION_FAILED,other: message}));
                }else{
                    reject(error)
                }
            }

            const onClose = () => {
                cleanup()
                reject(new Error('WebSocket closed before connection was established'))
            }

            this.socket.once('open', onOpen)
            this.socket.once('error', onError)
            this.socket.once('close', onClose)
        })
    }

    get isOpen() {
        return this.socket.readyState === WebSocket.OPEN
    }

    send(data: string) {
        if (!this.isOpen) throw new Error('WebSocket is not open')
        this.socket.send(data, error => {
            if (error) this.socket.emit('error', error)
        })
    }

    onMessage(listener: (data: string) => void) {
        const handler = (data: WebSocket.RawData) => {
            if (typeof data === 'string') listener(data)
            else if (Buffer.isBuffer(data)) listener(data.toString('utf8'))
            else listener(Buffer.from(data as ArrayBuffer).toString('utf8'))
        }
        this.socket.on('message', handler)
        return () => this.socket.off('message', handler)
    }

    onClose(listener: (reason?: Error) => void) {
        const handler = (code: number, reason: Buffer) => {
            listener(new Error(`WebSocket closed (${code}): ${reason.toString('utf8')}`))
        }
        this.socket.on('close', handler)
        return () => this.socket.off('close', handler)
    }

    onError(listener: (error: Error) => void) {
        this.socket.on('error', listener)
        return () => this.socket.off('error', listener)
    }

    close(code?: number, reason?: string) {
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
            this.socket.close(code, reason)
        }
    }
}
