import type {
    AnyMethod,
    ApiMethodDefinition, LoadingKey
} from "@mellifera/common/api/definition";
import type {RequestChain, ApiResponse, ApiData} from '@mellifera/common/types'

export interface RequestHooks {
    requesting: Set<LoadingKey>;
    showSuccessMessage: (message: string) => void;
    showErrorMessage: (message: string) => void;
}

export function isSuccess<T extends AnyMethod>(res: ApiResponse<T>): boolean {
    return (typeof res === "object" && res !== null && "code" in res && res.code >= 200 && res.code < 300);
}

export function getData<T extends AnyMethod>(res: ApiResponse<T>): ApiData<T> {
    if (typeof res === "object" && res !== null && "data" in res) {
        return res.data as ApiData<T>;
    }
    return res as ApiData<T>;
}

export class RequestChainImpl<T extends AnyMethod, M extends boolean = false, > implements RequestChain<T, M> {
    private successHandler?: (res: ApiResponse<T>,) => string | boolean;

    private errorHandler?: (res: ApiResponse<T>,) => string | boolean;
    private metaMode = false;

    private readonly request: ApiMethodDefinition<T>;
    private readonly invoker: T;
    private readonly hooks: RequestHooks;
    constructor(
        request: ApiMethodDefinition<T>,
        invoker: T,
        hooks: RequestHooks,
    ) {
        this.request = request;
        this.invoker = invoker;
        this.hooks = hooks;
    }
    successMessage(handler: (res: ApiResponse<T>) => string | boolean,): this {
        this.successHandler = handler;
        return this;
    }
    errorMessage(handler: (res: ApiResponse<T>) => string | boolean,): this {
        this.errorHandler = handler;
        return this;
    }
    withMeta(): RequestChain<T, true> {
        this.metaMode = true;
        return this as unknown as RequestChain<T, true>;
    }
    get(
        ...args: Parameters<T>
    ): Promise<M extends true ? ApiResponse<T> : ApiData<T>> {
        return this.execute(args) as Promise<
            M extends true ? ApiResponse<T> : ApiData<T>
        >;
    }
    private async execute(args: Parameters<T>,): Promise<ApiResponse<T> | ApiData<T>> {
        const loading = this.request.loading?.(...args) ?? "g";
        const keys: LoadingKey[] = Array.isArray(loading)
            ? [...new Set(loading)]
            : [loading as LoadingKey];
        for (const key of keys) {
            this.hooks.requesting.add(key);
        }
        try {
            const res = await this.invoker(...args) as ApiResponse<T>;
            const success = isSuccess(res);
            const handler = success
                ? this.successHandler
                : this.errorHandler;
            const message = handler?.(res);
            if (typeof message === "string" && message.length > 0) {
                (success
                    ? this.hooks.showSuccessMessage
                    : this.hooks.showErrorMessage)(message);
            }
            return this.metaMode ? res : getData(res);
        } finally {
            for (const key of keys) {
                this.hooks.requesting.delete(key);
            }
        }
    }
}