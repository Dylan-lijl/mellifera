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
export const updateLogs = [{
    createTime: new Date(1791710263046),
    title: '初始化',
    version: '1.0.0-alpha.1',
    content: '搭建架构和页面',
}];