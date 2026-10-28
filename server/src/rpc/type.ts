export interface RpcClientContext{
    id:number,
    token:string,
}
export interface RpcServerContext{
    clientId:number,
    disabled:boolean,
    token:string
}