import type {QuicStream} from "node:quic";

/**
 * 向 QUIC Stream 写入字节。
 *
 * 由底层 Node QUIC API 适配器实现。
 */
export type QuicStreamWriter = (
    stream:QuicStream,
    data: Uint8Array,
) => Promise<void>