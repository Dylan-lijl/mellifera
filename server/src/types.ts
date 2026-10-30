import type {ListenValueType, TransportProtocolType} from "@mellifera/common/constant";
import type {MappingModel} from "@mellifera/common/entity";

export type IpcMethod = (...args: any[]) => any;

export interface SendListenerNormalValue {
    taskId: bigint,
    value: any
}

export interface SendListenerManyValue {
    taskId: bigint,
    type: "delete" | "update" | "add",
    id: bigint,
    value: any
}

export interface SendListenerValue {
    key: ListenValueType,
    value: SendListenerNormalValue | SendListenerManyValue | any
}

/**
 * 映射监听配置。
 *
 * 只保留生命周期管理所需的字段，
 * 后续可以替换为项目中已有的 MappingDefinition 类型。
 */
export interface MappingListenerConfig {
    id: MappingModel['id']
    clientId: MappingModel['clientId']
    protocol: MappingModel['protocol']
    listenPort: MappingModel['listenPort']
    targetHost: MappingModel['targetHost']
    targetPort: MappingModel['targetPort']
    disabledPorts: MappingModel['disabledPorts']
    other: MappingModel['other']
}

/**
 * 映射监听器启动结果。
 */
export interface MappingListenerStartResult {
    /** 实际监听端口，动态分配时不一定等于配置端口 */
    listenPort: number
}

/**
 * 映射监听器接口。
 */
export interface MappingListener {
    /**
     * 启动监听。
     * 成功后返回实际监听端口。
     */
    start(): Promise<MappingListenerStartResult>

    /**
     * 停止监听并释放资源。
     */
    stop(): Promise<void>

    /**
     * 设置参数
     */
    setOptions(options: any): void
}

export interface TransportListenerMetadata {
    protocol: TransportProtocolType,
    order: number,
    clazz: new (config: MappingListenerConfig,) => MappingListener,
    disabled?: boolean,
}