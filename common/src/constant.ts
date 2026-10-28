export const storeKeys = {
    inited: "inited",
    windowBounds: "windowBounds",
    position: "position",
    hideTray: "hideTray",
    switchValue: `switch`,
} as const;
export type StoreKey = keyof typeof storeKeys;
export const listenKeys = {
    alwaysOnTop: "alwaysOnTop",
}
export const contentContainer = "content-container";
export const syncSnapshot = "syncSnapshot";
export const syncChange = "syncChange";
export type ListenKeyType = keyof typeof listenKeys;
export type ListenValueType = typeof listenKeys[ListenKeyType];
export const normalReload = {label: '正常重新加载', value: 1, enabled: true}
export const hardReload = {label: '硬性重新加载', value: 2, enabled: true}
export const clearCacheAndForcefullyReload = {label: '清空缓存并硬性重新加载', value: 3, enabled: true}
export const reloadOptions = [normalReload, hardReload, clearCacheAndForcefullyReload] as const;
export type ReloadType = typeof reloadOptions[number]["value"];
export const networkType = {
    all: {label: "所有网卡", value: 1, enabled: true},
    selected: {label: "指定网卡", value: 2, enabled: true},
    loopback: {label: "仅本机", value: 3, enabled: true}
} as const;
export const networkTypeOptions = Object.values(networkType);
export type NetworkType = typeof networkTypeOptions[number]["value"];
export const runState = {
    idle: {label: '空闲', label2:'未连接',value: 1, enabled: true, type: "default"},
    starting: {label: '启动中',label2:'连接中', value: 2, enabled: true, type: "warning"},
    running: {label: '已运行',label2:'已连接', value: 3, enabled: true, type: "success"},
    stopping: {label: '停止中',label2:'断开中', value: 4, enabled: true, type: "error"},
} as const
export const runStateOptions = Object.values(runState);
export type RunStateType = typeof runStateOptions[number]["value"];
export const transportProtocol = {
    tcp: {label: 'TCP', value: 1, enabled: true, description: "传输控制协议(Transfer Control Protocol)"},
    udp: {label: 'UDP', value: 2, enabled: true, description: "用户数据协议(User Data Protocol)"},
} as const
export const transportProtocolOptions = Object.values(transportProtocol);
export type TransportProtocolType = typeof transportProtocolOptions[number]["value"];
//==================================================================
export const updateLogs = [{
    createTime: new Date(1791710263046),
    title: '初始化',
    version: '1.0.0-alpha.1',
    content: '搭建架构和页面',
}];