import type { ChannelHandlerContext } from './ChannelHandlerContext'

export interface ChannelHandler {
    channelRegistered?(
        ctx: ChannelHandlerContext,
    ): Promise<void> | void

    channelActive?(
        ctx: ChannelHandlerContext,
    ): Promise<void> | void

    channelInactive?(
        ctx: ChannelHandlerContext,
    ): Promise<void> | void

    channelRead?(
        ctx: ChannelHandlerContext,
        data: unknown,
    ): Promise<void> | void

    write?(
        ctx: ChannelHandlerContext,
        data: unknown,
    ): Promise<void> | void

    exceptionCaught?(
        ctx: ChannelHandlerContext,
        error: Error,
    ): Promise<void> | void
}