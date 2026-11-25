import manager from "@/network/GlobalNetworkManager";
import type {ContextAware, NetworkServerContext} from "@/types/network";
import {MappingEntity} from "@/db/MappingEntity";
import {ClientEntity} from "@/db/ClientEntity";
import mapPortServiceManager from "@/network/MapPortServiceManager";
import {logger} from "@/utils";
import {transportProtocolOptions} from "@mellifera/common/constant";
import {defineController, RpcMethod} from "@/utils/network";
import {registerControllers} from "@/network/RpcDispatcher";
import controllers, {UserController as DataUserController} from '../data'

export const UserController = defineController("user",
    class UserController implements ContextAware<NetworkServerContext> {
        context: NetworkServerContext = null as unknown as NetworkServerContext;

        @RpcMethod()
        async auth(request: { token: string, type: 1 | 2 }) {
            const client = await ClientEntity.findOne({
                where: {
                    token: request.token
                }
            })
            if (!client) {
                throw new Error("No connection found for this request");
            }
            if (!client.enabled) {
                throw new Error("No connection enabled for this request");
            }
            //重构成数据连接
            if (request.type === 2) {
                registerControllers(controllers, this.context, true)
                //临时处理掉
                const u = new DataUserController();
                u.setContext(this.context);
                await u.auth(request)
                return
            }
            const old = manager.commandMap.get(client.id);
            if (old != null) {
                const endpoint = old.getEndpoint();
                if (endpoint.type === 'socket') {
                    endpoint.endpoint.destroy();
                } else if (endpoint.type === 'datagram') {
                    endpoint.endpoint.close();
                }
                manager.commandMap.delete(client.id);
                //这里还要做清理事件
            }
            manager.commandMap.set(client.id, this.context);
            // 异步开启监听（不阻塞当前主流程，但完整捕获异常）
            void (async () => {
                const findTransportLabel = (value: number) =>
                    transportProtocolOptions.find((i) => i.value === value)?.label ?? "未知";
                try {
                    const items = await MappingEntity.findAll({
                        where: {
                            clientId: client.id,
                            enabled: true,
                        },
                    });

                    if (items.length === 0) {
                        logger.info(`客户端 ${client.id} 无启用的端口映射，跳过监听`);
                        return;
                    }
                    // TODO: 还有监听回调处理
                    const result = await mapPortServiceManager.addListeners(
                        items.map((o) => ({
                            id: o.id,
                            port: o.listenPort,
                            skipPorts: o.disabledPorts,
                            type: o.protocol,
                        }))
                    );
                    if (result.error?.length) {
                        const errorDetails = result.error
                            .map((index) => {
                                const item = items[index];
                                if (!item) return `index=${index}`;
                                return `${item.id}. ${findTransportLabel(item.protocol)}/${item.listenPort}`;
                            })
                            .join(";");
                        logger.warn(`监听失败:${errorDetails}`);
                    }
                    if (result.listening?.length) {
                        const listeningDetails = result.listening
                            .map((index) => {
                                const item = items[index];
                                if (!item) return `index=${index}`;
                                const boundPort = result.ports?.get(index);
                                const portSuffix = boundPort ? `(${boundPort})` : "";
                                return `${item.id}. ${findTransportLabel(item.protocol)}/${item.listenPort}${portSuffix}`;
                            })
                            .join(";");
                        logger.info(`监听成功:${listeningDetails}`);
                    }
                    logger.info(`监听映射端口服务完成:${client.id}`);
                } catch (err) {
                    logger.error(`开启监听映射端口服务失败 (${client.id}):`, err);
                }
            })();
        }

        setContext(context: NetworkServerContext): void {
            this.context = context;
        }
    });