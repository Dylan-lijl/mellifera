import {defineStore} from "pinia";
import {reactive, toRefs} from "vue";
import {
    type AnyMethod,
    type  LoadingKey,
    type ApiMethodNode,
    isApiMethod
} from "@mellifera/common/api/definition";
import {ApiDefinition, type ApiClient} from "@mellifera/common/api";
import {RequestChainImpl} from "./RequestChainImpl";
import type {RequestChain} from "@mellifera/common/types";
import {useMessage} from 'naive-ui'

const m = useMessage()

export interface ApiMethodState {
    requesting: Set<LoadingKey>;
}

export type ApiState<T> = {
    [K in keyof T]: T[K] extends ApiMethodNode<any>
        ? ApiMethodState
        : T[K] extends object
            ? ApiState<T[K]>
            : never;
};

function createApiState<T extends object>(definition: T): ApiState<T> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(definition) as (keyof T & string)[]) {
        const node = definition[key];
        if (isApiMethod(node)) {
            result[key] = {
                requesting: reactive(new Set<LoadingKey>()),
            };
        } else if (typeof node === "object" && node !== null) {
            result[key] = createApiState(node);
        }
    }
    return result as ApiState<T>;
}

type ApiActions<T> = {
    [K in keyof T as T[K] extends ApiMethodNode<any> ? K : K]:
    T[K] extends ApiMethodNode<infer M>
        ? () => RequestChain<M>
        : T[K] extends object
            ? ApiActions<T[K]>
            : never;
};

function createActions<D extends object>(
    definition: D,
    client: ApiClient<D>,
    apiState: ApiState<D>,
    showSuccessMessage: (message: string) => void,
    showErrorMessage: (message: string) => void,
): ApiActions<D> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(definition) as (keyof D & string)[]) {
        const node = definition[key];
        const invoker = client[key];
        const state = apiState[key];

        if (isApiMethod(node)) {
            const methodState = state as ApiMethodState;
            result[key] = () => new RequestChainImpl(
                node,
                invoker as AnyMethod,
                {
                    requesting: methodState.requesting,
                    showSuccessMessage,
                    showErrorMessage,
                },
            );
        } else if (typeof node === "object" && node !== null) {
            result[key] = createActions(
                node,
                invoker as ApiClient<typeof node>,
                state as ApiState<typeof node>,
                showSuccessMessage,
                showErrorMessage,
            );
        }
    }

    return result as ApiActions<D>;
}

export const useStore = defineStore("main", () => {
    const state = reactive({
        apiState: createApiState(ApiDefinition),
    });
    const actions = createActions(
        ApiDefinition,
        window.api,
        state.apiState,
        (message) => m.success(message),
        (message) => m.error(message),
    );
    return {
        ...toRefs(state),
        ...actions
    };
});