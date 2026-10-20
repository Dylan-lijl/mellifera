import {defineApiHandler} from "@mellifera/common/api";
import {ServiceApiDefinition} from "@mellifera/common/api";
import ConnectionService from "@/modules/service/ConnectionService";
import ServerService from "@/modules/service/ServerService";
import ClientService from "@/modules/service/ClientService";

export default defineApiHandler(ServiceApiDefinition, {
    connection:{
        searchAndPage:ConnectionService.searchAndPage,
        getById:ConnectionService.getById,
        create:ConnectionService.create,
        update:ConnectionService.update,
        delete:ConnectionService.delete,
        enable:ConnectionService.enable,
    },
    client:{
        searchAndPage:ClientService.searchAndPage,
        getById:ClientService.getById,
        create:ClientService.create,
        update:ClientService.update,
        delete:ClientService.delete,
        enable:ClientService.enable,
    },
    server:{
        getConfig: ServerService.getConfig,
        saveConfig:ServerService.saveConfig,
        getNetworkIpInfos:ServerService.getNetworkIpInfos,
        start: ServerService.start,
        stop: ServerService.stop,
    }
})