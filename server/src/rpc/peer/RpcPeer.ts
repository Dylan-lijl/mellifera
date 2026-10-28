import {randomUUID} from 'node:crypto'
import {RpcError, RpcErrorCode} from '../protocol/RpcError'
import {isRpcMessage} from '../protocol/RpcProtocol'
import type {RpcMessage, RpcRequest, RpcResponse} from '../protocol/RpcProtocol'
import type {RpcTransport} from '../transport/RpcTransport'
import type {RpcRouter} from '../router/RpcRouter'

interface PendingRequest {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
}

export interface RpcPeerOptions<TContext> {
    requestTimeoutMs?: number
    context: TContext
    onError?: (error: Error) => void
}

export class RpcPeer<TContext> {
    private readonly pending = new Map<string, PendingRequest>()
    private readonly unsubs: Array<() => void> = []
    private closed = false
    private readonly timeoutMs: number
    private readonly context: TContext
    private readonly transport: RpcTransport
    private readonly router: RpcRouter<TContext>

    constructor(
        transport: RpcTransport,
        router: RpcRouter<TContext>,
        options: RpcPeerOptions<TContext>,
    ) {
        this.transport = transport;
        this.router = router
        this.timeoutMs = options.requestTimeoutMs ?? 30_000
        this.context = options.context
        this.unsubs.push(transport.onMessage(data => void this.handleMessage(data).catch(error => {
            options.onError?.(asError(error))
        })))
        this.unsubs.push(transport.onClose(reason => this.failAll(reason ?? new RpcError(RpcErrorCode.ConnectionClosed, 'Connection closed'))))
        this.unsubs.push(transport.onError(error => options.onError?.(error)))
    }

    getTransPort() {
        return this.transport;
    }

    request<T = unknown>(method: string, params?: unknown, timeoutMs = this.timeoutMs): Promise<T> {
        if (this.closed || !this.transport.isOpen) {
            return Promise.reject(new RpcError(RpcErrorCode.ConnectionClosed, 'RPC connection is not open'))
        }

        const id = randomUUID()
        const message: RpcRequest = {jsonrpc: '2.0', id, method, ...(params === undefined ? {} : {params})}

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new RpcError(RpcErrorCode.Timeout, `RPC request timed out: ${method}`))
            }, timeoutMs)

            this.pending.set(id, {resolve: value => resolve(value as T), reject, timer})
            try {
                this.send(message)
            } catch (error) {
                clearTimeout(timer)
                this.pending.delete(id)
                reject(asError(error))
            }
        })
    }

    notify(method: string, params?: unknown) {
        if (this.closed || !this.transport.isOpen) throw new RpcError(RpcErrorCode.ConnectionClosed, 'RPC connection is not open')
        this.send({jsonrpc: '2.0', method, ...(params === undefined ? {} : {params})})
    }

    close() {
        if (this.closed) return
        this.closed = true
        this.failAll(new RpcError(RpcErrorCode.ConnectionClosed, 'RPC peer closed'))
        for (const unsubscribe of this.unsubs) unsubscribe()
        this.transport.close(1000, 'RPC peer closed')
    }
    public getContext(){
        return this.context
    }
    private send(message: RpcMessage) {
        this.transport.send(JSON.stringify(message))
    }

    private async handleMessage(raw: string) {
        let parsed: unknown
        try {
            parsed = JSON.parse(raw)
        } catch {
            throw new RpcError(RpcErrorCode.ParseError, 'Invalid JSON')
        }

        if (!isRpcMessage(parsed)) throw new RpcError(RpcErrorCode.InvalidRequest, 'Invalid RPC message')

        if ('method' in parsed) {
            if ('id' in parsed) {
                await this.handleRequest(parsed as RpcRequest)
            } else {
                // Notifications intentionally do not generate responses.
                try {
                    await this.router.dispatch(parsed.method, parsed.params, this.context)
                } catch {
                    // JSON-RPC notifications must not receive a response.
                }
            }
            return
        }

        this.handleResponse(parsed as RpcResponse)
    }

    private async handleRequest(request: RpcRequest) {
        try {
            const result = await this.router.dispatch(request.method, request.params, this.context)
            this.send({jsonrpc: '2.0', id: request.id, result})
        } catch (error) {
            const rpcError = error instanceof RpcError
                ? error
                : new RpcError(RpcErrorCode.InternalError, asError(error).message)
            this.send({jsonrpc: '2.0', id: request.id, error: rpcError.toJSON()})
        }
    }

    private handleResponse(response: RpcResponse) {
        if (response.id === null) return
        const pending = this.pending.get(response.id)
        if (!pending) return

        clearTimeout(pending.timer)
        this.pending.delete(response.id)

        if ('error' in response) {
            pending.reject(new RpcError(response.error.code, response.error.message, response.error.data))
        } else {
            pending.resolve(response.result)
        }
    }

    private failAll(error: Error) {
        this.closed = true
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer)
            pending.reject(error)
        }
        this.pending.clear()
    }
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error))
}
