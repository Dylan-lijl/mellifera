import {AppInfo} from "./types";
import {RunStateType} from "./constant";

export interface StateData {
    system: {
        canGoBack: boolean,
        canGoForward: boolean,
        alwaysOnTop: boolean,
        closing: boolean,
        maximize: boolean
    },
    server: {
        running: RunStateType,
        port: number | null,
        hosts: string[],
        error: string | null,
        connected:number[],
    },
    connection: {
        details: Map<number, ConnectionRunData>
    }
}

export interface MappingRunData {
    id: number,
    connectionId: number,
    remoteId: number,
    hosts: string,
    port: number,
    runningPort: number,
}

export interface ConnectionRunData {
    running: RunStateType,
    id: number,
    error: {
        message: string | null | undefined
    },
    connected: Map<number, MappingRunData>
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