import {ChannelPipeline} from './ChannelPipeline'

export const ChannelState = {
    OPEN: 1,
    ACTIVE: 2,
    CLOSED: 3,
} as const
export type ChannelStateValueType = typeof ChannelState[keyof typeof ChannelState];

export abstract class Channel<TContext> {
    readonly pipeline: ChannelPipeline
    private readonly context: TContext;
    private _state: ChannelStateValueType = ChannelState.OPEN
    private closePromise?: Promise<void>

    protected constructor(context: TContext) {
        this.context = context;
        this.pipeline = new ChannelPipeline(
            this,
            data => this.writeRaw(data),
            (error: any) => this.onUnhandledError(error),
        )
    }

    getContext(): TContext {
        return this.context;
    }

    get state(): ChannelStateValueType {
        return this._state
    }

    get active(): boolean {
        return this._state === ChannelState.ACTIVE
    }

    get closed(): boolean {
        return this._state === ChannelState.CLOSED
    }

    /**
     * 底层 Transport 写入。
     */
    protected abstract writeRaw(data: unknown): Promise<void>

    /**
     * 底层 Transport 关闭。
     */
    protected abstract closeTransport(): Promise<void>

    /**
     * 底层连接建立后调用。
     */
    protected async activate(): Promise<void> {
        if (this._state !== ChannelState.OPEN) {
            throw new Error(
                `Cannot activate channel in state ${this._state}`,
            )
        }

        this._state = ChannelState.ACTIVE

        await this.pipeline.fireChannelActive()
    }

    /**
     * 底层收到数据后调用。
     */
    protected async receive(data: unknown): Promise<void> {
        if (!this.active) {
            throw new Error('Channel is not active')
        }

        await this.pipeline.fireChannelRead(data)
    }

    /**
     * 底层发生异常时调用。
     */
    protected async reportError(error: Error): Promise<void> {
        await this.pipeline.fireExceptionCaught(error)
    }

    /**
     * 应用层发送数据。
     */
    write(data: unknown): Promise<void> {
        if (!this.active) {
            return Promise.reject(
                new Error('Channel is not active'),
            )
        }

        return this.pipeline.write(data)
    }

    /**
     * 关闭通道。
     */
    close(): Promise<void> {
        if (this.closePromise) {
            return this.closePromise
        }

        this._state = ChannelState.CLOSED

        this.closePromise = this.doClose()

        return this.closePromise
    }

    private async doClose(): Promise<void> {
        let closeError: Error | undefined

        try {
            await this.closeTransport()
        } catch (error) {
            closeError = this.toError(error)
        }

        try {
            await this.pipeline.fireChannelInactive()
        } catch (error) {
            closeError ??= this.toError(error)
        }

        if (closeError) {
            throw closeError
        }
    }

    /**
     * Pipeline 没有 Handler 处理的异常。
     */
    protected onUnhandledError(error: any): void {
        // 默认输出到运行环境的错误处理入口。
        // 生产环境建议由子类接入日志系统。
        console.error('[Channel] Unhandled error:', error)
    }

    private toError(error: unknown): Error {
        return error instanceof Error
            ? error
            : new Error(String(error))
    }

    /**
     * 底层 Transport 已经关闭时调用。
     * 不再重复关闭底层资源。
     */
    protected async transportClosed(error?: Error): Promise<void> {
        if (this._state === ChannelState.CLOSED) {
            return
        }

        this._state = ChannelState.CLOSED

        if (error) {
            await this.reportError(error)
        }

        await this.pipeline.fireChannelInactive()
    }
}