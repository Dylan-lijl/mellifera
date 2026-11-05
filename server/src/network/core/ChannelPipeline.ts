import type { Channel } from './Channel'
import type { ChannelHandler } from './ChannelHandler'
import { ChannelHandlerContext } from './ChannelHandlerContext'

interface HandlerEntry {
    readonly name: string
    readonly handler: ChannelHandler
    readonly context: ChannelHandlerContext
}

export class ChannelPipeline {
    private readonly handlers: HandlerEntry[] = []
    private initialized = false

    private readonly channel: Channel
    private readonly writeRaw: (data: unknown,) => Promise<void>
    private readonly onUnhandledError: (error: Error,) => void

    constructor(channel: Channel, writeRaw: (data: unknown,) => Promise<void>, onUnhandledError: (error: Error,) => void,) {
        this.channel = channel
        this.writeRaw = writeRaw
        this.onUnhandledError = onUnhandledError
    }

    addLast(name: string, handler: ChannelHandler): this {
        if (this.initialized) {
            throw new Error('Pipeline already initialized')
        }

        if (!name.trim() || this.handlers.some(item => item.name === name)) {
            throw new Error(`Invalid or duplicate handler name: ${name}`)
        }

        const index = this.handlers.length
        const context = new ChannelHandlerContext(
            this.channel,
            this,
            index,
            name,
        )

        this.handlers.push({ name, handler, context })
        return this
    }

    get(name: string): ChannelHandler | undefined {
        return this.handlers.find(item => item.name === name)?.handler
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            throw new Error('Pipeline already initialized')
        }

        this.initialized = true
        await this.fireChannelRegistered()
    }

    // Inbound

    async fireChannelRegistered(): Promise<void> {
        await this.fireChannelRegisteredFrom(0)
    }

    async fireChannelRegisteredFrom(index: number): Promise<void> {
        const entry = this.handlers[index]
        if (!entry) return

        await this.invokeInbound(
            entry,
            entry.handler.channelRegistered
                ? () => entry.handler.channelRegistered!(entry.context)
                : undefined,
            () => this.fireChannelRegisteredFrom(index + 1),
        )
    }

    async fireChannelActive(): Promise<void> {
        await this.fireChannelActiveFrom(0)
    }

    async fireChannelActiveFrom(index: number): Promise<void> {
        const entry = this.handlers[index]
        if (!entry) return

        await this.invokeInbound(
            entry,
            entry.handler.channelActive
                ? () => entry.handler.channelActive!(entry.context)
                : undefined,
            () => this.fireChannelActiveFrom(index + 1),
        )
    }

    async fireChannelInactive(): Promise<void> {
        await this.fireChannelInactiveFrom(0)
    }

    async fireChannelInactiveFrom(index: number): Promise<void> {
        const entry = this.handlers[index]
        if (!entry) return

        await this.invokeInbound(
            entry,
            entry.handler.channelInactive
                ? () => entry.handler.channelInactive!(entry.context)
                : undefined,
            () => this.fireChannelInactiveFrom(index + 1),
        )
    }

    async fireChannelRead(data: unknown): Promise<void> {
        await this.fireChannelReadFrom(0, data)
    }

    async fireChannelReadFrom(
        index: number,
        data: unknown,
    ): Promise<void> {
        const entry = this.handlers[index]
        if (!entry) return

        await this.invokeInbound(
            entry,
            entry.handler.channelRead
                ? () => entry.handler.channelRead!(entry.context, data)
                : undefined,
            () => this.fireChannelReadFrom(index + 1, data),
        )
    }

    private async invokeInbound(
        entry: HandlerEntry,
        invoke: (() => Promise<void> | void) | undefined,
        next: () => Promise<void>,
    ): Promise<void> {
        if (!invoke) {
            await next()
            return
        }

        try {
            await invoke()
        } catch (error) {
            await this.fireExceptionCaughtFrom(
                entry.context.index + 1,
                this.toError(error),
            )
        }
    }

    // Outbound

    async write(data: unknown): Promise<void> {
        await this.writeFrom(this.handlers.length - 1, data)
    }

    async writeFrom(index: number, data: unknown): Promise<void> {
        if (index < 0) {
            await this.writeRaw(data)
            return
        }

        const entry = this.handlers[index]
        if (!entry) {
            await this.writeFrom(index - 1, data)
            return
        }

        const callback = entry.handler.write

        if (!callback) {
            await this.writeFrom(index - 1, data)
            return
        }

        try {
            await callback.call(entry.handler, entry.context, data)
        } catch (error) {
            const err = this.toError(error)

            await this.fireExceptionCaughtFrom(
                index + 1,
                err,
            )

            throw err
        }
    }

    // Exception

    async fireExceptionCaught(error: Error): Promise<void> {
        await this.fireExceptionCaughtFrom(0, error)
    }

    async fireExceptionCaughtFrom(
        index: number,
        error: Error,
    ): Promise<void> {
        const entry = this.handlers[index]

        if (!entry) {
            this.onUnhandledError(error)
            return
        }

        const callback = entry.handler.exceptionCaught

        if (!callback) {
            await this.fireExceptionCaughtFrom(index + 1, error)
            return
        }

        try {
            await callback.call(entry.handler, entry.context, error)
        } catch (nextError) {
            await this.fireExceptionCaughtFrom(
                index + 1,
                this.toError(nextError),
            )
        }
    }

    private toError(error: unknown): Error {
        return error instanceof Error
            ? error
            : new Error(String(error))
    }
}