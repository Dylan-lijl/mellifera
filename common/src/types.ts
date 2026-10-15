import type {AnyMethod} from "./api/definition";
import {type Result} from "./Result";
import {NetworkType} from "./constant";

export interface AppInfo {
    name: string,
    version: string,
    env: string,
    icon: string,
    platform: {
        name: string,
        version: string,
    },
    path: AppPath,
}

export interface AppPath {
    //应用数据
    appData: string,
    //资源
    assets: string,
    //会话数据
    sessionData: string,
    //临时文件
    temp: string,
    //执行文件
    exe: string,
    //浏览器内核路径
    module: string,
    //日志文件路径
    logs: string,
    //崩溃日志
    crashDumps: string,
    //应用路径
    appPath: string,
}
export interface NetworkIpInfo {
    /** 网卡名称 */
    name: string
    /** IP 地址 */
    address: string
    /** IP 协议版本 */
    family: 4 | 6
    /** 是否为内部回环地址 */
    internal: boolean
    /** 子网掩码 */
    netmask: string
    /** CIDR 前缀长度 */
    cidr: number | null
    /** MAC 地址 */
    mac: string
}
export type ApiResponse<T extends AnyMethod> = Awaited<ReturnType<T>>;
export type ApiData<T extends AnyMethod> = ApiResponse<T> extends Result<infer D> ? D : ApiResponse<T>;
export interface RequestChain<T extends AnyMethod, M extends boolean = false, > {
    successMessage(handler: (res: ApiResponse<T>) => string | boolean,): this;

    errorMessage(handler: (res: ApiResponse<T>) => string | boolean,): this;

    withMeta(): RequestChain<T, true>;

    get(): Promise<M extends true ? ApiResponse<T> : ApiData<T>>;
}