import {defineController, RpcMethod} from "@/utils/network";
import type {ContextAware, NetworkServerContext} from "@/types/network";
import manager from "@/network/GlobalNetworkManager";

export const CommonController = defineController("common",
    class CommonController implements ContextAware<NetworkServerContext> {
        context = null as unknown as NetworkServerContext;

        setContext(context: NetworkServerContext) {
            this.context = context;
        }

        @RpcMethod({ack: false})
        async disconnect(_request: {}) {
            for (const command of manager.commandMap.values()) {
                if (command.variable?.token !== this.context.variable?.token) {
                    continue;
                }
                await manager.disconnectCommand(command);
            }
        }
    });