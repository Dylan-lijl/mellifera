import type {Socket} from "node:net";
import dgram from "node:dgram";
import type {Result} from "@mellifera/common/Result";
import type {TcpAndUdpBootstrap} from "@/network/client/TcpAndUdpBootstrap";
import type {RpcDispatcher, RpcProxy} from "@/network/RpcDispatcher";

export interface NetEndpoint {
    type: 'socket',
    endpoint: Socket
}

export interface DatagramEndpoint {
    type: 'datagram',
    endpoint: dgram.Socket
}

export type RpcHandler = (
    params?: unknown
) => Promise<Result<any> | void>
export interface NetworkContext {
    getAddress: () => ({ host: string, port: number }),
    available:boolean,
    dispatcher:RpcDispatcher,
    rpcMap:Map<string,RpcProxy<unknown>>
}
export interface NetworkServerContext extends NetworkContext{
    getEndpoint: () => NetEndpoint | DatagramEndpoint,
}
export interface NetworkClientContext extends NetworkServerContext {
    bootstrap:TcpAndUdpBootstrap,
}
export interface ContextAware<T extends NetworkContext> {
    setContext: (context: T) => void
}