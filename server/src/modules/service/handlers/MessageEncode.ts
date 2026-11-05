import type {ChannelHandler} from "@/network/core/ChannelHandler";
import type {ChannelHandlerContext} from "@/network/core/ChannelHandlerContext";
import type { RpcResponse} from "@/rpc/protocol/RpcProtocol";

/**
 * 编码器
 */
export class MessageEncode implements ChannelHandler {
    private readonly encoder = new TextEncoder();

    async write(
        ctx: ChannelHandlerContext,
        message: RpcResponse,
    ): Promise<void> {
        try {
            const data = this.encoder.encode(JSON.stringify(message));
            await ctx.write(data);
        } catch (error) {
            await ctx.fireExceptionCaught(
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }
}