import {
    method,
    type ApiPathType,
    convertToPaths, type WrapperName,
} from "./definition"
import {type AppInfo, NetworkIpInfo} from "../types";
import type {ReloadType} from "../constant";
import {
    ConnectionMappingModel,
    CreateClientRequest, CreateConnectionMappingRequest,
    CreateConnectionRequest, CreateMappingRequest, DeleteByIdRequest, EnabledRequest,
    FindByIdRequest, InfoClientResponse,
    InfoConnectionResponse, InfoMappingResponse, type ListClientRequest, ListClientResponse,
    ListConnectionMappingResponse,
    ListConnectionResponse, ListMappingRequest,
    ListMappingResponse,
    SearchAndPageRequest, ServerConfig, UpdateClientRequest,
    UpdateConnectionMappingRequest, UpdateConnectionRequest, UpdateMappingRequest
} from "../entity";
import {PageData} from "../Result";

const systemWrapper: WrapperName[] = ["resultWrapper"];
export const SystemApiDefinition = {
    selectFile: method<(options: any) => Promise<string | undefined>>({wrappers: systemWrapper}),
    openBrowserUrl: method<(url: string) => Promise<boolean>>({wrappers: systemWrapper}),
    openDevTools: method<() => void>({wrappers: systemWrapper}),
    setAlwaysOnTop: method<(value: boolean) => void>({wrappers: systemWrapper}),
    getAppInfo: method<() => AppInfo>({wrappers: systemWrapper}),
    openFileDir: method<(path: string) => void>({wrappers: systemWrapper}),
    close: method<() => void>({wrappers: systemWrapper}),
    minimize: method<() => void>({wrappers: systemWrapper}),
    maximize: method<() => void>({wrappers: systemWrapper}),
    refresh: method<(type: ReloadType) => void>({wrappers: systemWrapper}),
    goBack: method<() => void>({wrappers: systemWrapper}),
    goForward: method<() => void>({wrappers: systemWrapper}),
    saveRoute: method<(route: string) => void>({wrappers: systemWrapper}),
    getRoute: method<() => string>({wrappers: systemWrapper}),
    statusList: method<() => void>({wrappers: systemWrapper}),
} as const
const storeWrapper: WrapperName[] = ["resultWrapper", "logWrapper"];
const commonWrapper: WrapperName[] = ["resultWrapper", "logWrapper"];
export const ConnectionMappingApiDefinition = {
    load: method<(request: FindByIdRequest) => Promise<ListConnectionMappingResponse[]>>({wrappers: commonWrapper}),
    add: method<(request: CreateConnectionMappingRequest) => Promise<number>>({wrappers: commonWrapper}),
    update: method<(request: UpdateConnectionMappingRequest) => Promise<number>>({wrappers: commonWrapper}),
    disconnect: method<(request: FindByIdRequest) => Promise<void>>({wrappers: commonWrapper}),
    remove: method<(request: DeleteByIdRequest) => Promise<boolean>>({wrappers: commonWrapper}),
}
export const ConnectionApiDefinition = {
    searchAndPage: method<(request: SearchAndPageRequest) => Promise<PageData<ListConnectionResponse>>>({wrappers: commonWrapper}),
    getById: method<(request: FindByIdRequest) => Promise<InfoConnectionResponse>>({wrappers: commonWrapper}),
    create: method<(request: CreateConnectionRequest) => Promise<number>>({wrappers: commonWrapper}),
    update: method<(request: UpdateConnectionRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    delete: method<(request: DeleteByIdRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    enable: method<(request: EnabledRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    connect: method<(request: FindByIdRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }), disconnect: method<(request: FindByIdRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    mapping: ConnectionMappingApiDefinition
}
export const ClientApiDefinition = {
    searchAndPage: method<(request: ListClientRequest) => Promise<PageData<ListClientResponse>>>({wrappers: commonWrapper}),
    getById: method<(request: FindByIdRequest) => Promise<InfoClientResponse>>({wrappers: commonWrapper}),
    create: method<(request: CreateClientRequest) => Promise<number>>({wrappers: commonWrapper}),
    update: method<(request: UpdateClientRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    delete: method<(request: DeleteByIdRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    enable: method<(request: EnabledRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
}
export const MappingApiDefinition = {
    searchAndPage: method<(request: ListMappingRequest) => Promise<PageData<ListMappingResponse>>>({wrappers: commonWrapper}),
    getById: method<(request: FindByIdRequest) => Promise<InfoMappingResponse>>({wrappers: commonWrapper}),
    create: method<(request: CreateMappingRequest) => Promise<number>>({wrappers: commonWrapper}),
    update: method<(request: UpdateMappingRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    delete: method<(request: DeleteByIdRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    enable: method<(request: EnabledRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
}
export const ServerApiDefinition = {
    getConfig: method<() => Promise<ServerConfig>>({wrappers: commonWrapper}),
    saveConfig: method<(config: ServerConfig) => Promise<void>>({wrappers: commonWrapper}),
    getNetworkIpInfos: method<() => Promise<NetworkIpInfo[]>>({wrappers: commonWrapper}),
    start: method<() => Promise<void>>({wrappers: commonWrapper}),
    stop: method<() => Promise<void>>({wrappers: commonWrapper}),
}
export const ServiceApiDefinition = {
    connection: ConnectionApiDefinition,
    client: ClientApiDefinition,
    mapping: MappingApiDefinition,
    server: ServerApiDefinition,
}
export const ApiDefinition = {
    system: SystemApiDefinition,
    store: {
        saveData: method<(key: string, value: unknown) => void>({wrappers: storeWrapper}),
        getData: method<(key: string) => unknown>({wrappers: storeWrapper}),
        deleteData: method<(key: string) => void>({wrappers: storeWrapper}),
        getAll: method<() => Record<string, unknown>[]>({wrappers: storeWrapper}),
    },
    service: ServiceApiDefinition,
} as const;
type AnyMethod = (...args: any[]) => any;
type ApiMethodDefinition<T extends AnyMethod> = {
    readonly method: T;
    readonly loading?: (...args: Parameters<T>) => string | number | readonly (string | number)[];
};
export type ApiHandler<T> = {
    [K in keyof T]:
    T[K] extends ApiMethodDefinition<infer M>
        ? M
        : T[K] extends object
            ? ApiHandler<T[K]>
            : never;
};

export function defineApiHandler<T>(
    _definition: T,
    handler: ApiHandler<T>
): ApiHandler<T> {
    return handler;
}

export type ApiClient<T> = {
    [K in keyof T]:
    T[K] extends ApiMethodDefinition<infer M>
        ? (...args: Parameters<M>) => Promise<Awaited<ReturnType<M>>>
        : T[K] extends object
            ? ApiClient<T[K]>
            : never;
};
export type ApiPath = ApiPathType<typeof ApiDefinition, "/">;
export const ApiPathValue = convertToPaths(ApiDefinition, "/",);
