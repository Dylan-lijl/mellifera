import {defineApiHandler} from "@mellifera/common/api";
import {ServiceApiDefinition} from "@mellifera/common/api";
import ConnectionService from "@/modules/service/ConnectionService";

export default defineApiHandler(ServiceApiDefinition, {
    connection:{
        searchAndPage:ConnectionService.searchAndPage,
        getById:ConnectionService.getById,
        create:ConnectionService.create,
        update:ConnectionService.update,
        delete:ConnectionService.delete,
        enable:ConnectionService.enable,
    }
})