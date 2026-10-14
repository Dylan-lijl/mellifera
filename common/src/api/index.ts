import {
    method,
    type ApiPathType,
    convertToPaths, type WrapperName,
} from "./definition"
import {type AppInfo} from "../types";
import type {ReloadType} from "../constant";
import {
    CreateConnectionRequest, DeleteByIdRequest, EnabledRequest,
    FindByIdRequest,
    InfoConnectionResponse,
    ListConnectionResponse,
    SearchAndPageRequest, UpdateConnectionRequest
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
export const ConnectionApiDefinition = {
    searchAndPage: method<(request: SearchAndPageRequest) => Promise<PageData<ListConnectionResponse>>>({wrappers: commonWrapper}),
    getById: method<(request: FindByIdRequest) => Promise<InfoConnectionResponse>>({wrappers: commonWrapper}),
    create: method<(request: CreateConnectionRequest) => Promise<number>>({wrappers: commonWrapper}),
    update: method<(request: UpdateConnectionRequest) => Promise<void>>({
        wrappers: commonWrapper,
        loading: (request) => request.id
    }),
    delete: method<(request: DeleteByIdRequest) => Promise<void>>({wrappers: commonWrapper,loading: (request) => request.id}),
    enable: method<(request: EnabledRequest) => Promise<void>>({wrappers: commonWrapper,loading: (request) => request.id}),
}
export const ServiceApiDefinition = {
    connection: ConnectionApiDefinition
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
