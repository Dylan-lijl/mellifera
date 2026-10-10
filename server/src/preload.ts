// preload/api.ts
import {ipcRenderer} from "electron";
import {isApiMethod,} from "@mellifera/common/api/definition";
import {type ApiClient, ApiDefinition, ApiPathValue,} from "@mellifera/common/api";
import {contextBridge} from "electron";

function createApiClient(
    definition: Record<string, unknown>,
    paths: Record<string, unknown>,
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(definition)) {
        const node = definition[key];
        const path = paths[key];

        if (isApiMethod(node)) {
            if (typeof path !== "string") {
                throw new Error(`Invalid API path: ${key}`);
            }
            result[key] = async (...args: unknown[]) => await ipcRenderer.invoke(path, ...args);
        } else if (
            typeof node === "object" &&
            node !== null &&
            typeof path === "object" &&
            path !== null
        ) {
            result[key] = createApiClient(
                node as Record<string, unknown>,
                path as Record<string, unknown>,
            );
        }
    }

    return result;
}

contextBridge.exposeInMainWorld("api", createApiClient(
        ApiDefinition,
        ApiPathValue as Record<string, unknown>,
    ) as ApiClient<typeof ApiDefinition>
);