import {
    transportProtocol,
    type TransportProtocolType,
} from '@mellifera/common/constant';

import net, {
    type Server,
    type Socket,
} from 'node:net';

import dgram, {
    type Socket as DatagramSocket,
    type RemoteInfo,
} from 'node:dgram';

type RuntimeData = {
    id: number;
    server: Server | DatagramSocket;
};

type RuntimeLine = {
    tcp?: RuntimeData;
    udp?: RuntimeData;
};

type ListenerConfig = {
    port: number;
    type: TransportProtocolType;
    id: number;
    skipPorts?: string | null;
};

type ListenerResult = {
    /** 成功创建的原始配置索引 */
    listening: number[];

    /** 创建失败的原始配置索引 */
    error: number[];

    /** 配置索引 -> 实际监听端口 */
    ports: Map<number, number>;
};

const MAX_RANDOM_RETRIES = 32;
type PortRange = number | {
    min: number;
    max: number;
};

function parseSkipPorts(value?: string|null): PortRange[] {
    if (!value) {
        return [];
    }

    const result: PortRange[] = [];

    for (const item of value.split(',')) {
        const part = item.trim();

        if (!part) {
            continue;
        }

        if (!part.includes('-')) {
            const port = Number(part);

            if (Number.isInteger(port) && port >= 1 && port <= 65535) {
                result.push(port);
            }

            continue;
        }

        const split = part.split('-');

        if (split.length !== 2) {
            continue;
        }

        const min = Number(split[0].trim());
        const max = Number(split[1].trim());

        if (
            Number.isInteger(min) &&
            Number.isInteger(max) &&
            min >= 1 &&
            max <= 65535 &&
            min <= max
        ) {
            result.push({ min, max });
        }
    }

    return result;
}

