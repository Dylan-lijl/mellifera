import init from "./init";
import service from "@/service";
import {ipcMain} from "electron";
import {ApiPathValue, ApiDefinition, type ApiPath} from '@mellifera/common/api'
import {isApiMethod} from '@mellifera/common/api/definition'
import {deepToRaw} from "@/utils";
import {initDatabase} from "@/db";
import {syncSnapshot} from "@mellifera/common/constant";
import StateSyncManager from "@/StateSyncManager";

function registerService(
    definition: any,
    paths: any,
    handlers: any,
): void {
    for (const key of Object.keys(definition)) {
        const api = definition[key];
        if (isApiMethod(api)) {
            const path = paths[key] as ApiPath;
            const finalHandler = handlers[key];
            if (typeof finalHandler !== "function") {
                throw new Error(`Missing IPC handler: ${path}`);
            }
            ipcMain.handle(path, async (_event, ...args) => deepToRaw(await finalHandler(...args)));
        } else {
            registerService(api, paths[key], handlers[key]);
        }
    }
}
//初始化应用
await init()
//注册服务接口
registerService(ApiDefinition, ApiPathValue, service);
//注册快照回调
ipcMain.handle(syncSnapshot, async (_event) => {
    return StateSyncManager.getRawState()
});
//初始化数据库
await initDatabase()