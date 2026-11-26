import type {ContextAware, NetworkClientContext} from "@/types/network";
import controllers from '../data'
import serverControllers from '../../server/data'
import {defineController, RpcMethod} from "@/utils/network";
import {createRpcProxy} from "@/network/RpcDispatcher";
import other from "@/network/Other";

export const ConnectionController = defineController("connection",
    class ConnectionController implements ContextAware<NetworkClientContext> {
        context: NetworkClientContext = null as unknown as NetworkClientContext;

        setContext(context: NetworkClientContext) {
            this.context = context;
        }

        /*async createCommand(request: { id: number }) {
            if (!request.id) {
                return;
            }
            const connection = await ConnectionEntity.findOne({
                where: {
                    id: request.id,
                }
            })
            if (!connection) {
                throw new Error("No connection found.");
            }
            const success = this.context.connect({host: connection.host, port: connection.port})
            if (!success) {
                throw new Error("No connect error.");
            }
            try {
                this.context.rpc.user.auth({token: connection.token})
                this.context.authed = true;
                this.context.payload.token = connection.token;
                this.context.payload.host = connection.host;
                this.context.payload.port = connection.port;
            } catch (err) {
                this.context.clearCommand();
                throw new Error("认证失败!")
            }
        }*/
        @RpcMethod()
        async createData(request: {
            items: [{ type: 1 | 2, channelId: number, host: string, port: number }],
            random: number
        }) {
            const result = {
                error: [] as number[],
                success: [] as number[],
            }
            for (const {host, type, port, channelId} of request.items) {
                if (type === 1) {
                    //stream
                    const channel = await this.context.bootstrap.connectData(controllers, channelId, "stream", host, port);
                    if (!channel) {
                        result.error.push(channelId)
                        continue
                    }
                    const rpc = createRpcProxy(serverControllers, this.context);
                    rpc.user.auth({token: 'x', type: 2})
                } else if (type === 2) {
                    //datagram
                    const channel = this.context.bootstrap.connectData(controllers, channelId, "datagram", host, port);
                    if (!channel) {
                        result.error.push(channelId)
                        continue
                    }
                    const rpc = createRpcProxy(serverControllers, this.context);
                    rpc.user.auth({token: 'x', type: 2})
                } else {
                }
            }
            return result;
        }

        @RpcMethod({ack: false})
        async disconnect() {
            if (this.context.variable?.id) {
                await other.disconnectConnection(this.context.variable.id);
            }
        }

        @RpcMethod()
        async passData(request: { channelId: number[] }) {
            if (!request.channelId) {
                return
            }
            request.channelId.forEach((channelId) => {
                let socketItem = this.context.bootstrap.dataSockets.get(channelId);
                if (socketItem) {
                    socketItem.context.available = true;
                    return
                }
            })
        }
    });