function rangePorts(
    port: number,
    skipPorts: PortRange[]
): boolean {
    return skipPorts.some(line => {
        if (typeof line === 'number') {
            return line === port;
        }

        return port >= line.min && port <= line.max;
    });
}
export default {
    /**
     * key 为实际监听端口。
     *
     * TCP 和 UDP 可以同时监听相同端口。
     */
    map: new Map<number, RuntimeLine>(),

    /**
     * TCP 连接回调
     */
    onConnection: undefined as
        | ((id: number, socket: Socket) => void)
        | undefined,

    /**
     * UDP 消息回调
     */
    onMessage: undefined as
        | ((id: number, message: Buffer, rinfo: RemoteInfo) => void)
        | undefined,

    /**
     * 监听错误回调
     */
    onError: undefined as
        | ((id: number, error: Error) => void)
        | undefined,

    /**
     * 批量创建监听
     */
    async addListeners(
        ports: ListenerConfig[]
    ): Promise<ListenerResult> {

        const result: ListenerResult = {
            listening: [],
            error: [],
            ports: new Map(),
        };

        const tasks: Promise<void>[] = [];

        for (let i = 0; i < ports.length; i++) {
            const item = ports[i];

            tasks.push(
                this.addListener(item, i, result)
            );
        }

        await Promise.all(tasks);

        return result;
    },
    /**
     * 关闭 TCP Server，并等待关闭完成
     */
    async closeTcp(server: Server): Promise<void> {
        if (!server.listening) {
            return;
        }

        await new Promise<void>(resolve => {
            server.close(() => resolve());
        });
    },

    /**
     * 关闭 UDP Socket
     */
    closeUdp(socket: DatagramSocket): void {
        try {
            socket.close();
        } catch {
            // 已经关闭
        }
    },
    /**
     * 创建单个监听
     */
    async addListener(item: ListenerConfig, index: number, result: ListenerResult): Promise<void> {
        try {
            if (!Number.isInteger(item.port) || item.port > 65535) {
                throw new Error(`Invalid port: ${item.port}`);
            }

            if (!Number.isInteger(item.id)) {
                throw new Error(`Invalid listener id: ${item.id}`);
            }

            const isTcp = item.type === transportProtocol.tcp.value;
            const isUdp = item.type === transportProtocol.udp.value;

            if (!isTcp && !isUdp) {
                throw new Error(`Unsupported protocol: ${item.type}`);
            }

            const slot = isTcp ? 'tcp' : 'udp';

            /**
             * 检查指定端口是否已经存在相同协议的监听。
             *
             * 负数端口表示动态分配，不在这里检查。
             */
            if (item.port >= 0) {
                const line = this.map.get(item.port);

                if (line?.[slot]) {
                    throw new Error(
                        `${slot.toUpperCase()} port already occupied: ${item.port}`
                    );
                }
            }
            const runtime = isTcp ? await this.createTcp(item) : await this.createUdp(item);
            /**
             * 实际监听端口。
             * 动态端口可能与配置端口不同。
             */
            const address = runtime.server.address();

            if (!address || typeof address === 'string') {
                throw new Error('Unable to get listener address');
            }

            const actualPort = address.port;

            /**
             * 二次检查，防止并发动态分配时发生管理层冲突。
             */
            let line = this.map.get(actualPort);

            if (line?.[slot]) {
                this.closeServer(runtime.server);

                throw new Error(
                    `${slot.toUpperCase()} port already registered: ${actualPort}`
                );
            }

            if (!line) {
                line = {};
                this.map.set(actualPort, line);
            }

            line[slot] = runtime;

            result.listening.push(index);
            result.ports.set(index, actualPort);

        } catch (error) {
            result.error.push(index);

            this.onError?.(
                item.id,
                error instanceof Error
                    ? error
                    : new Error(String(error))
            );
        }
    },

    /**
     * 创建 TCP Server
     */
    async createTcp(
        item: ListenerConfig
    ): Promise<RuntimeData> {

        const dynamic = item.port < 0;
        const skipPorts = parseSkipPorts(item.skipPorts);
        for (let attempt = 0; attempt < (dynamic ? MAX_RANDOM_RETRIES : 1); attempt++) {
            const server = net.createServer();
            server.on('connection', socket => {
                this.onConnection?.(item.id, socket);
            });

            const port = dynamic ? 0 : item.port;

            try {
                await new Promise<void>((resolve, reject) => {

                    const onListening = () => {
                        server.off('error', onStartError);
                        resolve();
                    };

                    const onStartError = (error: Error) => {
                        server.off('listening', onListening);
                        reject(error);
                    };

                    server.once('listening', onListening);
                    server.once('error', onStartError);

                    server.listen({
                        port,
                        host: '0.0.0.0',
                    });
                });

                server.on('error', error => {
                    this.onError?.(item.id, error);
                });

                const address = server.address();

                if (!address || typeof address === 'string') {
                    throw new Error('Unable to get TCP listener address');
                }

                if (dynamic && rangePorts(address.port,skipPorts)) {
                    await this.closeTcp(server);
                    continue;
                }

                return {
                    id: item.id,
                    server,
                };

            } catch (error) {
                await this.closeTcp(server);
                throw error;
            }
        }

        throw new Error('Unable to allocate an available TCP port');
    },

    /**
     * 创建 UDP Socket
     */
    async createUdp(
        item: ListenerConfig
    ): Promise<RuntimeData> {
        const dynamic = item.port < 0;
        const skipPorts =parseSkipPorts(item.skipPorts);
        for (let attempt = 0; attempt < (dynamic ? MAX_RANDOM_RETRIES : 1); attempt++) {
            const socket = dgram.createSocket('udp4');
            socket.on('message', (message, rinfo) => {
                this.onMessage?.(item.id, message, rinfo);
            });
            const port = dynamic ? 0 : item.port;
            try {
                await new Promise<void>((resolve, reject) => {

                    const onListening = () => {
                        socket.off('error', onStartError);
                        resolve();
                    };

                    const onStartError = (error: Error) => {
                        socket.off('listening', onListening);
                        reject(error);
                    };

                    socket.once('listening', onListening);
                    socket.once('error', onStartError);

                    socket.bind({
                        port,
                        address: '0.0.0.0',
                    });
                });

                socket.on('error', error => {
                    this.onError?.(item.id, error);
                });

                const address = socket.address();

                if (dynamic && rangePorts(address.port,skipPorts)) {
                    this.closeUdp(socket);
                    continue;
                }

                return {
                    id: item.id,
                    server: socket,
                };

            } catch (error) {
                this.closeUdp(socket);
                throw error;
            }
        }
        throw new Error('Unable to allocate an available UDP port');
    },

    /**
     * 关闭指定 Socket
     */
    closeServer(server: Server | DatagramSocket): void {

        if (server instanceof net.Server) {
            if (server.listening) {
                server.close();
            }
            return;
        }

        try {
            server.close();
        } catch {
            // UDP Socket 可能已经关闭
        }
    },

    /**
     * 根据端口和协议关闭监听
     */
    async removeListener(
        port: number,
        type: TransportProtocolType
    ): Promise<boolean> {

        const line = this.map.get(port);

        if (!line) {
            return false;
        }

        const isTcp = type === transportProtocol.tcp.value;
        const isUdp = type === transportProtocol.udp.value;

        if (!isTcp && !isUdp) {
            return false;
        }

        const slot = isTcp ? 'tcp' : 'udp';
        const runtime = line[slot];

        if (!runtime) {
            return false;
        }

        delete line[slot];

        if (!line.tcp && !line.udp) {
            this.map.delete(port);
        }

        await new Promise<void>(resolve => {

            if (runtime.server instanceof net.Server) {

                if (!runtime.server.listening) {
                    resolve();
                    return;
                }

                runtime.server.close(() => resolve());

                return;
            }

            try {
                runtime.server.close();
                resolve();
            } catch {
                resolve();
            }
        });

        return true;
    },

    /**
     * 根据实例 ID 关闭监听
     */
    async removeById(id: number): Promise<number[]> {

        const tasks: Promise<void>[] = [];
        const removed: number[] = [];

        for (const [port, line] of this.map) {

            if (line.tcp?.id === id) {
                tasks.push(
                    this.removeListener(
                        port,
                        transportProtocol.tcp.value
                    ).then(() => {
                        removed.push(port);
                    })
                );
            }

            if (line.udp?.id === id) {
                tasks.push(
                    this.removeListener(
                        port,
                        transportProtocol.udp.value
                    ).then(() => {
                        removed.push(port);
                    })
                );
            }
        }

        await Promise.all(tasks);

        return removed;
    },

    /**
     * 关闭全部监听
     */
    async closeAll(): Promise<void> {

        const tasks: Promise<boolean>[] = [];

        for (const [port, line] of this.map) {

            if (line.tcp) {
                tasks.push(
                    this.removeListener(
                        port,
                        transportProtocol.tcp.value
                    )
                );
            }

            if (line.udp) {
                tasks.push(
                    this.removeListener(
                        port,
                        transportProtocol.udp.value
                    )
                );
            }
        }

        await Promise.all(tasks);
    },
};
