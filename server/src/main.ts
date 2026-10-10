import init from "./init";
import service from "@/service";
import {ipcMain} from "electron";
import {ApiPathValue, ApiDefinition, type ApiPath} from '@mellifera/common/api'
import {isApiMethod} from '@mellifera/common/api/definition'
import {deepToRaw} from "@/utils";
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

await init()
registerService(ApiDefinition, ApiPathValue, service);