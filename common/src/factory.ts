import {CreateConnectionRequest} from "./entity";
import {StateData} from "./stateSync";
import {runState} from "./constant";

export function createConnection(): CreateConnectionRequest {
    return {
        name: '未命名',
        host: '',
        port: 9913,
        token: '',
        enabled: true,
        description: '',
    }
}

export function createSyncState(): StateData {
    return {
        system: {
            alwaysOnTop: false,
            closing: false,
            canGoBack: false,
            canGoForward: false,
            maximize: false,
        },
        server: {
            running: runState.idle.value,
            port: null,
            hosts: [],
            error: null,
        }
    }
}