import {ConnectionEntity} from "@/db/ConnectionEntity";
import manager from "@/network/GlobalNetworkManager";
import type {ContextAware, NetworkServerContext} from "@/types/network";
import {defineController, RpcMethod} from "@/utils/network";

export const UserController = defineController("user",
    class UserController implements ContextAware<NetworkServerContext> {
        context: NetworkServerContext = null as unknown as NetworkServerContext;

        @RpcMethod({ack: false})
        async auth(request: { token: string, type: 1 | 2 }) {
            const connection = await ConnectionEntity.findOne({
                where: {
                    token: request.token
                }
            })
            if (!connection) {
                throw new Error("No connection found for this request");
            }
            if (!connection.enabled) {
                throw new Error("No connection enabled for this request");
            }
            if(request.type!==2){
                throw new Error("命令连接请求错误");
            }
            let command = manager.commandMap.get(connection.id);
            if (command === null) {
                //说明命令连接不存在
                let count = 1;
                while (count <= 3) {
                    await new Promise<void>((resolve) => {
                        setTimeout(() => {
                            command = manager.commandMap.get(connection.id);
                            resolve();
                        }, 10 * count)
                    })
                    count++;
                }
            }
            if (command === null) {
                throw new Error("No connection found for this request");
            }
            if (!manager.dataMap.get(connection.id)) {
                manager.dataMap.set(connection.id, []);
            }
            const item = manager.dataMap.get(connection.id);
            if (!item) {
                throw new Error("No connection found for this request");
            }
            item.push(this.context);
            //更新上下文信息
            this.context.variable = {token: connection.token, id: connection.id};
            this.context.available = true;
        }

        setContext(context: NetworkServerContext): void {
            this.context = context;
        }
    })