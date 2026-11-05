import type {ChannelHandler} from "@/network/core/ChannelHandler";
import type {ChannelHandlerContext} from "@/network/core/ChannelHandlerContext";
import type { RpcNotification, RpcRequest} from "@/rpc/protocol/RpcProtocol";

/**
 * 解码器
 */
export class MessageDecode implements ChannelHandler{
    private readonly decoder = new TextDecoder();

    async channelRead(
        ctx: ChannelHandlerContext,
        data: Uint8Array,
    ): Promise<void> {
        try {
            const text = this.decoder.decode(data);
            const message = JSON.parse(text) as RpcRequest | RpcNotification;
            await ctx.fireChannelRead(message);
        } catch (error) {
            await ctx.fireExceptionCaught(
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }
}