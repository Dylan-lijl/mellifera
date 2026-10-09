import type { ListenValueType } from "@mellifera/common/constant";
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