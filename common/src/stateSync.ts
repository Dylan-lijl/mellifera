import {AppInfo} from "./types";

export interface StateData{
    system: {
        canGoBack: boolean,
        canGoForward: boolean,
        alwaysOnTop: boolean,
        closing: boolean,
        maximize: boolean
    },
}
export interface StateSnapshot<T> {
    revision: number;
    data: T;
}

export type StatePatch =
    | {
    op: 'set';
    path: Array<string | number>;
    value: unknown;
}
    | {
    op: 'delete';
    path: Array<string | number>;
};

export interface StateChangeMessage {
    revision: number;
    patches: StatePatch[];
}
export interface StateSyncApi {
    getSnapshot(): Promise<StateSnapshot<StateData>>;

    subscribe(
        callback: (message: StateChangeMessage) => void
    ): () => void;
}