import type { Plugin } from 'vite'

export interface RpcControllerTypesOptions {
    clientDir?: string
    serverDir?: string
    output?: string
}

export function rpcControllerTypes(
    options?: RpcControllerTypesOptions,
): Plugin