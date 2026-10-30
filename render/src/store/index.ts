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
import type {AppInfo, RequestChain} from "@mellifera/common/types";
import {createSyncState} from "@mellifera/common/factory";
import type {StateChangeMessage, StateData, StatePatch, StateSnapshot} from "@mellifera/common/stateSync";

export interface ApiMethodState {
    requesting: Set<LoadingKey>;
}

export type ApiState<T> = {
    [K in keyof T]:
    T[K] extends ApiMethodNode<infer _>
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
    [K in keyof T]:
    T[K] extends ApiMethodNode<infer M>
        ? (...args: Parameters<M>) => RequestChain<M>
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
            result[key] = (...args: Parameters<AnyMethod>) =>
                new RequestChainImpl(
                    node,
                    invoker as AnyMethod,
                    {
                        requesting: methodState.requesting,
                        showSuccessMessage,
                        showErrorMessage,
                    },
                    args,
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

function replaceObject<T extends object>(target: T, source: T) {
    for (const key of Object.keys(target) as (keyof T)[]) {
        delete target[key];
    }

    Object.assign(target, source);
}

function createStateSync(options: {
    getRevision: () => number;
    setRevision: (revision: number) => void;
    applySnapshot: (snapshot: StateSnapshot<StateData>) => void;
    applyPatch: (patch: StatePatch) => void;
}) {
    let unsubscribe: (() => void) | undefined;
    let initialized = false;
    let initializing: Promise<void> | undefined;
    let refreshing: Promise<void> | undefined;

    // 初始化或刷新期间收到的消息暂存在这里
    const pendingMessages = new Map<number, StateChangeMessage>();

    function onMessage(message: StateChangeMessage) {
        if (message.revision <= options.getRevision()) {
            return;
        }

        pendingMessages.set(message.revision, message);

        // 未初始化或正在刷新时，只缓存消息
        if (!initialized || refreshing) {
            return;
        }

        replayPendingMessages();

        // 如果存在版本缺口，重新获取快照
        if (hasRevisionGap()) {
            void refresh();
        }
    }

    function replayPendingMessages() {
        while (true) {
            const nextRevision = options.getRevision() + 1;
            const message = pendingMessages.get(nextRevision);

            if (!message) {
                break;
            }

            pendingMessages.delete(nextRevision);

            for (const patch of message.patches) {
                options.applyPatch(patch);
            }

            options.setRevision(message.revision);
        }

        // 清理已经过期的消息
        for (const revision of pendingMessages.keys()) {
            if (revision <= options.getRevision()) {
                pendingMessages.delete(revision);
            }
        }
    }

    function hasRevisionGap(): boolean {
        const currentRevision = options.getRevision();

        // 有后续消息，但缺少下一版本
        return [...pendingMessages.keys()].some(
            revision => revision > currentRevision + 1,
        );
    }

    async function refresh(): Promise<void> {
        // 同一时间只允许一个快照请求
        if (refreshing) {
            return refreshing;
        }

        refreshing = (async () => {
            const snapshot = await window.syncApi.getSnapshot();

            // 不允许旧快照覆盖新状态
            if (snapshot.revision >= options.getRevision()) {
                options.applySnapshot(snapshot);
                options.setRevision(snapshot.revision);
            }

            // 快照应用后，按顺序重放缓存消息
            replayPendingMessages();
        })();

        try {
            await refreshing;
        } finally {
            refreshing = undefined;
        }

        // 刷新结束后仍有缺口，再发起一次请求
        // 这里不会在同一个刷新调用内部递归
        if (initialized && hasRevisionGap()) {
            await refresh();
        }
    }

    async function init(): Promise<void> {
        if (initialized) return;
        if (initializing) return initializing;

        initializing = (async () => {
            // 先订阅，再获取快照
            unsubscribe = window.syncApi.subscribe(onMessage);

            await refresh();
            initialized = true;

            // 处理初始化期间积累的消息
            replayPendingMessages();

            if (hasRevisionGap()) {
                await refresh();
            }
        })();

        try {
            await initializing;
        } catch (error) {
            unsubscribe?.();
            unsubscribe = undefined;
            pendingMessages.clear();
            throw error;
        } finally {
            initializing = undefined;
        }
    }

    function dispose() {
        unsubscribe?.();
        unsubscribe = undefined;
        initialized = false;
        pendingMessages.clear();
    }

    return {
        init,
        refresh,
        dispose,
    };
}

export function applyStatePatch(
    target: object,
    patch: StatePatch
): void {
    const {op, path} = patch;

    if (path.length === 0) {
        return;
    }

    let current: any = target;

    for (const key of path.slice(0, -1)) {
        if (current == null || typeof current !== 'object') {
            return;
        }

        current = current instanceof Map
            ? current.get(key)
            : current[key];
    }

    if (current == null || typeof current !== 'object') {
        return;
    }

    const key = path[path.length - 1];

    if (current instanceof Map) {
        if (op === 'delete') {
            current.delete(key);
        } else if (patch.value){
            current.set(key, patch.value);
        }

        return;
    }

    if (op === 'delete') {
        if (Array.isArray(current) && typeof key === 'number') {
            if (Number.isInteger(key) && key >= 0 && key < current.length) {
                current.splice(key, 1);
            }
        } else {
            delete current[key];
        }

        return;
    }
    if(patch.value){
        current[key] = patch.value;
    }
}

export const useStore = defineStore("main", () => {
    const state = reactive({
        apiState: createApiState(ApiDefinition),
        data: {
            windowTitle: "",
            revision: 0,
            appInfo: null as unknown as AppInfo,
        },
        syncData: createSyncState()
    });
    const stateSync = createStateSync({
        getRevision: () => state.data.revision,
        setRevision: revision => {
            state.data.revision = revision;
        },
        applySnapshot: snapshot => {
            replaceObject(state.syncData, snapshot.data);
            state.data.revision = snapshot.revision;
        },
        applyPatch: patch => {
            applyStatePatch(state.syncData, patch);
        },
    });
    const actions = createActions(
        ApiDefinition,
        window.api,
        state.apiState,
        (message) => window.$message.success(message),
        (message) => window.$message.error(message),
    );
    return {
        ...toRefs(state),
        ...actions,
        setWindowTitle(title: string) {
            state.data.windowTitle = title;
        },
        async init() {
            await stateSync.init();
        }
    };
});