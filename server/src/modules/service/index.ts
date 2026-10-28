import {defineApiHandler} from "@mellifera/common/api";
import {ServiceApiDefinition} from "@mellifera/common/api";
import ConnectionService from "@/modules/service/ConnectionService";
import ServerService from "@/modules/service/ServerService";
import ClientService from "@/modules/service/ClientService";
import MappingService from "@/modules/service/MappingService";

export default defineApiHandler(ServiceApiDefinition, {
    connection: {
        searchAndPage: ConnectionService.searchAndPage,
        getById: ConnectionService.getById,
        create: ConnectionService.create,
        update: ConnectionService.update,
        delete: ConnectionService.delete,
        enable: ConnectionService.enable,
        connect: ConnectionService.connect,
        disconnect: ConnectionService.disconnect,
        mapping: {
            load: ConnectionService.mapping.load,
            add: ConnectionService.mapping.add,
            update: ConnectionService.mapping.update,
            disconnect: ConnectionService.mapping.disconnect,
            remove: ConnectionService.mapping.remove,
        }
    },
    client: {
        searchAndPage: ClientService.searchAndPage,
        getById: ClientService.getById,
        create: ClientService.create,
        update: ClientService.update,
        delete: ClientService.delete,
        enable: ClientService.enable,
    },
    mapping: {
        searchAndPage: MappingService.searchAndPage,
        getById: MappingService.getById,
        create: MappingService.create,
        update: MappingService.update,
        delete: MappingService.delete,
        enable: MappingService.enable,
    },
    server: {
        getConfig: ServerService.getConfig,
        saveConfig: ServerService.saveConfig,
        getNetworkIpInfos: ServerService.getNetworkIpInfos,
        start: ServerService.start,
        stop: ServerService.stop,
    }
})