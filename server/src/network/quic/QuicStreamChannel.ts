import type { QuicStream } from 'node:quic'

import { Channel } from '../core/Channel'
import type { QuicStreamWriter } from './QuicStreamWriter'

export interface QuicStreamChannelOptions {
    /**
     * 底层写入实现。
     */
    writer: QuicStreamWriter

    /**
     * 单次读取最大交付长度。
     *
     * 注意：这不是协议帧最大长度。
     * 一个 QUIC Stream read 可能得到任意大小的字节块。
     */
    readChunkSize?: number
}

// @ts-ignore
export class QuicStreamChannel<TContext> extends Channel<TContext> {
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>

    private readonly writer: QuicStreamWriter

    private readonly readChunkSize: number

    private started = false
    private readEnded = false

    // @ts-ignore
    private readTask?: Promise<void>

    /**
     * 写入队列。
     */
    private writeTask: Promise<void> = Promise.resolve()

    /**
     * 只用于恢复原有回调，避免覆盖调用方逻辑。
     */
    private readonly previousOnReset: typeof this.stream.onreset

    private readonly handleResetCallback: typeof this.stream.onreset
    private readonly stream: QuicStream
    constructor(
        context: TContext,
        stream: QuicStream,
        options: QuicStreamChannelOptions,
    ) {
        super(context)
        this.stream = stream;
        if (stream.direction !== 'bidi') {
            throw new Error(
                'QuicStreamChannel requires a bidirectional QUIC stream',
            )
        }

        this.writer = options.writer
        this.readChunkSize = options.readChunkSize ?? 64 * 1024

        if (
            !Number.isInteger(this.readChunkSize) ||
            this.readChunkSize <= 0
        ) {
            throw new Error('Invalid readChunkSize')
        }

        this.reader = stream.readable.getReader()

        this.previousOnReset = stream.onreset

        this.handleResetCallback = error => {
            this.previousOnReset?.call(stream, error)

            void this.handleStreamReset(error)
        }

        stream.onreset = this.handleResetCallback

        /**
         * 监听 QUIC Stream 完全关闭。
         */
        void stream.closed.then(
            () => this.handleStreamClosed(),
            error => this.handleStreamClosed(this.toError(error)),
        ).catch(error => {
            console.error('[QuicStreamChannel] Close handling failed:', error)
        })
    }

    get id(): bigint {
        return this.stream.id
    }

    get quicStream(): QuicStream {
        return this.stream
    }

    get readableEnded(): boolean {
        return this.readEnded
    }

    /**
     * 初始化 Pipeline 并启动读取。
     *
     * 必须在添加完所有 Handler 后调用。
     */
    async start(initialData?: Uint8Array): Promise<void> {
        if (this.started) {
            throw new Error('QuicStreamChannel already started');
        }

        if (this.closed) {
            throw new Error('QUIC stream already closed');
        }

        this.started = true;

        try {
            await this.pipeline.initialize();

            if (this.closed) {
                return;
            }

            await this.activate();

            if (this.closed) {
                return;
            }

            // 注入认证帧之后的预读数据
            if (initialData?.byteLength) {
                await this.pipeline.fireChannelRead(initialData);
            }

            if (this.closed) {
                return;
            }

            // 开始读取后续 QUIC Stream 数据
            this.readTask = this.readLoop();

        } catch (error) {
            const err = this.toError(error);

            await this.reportError(err);
            await this.close();

            throw err;
        }
    }

    /**
     * 底层读取循环。
     */
    private async readLoop(): Promise<void> {
        try {
            while (!this.closed) {
                const result = await this.reader.read()

                if (result.done) {
                    this.readEnded = true
                    break
                }

                if (!result.value || result.value.byteLength === 0) {
                    continue
                }

                await this.receive(result.value)
            }
        } catch (error) {
            if (!this.closed) {
                await this.reportError(this.toError(error))

                this.stream.destroy(this.toError(error))
            }
        } finally {
            this.readEnded = true

            if (this.reader) {
                try {
                    this.reader.releaseLock()
                } catch {
                    // Reader 仍被占用时不重复释放。
                }
            }
        }
    }

    /**
     * 底层写入。
     *
     * ChannelPipeline 最终会调用这个方法。
     */
    protected writeRaw(data: unknown): Promise<void> {
        if (!(data instanceof Uint8Array)) {
            return Promise.reject(
                new TypeError(
                    'QuicStreamChannel only accepts Uint8Array',
                ),
            )
        }

        if (!this.active || this.stream.destroyed) {
            return Promise.reject(
                new Error('QUIC stream is not writable'),
            )
        }

        /**
         * 串行执行写入，避免多个 Handler 的写操作交错。
         */
        const task = this.writeTask.then(async () => {
            if (!this.active || this.stream.destroyed) {
                throw new Error('QUIC stream is not writable')
            }

            await this.writer(this.stream, data)
        })

        /**
         * 队列本身不能因为一次写入失败而永久中断。
         * 当前调用仍然会收到原始失败。
         */
        this.writeTask = task.catch(() => undefined)

        return task
    }

    /**
     * 关闭底层 QUIC Stream。
     */
    protected async closeTransport(): Promise<void> {
        if (!this.stream.destroyed) {
            this.stream.destroy()
        }

        /**
         * 等待 QUIC Stream 完全关闭。
         */
        await this.stream.closed.catch(() => undefined)

        /**
         * 关闭后恢复调用方原来的回调。
         */
        if (this.stream.onreset === this.handleResetCallback) {
            this.stream.onreset = this.previousOnReset
        }
    }

    /**
     * 处理对端 Reset。
     */
    private async handleStreamReset(error: unknown): Promise<void> {
        if (this.closed) {
            return
        }

        await this.transportClosed(this.toError(error))
    }

    /**
     * 处理 Stream 完全关闭。
     */
    private async handleStreamClosed(error?: Error): Promise<void> {
        if (this.closed) {
            return
        }

        if (this.stream.onreset === this.handleResetCallback) {
            this.stream.onreset = this.previousOnReset
        }

        await this.transportClosed(error)
    }

    /**
     * 统一错误转换。
     */
    private toError(error: unknown): Error {
        return error instanceof Error
            ? error
            : new Error(String(error))
    }
}