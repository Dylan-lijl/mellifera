import {getData, saveData} from "@/utils/Store";
import StateSyncManager from "@/StateSyncManager";
import {type ByIdRequest, type ServerConfig} from "@mellifera/common/entity";
import {networkType, runState} from "@mellifera/common/constant";
import {ResultApiException} from "@mellifera/common/CustomException";
import manager from "@/network/GlobalNetworkManager";
import {
    FAILED_TO_START,
    FAILED_TO_STOP,
    DATA_NOT_FOUND_EXCEPTION,
    INVALID_PORT,
} from "@mellifera/common/ResultCode";
import type {NetworkIpInfo} from "@mellifera/common/types";
import * as os from "node:os";
import {isIP} from "node:net";
import type {StateData} from "@mellifera/common/stateSync";
import {TcpAndUdpServerBootstrap} from "@/network/server/TcpAndUdpServerBootstrap";
import commandControllers from './controllers/server/command'
import clientCommandControllers from './controllers/client/command'
import dataControllers from './controllers/server/data'
import {getOrCreateRpcProxy} from "@/network/RpcDispatcher";
import mapPortServiceManager from "@/network/MapPortServiceManager";
import {logger} from "@/utils";

function resetState(state: StateData): void {
    state.server.running = runState.idle.value;
    state.server.host = null;
    state.server.port = null;
    state.server.error = null;
    state.server.connected.clear();
}

export class ServerService {
    private server: TcpAndUdpServerBootstrap = null as unknown as TcpAndUdpServerBootstrap;

    constructor() {
    }

    getConfig = async () => {
        return getData("server") as ServerConfig
    }

    saveConfig = async (config: ServerConfig) => {
        saveData("server", config);
    }

    getNetworkIpInfos = async () => {
        const interfaces = os.networkInterfaces()
        const result: NetworkIpInfo[] = []

        for (const [name, addresses] of Object.entries(interfaces)) {
            for (const info of addresses ?? []) {
                const family = isIP(info.address)
                if (family !== 4 && family !== 6) {
                    continue
                }
                // 这类地址通常还需要网卡作用域 ID 才能用于连接。
                if (family === 6 && info.address.startsWith('fe80:')) {
                    continue
                }
                result.push({
                    name,
                    address: info.address,
                    family,
                    internal: info.internal,
                    netmask: info.netmask,
                    cidr: info.cidr
                        ? Number(info.cidr.split('/').at(-1))
                        : null,
                    mac: info.mac,
                })
            }
        }
        return result
    }

    start = async () => {
        if (StateSyncManager.getState().server.running !== runState.idle.value) {
            return;
        }
        StateSyncManager.getState().server.running = runState.starting.value;
        try {
            const config = await this.getConfig();
            if (!config) {
                throw new ResultApiException({...DATA_NOT_FOUND_EXCEPTION, other: '服务配置不存在'})
            }
            const host = this.getListenHosts(config);
            if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
                throw new ResultApiException({...INVALID_PORT})
            }
            this.server = new TcpAndUdpServerBootstrap({
                commandControllers,
                dataControllers,
            });
            await this.server.listen(host, config.port);
            StateSyncManager.getState().server.running = runState.running.value;
            StateSyncManager.getState().server.port = config.port;
            StateSyncManager.getState().server.host = host;
            StateSyncManager.getState().server.error = null;
        } catch (e) {
            resetState(StateSyncManager.getState());
            StateSyncManager.getState().server.error = e instanceof Error ? e.message : e + "";
            throw new ResultApiException({...FAILED_TO_START, other: StateSyncManager.getState().server.error});
        }
    }
    private stopPromise?: Promise<void>;

    stop = async (): Promise<void> => {
        // 防止并发停止
        if (this.stopPromise) {
            return this.stopPromise;
        }
        const state = StateSyncManager.getState().server;

        // 只有 running 状态允许停止
        if (state.running !== runState.running.value) {
            return;
        }

        this.stopPromise = this.doStop();

        try {
            await this.stopPromise;
        } finally {
            this.stopPromise = undefined;
        }
    };

    private async doStop(): Promise<void> {
        const serverState = StateSyncManager.getState().server;

        serverState.running = runState.stopping.value;
        serverState.error = null;

        const errors: string[] = [];

        // 统一捕获单项清理异常
        const execute = async (
            name: string,
            action: () => Promise<unknown> | unknown,
        ) => {
            try {
                await action();
            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : String(error);

                errors.push(`${name}: ${message}`);
                logger.error(`[Server Stop] ${name}失败:`, error);
            }
        };

        try {
            // 1. 获取连接快照，避免遍历期间 Map 被修改
            const commands = [...manager.commandMap.values()];

            // 2. 通知所有客户端
            await Promise.all(
                commands.map(command =>
                    execute(
                        `通知客户端 ${command.variable?.id}`,
                        async () => {
                            await getOrCreateRpcProxy(
                                clientCommandControllers,
                                command,
                            )?.connection?.disconnect();
                        },
                    ),
                ),
            );

            // 3. 清理所有客户端连接
            await Promise.all(
                commands.map(command =>
                    execute(
                        `断开客户端 ${command.variable?.id}`,
                        () => manager.disconnectCommand(command),
                    ),
                ),
            );

            // 4. 关闭网络服务
            await execute(
                '关闭网络服务',
                async () => {
                    await this.server?.close();
                },
            );

            // 5. 关闭所有端口映射
            await execute(
                '关闭端口映射',
                async () => {
                    await mapPortServiceManager.closeAll();
                },
            );

            // 6. 判断是否全部成功
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }

            // 7. 全部成功后重置状态
            resetState(StateSyncManager.getState());

        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : String(error);

            serverState.running = runState.idle.value;
            serverState.error = message;

            throw new ResultApiException({
                ...FAILED_TO_STOP,
                other: message,
            });
        }
    };

    private getListenHosts = (config: ServerConfig) => {
        switch (config.mode) {
            case networkType.all.value:
                return '::';

            case networkType.loopback.value:
                return '::1';

            case networkType.selected.value: {
                return config.host!;
            }
            default:
                throw new Error(`不支持的监听模式：${config.mode}`);
        }
    }

    disconnect = async (request: ByIdRequest) => {
        const item = manager.commandMap.get(request.id);
        if (!item) {
            return
        }
        try {
            await getOrCreateRpcProxy(clientCommandControllers, item).connection.disconnect()
        } finally {
            await manager.disconnectCommand(item);
        }
    }
    findClientIdByToken = (token: any) => {
        /*const item = this.server?.findByToken(token)?.peer;
        if (!item) {
            throw new ResultApiException(NOT_CONNECTED);
        }
        return item.getContext().clientId;*/
        return token.length;
    }
}

export default new ServerService();