import {RpcPeer} from '../peer/RpcPeer'
import {RpcRouter} from '../router/RpcRouter'
import type {
    ClientControllerModules,
    ServerControllerModules,
} from '../rpc-controller-types'
import {wrapperResultMethod} from "@/enhancer";
import type {Result} from "@mellifera/common/Result";
import {isSuccess} from "@mellifera/common/ResultCode";
import SuperJSON from "superjson";
import {ResultApiException} from "@mellifera/common/CustomException";

export type RpcRole = 'client' | 'server'

type AnyFunction = (...args: any[]) => any
type Constructor = new (...args: any[]) => any

type LowercaseFirst<S extends string> =
    S extends `${infer F}${infer R}`
        ? `${Lowercase<F>}${R}`
        : S

type ExtractControllerName<Path extends string> =
    Path extends `${string}/controllers/${string}/${infer Name}Controller.ts`
        ? LowercaseFirst<Name>
        : never
type RpcMethod<T> =
    T extends (...args: infer A) => infer R
        ? (...args: A) => Promise<Awaited<R>>
        : never
export type RpcController<T> = {
    [K in keyof T as T[K] extends AnyFunction ? K : never]:
    RpcMethod<T[K]>
}

export type RpcClient<Modules> = {
    [K in keyof Modules as K extends string
        ? ExtractControllerName<K>
        : never]: Modules[K] extends Constructor
        ? RpcController<InstanceType<Modules[K]>>
        : never
}

export type RpcProxyFor<Role extends RpcRole> =
    Role extends 'client'
        ? RpcClient<ServerControllerModules>
        : RpcClient<ClientControllerModules>

// 运行时自动扫描控制器，静态类型由 rpc-controller-types.d.ts 提供
const rawClientModules = import.meta.glob<Constructor>(
    '../controllers/client/*Controller.ts',
    {
        eager: true,
        import: 'default',
    },
)

const rawServerModules = import.meta.glob<Constructor>(
    '../controllers/server/*Controller.ts',
    {
        eager: true,
        import: 'default',
    },
)

export function createRpcClient<
    Role extends RpcRole,
    TContext,
>(
    role: Role,
    router: RpcRouter<TContext>,
    peer: RpcPeer<TContext>,
): RpcProxyFor<Role> {
    const localModules = (
        role === 'client' ? rawClientModules : rawServerModules
    ) as Record<string, Constructor>

    const remoteModules = (
        role === 'client' ? rawServerModules : rawClientModules
    ) as Record<string, Constructor>

    const getControllerName = (path: string): string => {
        const fileName = path.split('/').pop()!
        const name = fileName
            .replace(/\.ts$/, '')
            .replace(/Controller$/, '')

        return name.charAt(0).toLowerCase() + name.slice(1)
    }

    // 注册本地控制器
    for (const [path, ControllerClass] of Object.entries(localModules)) {
        const controllerName = getControllerName(path)
        const instance = new ControllerClass()
        const prototype = ControllerClass.prototype

        for (const methodName of Object.getOwnPropertyNames(prototype)) {
            if (methodName === 'constructor') continue

            router.register(
                `${controllerName}.${methodName}`,
                wrapperResultMethod(async (params: unknown, context: TContext) => {
                        const method = instance[methodName]

                        if (typeof method !== 'function') {
                            throw new Error(
                                `RPC method not found: ${controllerName}.${methodName}`,
                            )
                        }

                        return await method.call(instance, params, context)
                    },
                ))
        }
    }

    // 创建远程控制器代理
    const root: Record<
        string,
        Record<string, (...args: any[]) => any>
    > = {}

    for (const path of Object.keys(remoteModules)) {
        const controllerName = getControllerName(path)

        if (root[controllerName]) {
            throw new Error(`Duplicate RPC controller: ${controllerName}`)
        }

        root[controllerName] = new Proxy({}, {
            get(_, methodName: string | symbol) {
                if (
                    typeof methodName !== 'string' ||
                    methodName === 'then'
                ) {
                    return undefined
                }

                return async (params?: unknown) =>
                    unwrapResult(await peer.request(`${controllerName}.${methodName}`, params,))
            },
        })
    }

    return root as RpcProxyFor<Role>
}

function unwrapResult(result: Result<unknown>): unknown {
    if (isSuccess(result.code)) {
        return SuperJSON.deserialize(result.data as any) as unknown
    }

    throw new ResultApiException(result as Result<null>)
}