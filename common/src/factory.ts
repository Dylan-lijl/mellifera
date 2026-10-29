import {CreateClientRequest, CreateConnectionRequest, CreateMappingRequest} from "./entity";
import {ConnectionRunData, StateData} from "./stateSync";
import {runState, transportProtocol} from "./constant";

export function createConnection(): CreateConnectionRequest {
    return {
        name: '未命名',
        host: '',
        port: 9913,
        token: '',
        enabled: true,
        autoUpdate: true,
        description: '',
    }
}

export function createClient(): CreateClientRequest {
    return {
        name: "未命名",
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
            connected:[]
        },
        connection: {
            details: new Map<number, ConnectionRunData>(),
        }
    }
}

export function createMapping(): CreateMappingRequest {
    return {
        clientId: 0,
        listenPort: 0,
        name: "未命名",
        enabled: true,
        protocol: transportProtocol.tcp.value,
        targetHost: "127.0.0.1",
        targetPort: 80,
        disabledPorts: '',
        description: '',
        other: '',
    }
}