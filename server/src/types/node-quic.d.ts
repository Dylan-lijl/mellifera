import 'node:quic';

declare module 'node:quic' {
    interface QuicStream {
        /**
         * 获取当前 QUIC Stream 的写入器。
         *
         * 仅当没有通过创建选项或 setBody() 设置 body 时可用。
         */
        readonly writer: QuicStreamWriter;
    }

    /**
     * QUIC Stream Writer。
     *
     * 用于增量写入 QUIC Stream 数据。
     */
    interface QuicStreamWriter {
        /**
         * 当前可用的写入容量。
         *
         * null 表示 Writer 已关闭或不可写。
         */
        readonly desiredSize: number | null;

        /**
         * 同步写入数据。
         *
         * @returns true 表示数据已接受，false 表示受到流量控制，
         *          false 时数据不会被接受。
         */
        writeSync(chunk: Uint8Array | string): boolean;

        /**
         * 异步写入数据。
         *
         * 等待流控解除后完成写入。
         */
        write(
            chunk: Uint8Array | string,
            options?: QuicStreamWriter.WriteOptions,
        ): Promise<void>;

        /**
         * 同步批量写入。
         *
         * 所有数据要么全部接受，要么全部不接受。
         */
        writevSync(
            chunks: Iterable<Uint8Array | string>,
        ): boolean;

        /**
         * 异步批量写入。
         */
        writev(
            chunks: Iterable<Uint8Array | string>,
            options?: QuicStreamWriter.WriteOptions,
        ): Promise<void>;

        /**
         * 同步结束写入。
         *
         * @returns 总写入字节数，失败时返回 -1。
         */
        endSync(): number;

        /**
         * 异步结束写入。
         *
         * 等待已排队的数据发送完成。
         */
        end(
            options?: QuicStreamWriter.EndOptions,
        ): Promise<void>;

        /**
         * 使 Writer 进入错误状态，并向对端发送 RESET_STREAM。
         */
        fail(reason?: unknown): void;
    }

    namespace QuicStreamWriter {
        interface WriteOptions {
            /**
             * 取消尚未开始的写入操作。
             */
            signal?: AbortSignal;
        }

        interface EndOptions {
            /**
             * 取消信号。
             */
            signal?: AbortSignal;
        }
    }
}