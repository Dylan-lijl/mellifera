import {getData, saveData} from "@/utils/Store";
import StateSyncManager from "@/StateSyncManager";
import {type ServerConfig, type TokenRequest} from "@mellifera/common/entity";
import {networkType, runState} from "@mellifera/common/constant";
import {ResultApiException} from "@mellifera/common/CustomException";
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
import dataControllers from './controllers/server/data'

function resetState(state: StateData): void {
    state.server.running = runState.idle.value;
    state.server.host = null;
    state.server.port = null;
    state.server.error = null;
    state.server.connected = [];
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

    stop = async () => {
        if (StateSyncManager.getState().server.running !== runState.running.value) {
            return
        }
        const old = StateSyncManager.getState().server.running;
        StateSyncManager.getState().server.running = runState.stopping.value;
        try {
            await this.server?.close();
            resetState(StateSyncManager.getState())
        } catch (e) {
            StateSyncManager.getState().server.running = old;
            StateSyncManager.getState().server.error = e instanceof Error ? e.message : e + "";
            throw new ResultApiException({...FAILED_TO_STOP, other: StateSyncManager.getState().server.error});
        }
    }

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

    disconnect = async (request: TokenRequest) => {
        // await this.server?.closeItem(request.token);
        request
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