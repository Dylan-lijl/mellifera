import type { Channel } from './Channel'
import type { ChannelPipeline } from './ChannelPipeline'

export class ChannelHandlerContext {
    readonly channel: Channel<unknown>
    readonly pipeline: ChannelPipeline
    index: number
    // @ts-ignore
    readonly name: string
    constructor(
        channel: Channel<unknown>,
        pipeline: ChannelPipeline,
        index: number,
        name: string,
    ) {
        this.channel = channel
        this.pipeline = pipeline
        this.index = index
        this.name = name
    }

    // 入站事件：向后传播

    fireChannelRegistered(): Promise<void> {
        return this.pipeline.fireChannelRegisteredFrom(
            this.index + 1,
        )
    }

    fireChannelActive(): Promise<void> {
        return this.pipeline.fireChannelActiveFrom(
            this.index + 1,
        )
    }

    fireChannelInactive(): Promise<void> {
        return this.pipeline.fireChannelInactiveFrom(
            this.index + 1,
        )
    }

    fireChannelRead(data: unknown): Promise<void> {
        return this.pipeline.fireChannelReadFrom(
            this.index + 1,
            data,
        )
    }

    fireExceptionCaught(error: Error): Promise<void> {
        return this.pipeline.fireExceptionCaughtFrom(
            this.index + 1,
            error,
        )
    }

    // 出站事件：向前传播

    write(data: unknown): Promise<void> {
        return this.pipeline.writeFrom(
            this.index - 1,
            data,
        )
    }

    // 通道操作

    close(): Promise<void> {
        return this.channel.close()
    }
}