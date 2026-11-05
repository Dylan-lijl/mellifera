export interface RpcClientContext{
    id:number,
    token:string,
}
export interface RpcServerContext{
    clientId:number,
    enabled:boolean,
    token:string
}