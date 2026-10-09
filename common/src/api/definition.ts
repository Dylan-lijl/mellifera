export type AnyMethod = (...args: any[]) => any

export type LoadingKey = string | number

export type LoadingKeys = LoadingKey | readonly LoadingKey[]
export const wrappers = ['resultWrapper','logWrapper'] as const
export interface ApiMethodOptions<T extends AnyMethod>{
    loading?: (
        ...args: Parameters<T>
    ) => LoadingKeys,
    wrappers?: WrapperName[]
}
export type WrapperName = typeof wrappers[number];
export interface ApiMethodDefinition<T extends AnyMethod> extends ApiMethodOptions<T>{
    readonly method: T
}
export const API_METHOD = Symbol("api-method")

export type ApiMethodNode<T extends AnyMethod = AnyMethod> =
    ApiMethodDefinition<T> & {
    readonly [API_METHOD]: true
}

export function method<T extends AnyMethod>(
    options?: ApiMethodOptions<T>
): ApiMethodNode<T> {
    return {
        [API_METHOD]: true,
        method: null as unknown as T,
        ...options,
    }
}

export function isApiMethod(
    value: unknown
): value is ApiMethodNode {
    return (
        typeof value === "object" &&
        value !== null &&
        (value as Record<symbol, unknown>)[API_METHOD] === true
    )
}
export type ApiPathValueType<
    T,
    D extends string = "/",
    P extends string = "",
> = {
    [K in keyof T]: T[K] extends ApiMethodDefinition<any>
        ? `${P}${P extends "" ? "" : D}${K & string}`
        : T[K] extends object
            ? ApiPathValueType<
                T[K],
                D,
                `${P}${P extends "" ? "" : D}${K & string}`
            >
            : never;
};
export function convertToPaths<
    T,
    D extends string = "/",
>(
    value: T,
    delimiter: D = "/" as D,
    prefix = "",
): ApiPathValueType<T, D> {
    if (!value || typeof value !== "object") {
        return prefix as ApiPathValueType<T, D>;
    }

    const result: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        const path = prefix
            ? `${prefix}${delimiter}${key}`
            : key;

        if (isApiMethod(child)) {
            result[key] = path;
        } else {
            result[key] = convertToPaths(
                child,
                delimiter,
                path,
            );
        }
    }

    return result as ApiPathValueType<T, D>;
}

export type ApiPathType<
    T,
    D extends string = "/",
    P extends string = ""
> = {
    [K in keyof T & string]:
    T[K] extends ApiMethodDefinition<any>
        ? `${P}${P extends "" ? "" : D}${K}`
        : T[K] extends object
            ? ApiPathType<
                T[K],
                D,
                `${P}${P extends "" ? "" : D}${K}`
            >
            : never
}[keyof T & string]