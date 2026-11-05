import type {ChannelHandlerContext} from "@/network/core/ChannelHandlerContext";
import {AbstractChannelHandler} from "@/network/core/AbstractChannelHandler";

export class ExceptionHandler extends AbstractChannelHandler {

    async exceptionCaught(
        ctx: ChannelHandlerContext,
        error: Error,
    ): Promise<void> {
        // 记录异常
        console.error('[Network] Pipeline error:', error);
        // 继续向后传播异常
        await ctx.fireExceptionCaught(error);
    }
}