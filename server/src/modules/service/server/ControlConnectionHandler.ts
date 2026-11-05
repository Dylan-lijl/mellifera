import type {QuicStream} from 'node:quic';
import type {
    ConnectionContext,
    ConnectionHandler,
} from './ConnectionHandler';
import {ClientEntity} from "@/db/ClientEntity";
import {QuicStreamChannel} from "@/network/quic/QuicStreamChannel";
import {ExceptionHandler} from "@/modules/service/handlers/ExceptionHandler";
import {MessageEncode} from "@/modules/service/handlers/MessageEncode";
import {MessageDecode} from "@/modules/service/handlers/MessageDecode";
import {ServerCommandDispatcher} from "@/modules/service/handlers/ServerCommandDispatcher";
import * as controllers from '../controllers/server/command';

export interface ClientAuthContext {
    clientId: number;
    enabled: boolean;
    token: string;
}

export interface AuthenticateResult {
    key: number;
    context: ClientAuthContext;
}

export interface QuicSessionContext {
    clientId: number;
}

export class ControlConnectionHandler implements ConnectionHandler {

    async handle(context: ConnectionContext): Promise<void> {
        const {stream, auth, initialData} = context;

        // 1. 验证客户端 Token
        const result = await this.authenticate(auth.token);

        if (!result) {
            throw new Error('Client authentication failed');
        }


        // 3. 创建 Stream Channel
        const channel = new QuicStreamChannel<QuicSessionContext>(
            {clientId: result.context.clientId},
            stream,
            {writer: this.createWriter(),});

        // 4. 初始化控制连接 Pipeline
        await this.initializePipeline(channel);

        // 5. 启动 Channel，并注入认证帧之后的预读数据
        await channel.start(initialData);
    }

    /**
     * 验证客户端
     */
    private async authenticate(
        token: string,
    ): Promise<AuthenticateResult | null> {
        if (!token) {
            return null;
        }

        const item = await ClientEntity.findOne({
            where: {token},
        });

        if (!item || !item.enabled) {
            return null;
        }

        return {
            key: item.id,
            context: {
                clientId: item.id,
                enabled: item.enabled,
                token,
            },
        };
    }

    /**
     * 初始化控制连接 Pipeline
     */
    private async initializePipeline(
        channel: QuicStreamChannel<unknown>,
    ) {
        const pipeline = channel.pipeline;
        pipeline.addLast("exception", new ExceptionHandler())
            .addLast("decode", new MessageDecode())
            .addLast("dispatcher", new ServerCommandDispatcher(controllers))
            .addLast("encode", new MessageEncode())
        await pipeline.initialize();
    }

    /**
     * 创建底层 Stream 写入器
     *
     * Node QUIC QuicStream 没有标准的 write() 方法，
     * 这里应接入项目已经确定的底层写入实现。
     */
    private createWriter() {
        return async (stream: QuicStream, data: Uint8Array) => {
            await stream.writer.write(data)
        };
    }
}