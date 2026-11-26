import type {DatagramEndpoint, NetEndpoint, NetworkServerContext} from "@/types/network";
import StateSyncManager from "@/StateSyncManager";
import {logger} from "@/utils";
import MapPortServiceManager from "@/network/MapPortServiceManager";

export class GlobalNetworkManager {
    commandMap = new Map<number, NetworkServerContext>()
    dataMap = new Map<number, NetworkServerContext[]>()

    async disconnectCommand(command: NetworkServerContext) {
        const connected = StateSyncManager.getState().server.connected;
        const clientId = command.variable?.id;
        if (clientId === undefined) {
            command.available = false;
            this.shutdown(command.getEndpoint());
            return;
        }
        // 1. 清理客户端在线状态
        connected.delete(clientId);
        // 2. 删除数据连接映射
        const dataList = this.dataMap.get(clientId);
        this.dataMap.delete(clientId);

        // 3. 关闭关联的数据连接
        if (dataList) {
            for (const data of dataList) {
                data.available = false;
                this.shutdown(data.getEndpoint());
            }
        }
        // 4. 关闭命令连接
        command.available = false;
        this.shutdown(command.getEndpoint());
        // 5. 查找需要关闭的端口映射
        const mappingIds = new Set<number>();
        for (const mapping of MapPortServiceManager.map.values()) {
            if (
                mapping.tcp?.clientId === clientId &&
                mapping.tcp.id !== undefined
            ) {
                mappingIds.add(mapping.tcp.id);
            }

            if (
                mapping.udp?.clientId === clientId &&
                mapping.udp.id !== undefined
            ) {
                mappingIds.add(mapping.udp.id);
            }
        }
        // 6. 关闭对外端口监听
        for (const id of mappingIds) {
            try {
                await MapPortServiceManager.removeById(id);
            } catch (error) {
                logger.error(`关闭端口映射失败，ID: ${id}`, error);
            }
        }
    }

    // 统一关闭网络 Endpoint
    private shutdown(endpoint: NetEndpoint | DatagramEndpoint | undefined) {
        if (!endpoint) {
            return;
        }

        try {
            if (endpoint.type === 'socket') {
                if (!endpoint.endpoint.destroyed) {
                    endpoint.endpoint.destroy();
                }
            } else if (endpoint.type === 'datagram') {
                endpoint.endpoint.close();
            }
        } catch (error) {
            logger.warn('关闭网络连接失败:', error);
        }
    }
}

export default new GlobalNetworkManager();