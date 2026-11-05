import type {ConnectionHandler, ConnectionContext} from './ConnectionHandler';

export class DataConnectionHandler implements ConnectionHandler {

    async handle(_context: ConnectionContext): Promise<void> {
        // const {session, stream, auth, initialData} = context;

        // 1. 验证数据连接绑定凭证
        // const binding = await this.connectionManager.authenticateData(auth.token);

        // 2. 确认绑定的控制连接仍然有效
        // if (!binding.controlConnection.active) {
        //     throw new Error('Control connection is unavailable');
        // }

        // 3. 创建 QuicSessionContext
        // 4. 创建数据 Channel
        // 5. 安装数据 Pipeline
        // 6. 绑定到对应控制连接
        // 7. 启动 Channel

        // TODO: 接入实际认证和 Channel 实现
    }
}