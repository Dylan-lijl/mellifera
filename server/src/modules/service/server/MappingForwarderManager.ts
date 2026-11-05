import type {Socket} from "node:net";

import type { RemoteInfo } from 'node:dgram'

export interface MappingForwarder {
    /**
     * 转发 TCP 连接
     *
     * socket 是外部访问者与服务端之间的 TCP 连接。
     * 方法负责接管 socket 的生命周期。
     */
    openTcp(socket: Socket): Promise<void>

    /**
     * 转发 UDP 数据报
     *
     * remoteInfo 表示外部发送者的地址和端口。
     * 同一个来源地址和端口应复用对应的 UDP 会话。
     */
    forwardUdp(data: Buffer, remoteInfo: RemoteInfo): Promise<void>

    /**
     * 关闭转发器
     *
     * 释放该映射下所有 TCP/UDP 转发会话。
     */
    close(): Promise<void>
}
