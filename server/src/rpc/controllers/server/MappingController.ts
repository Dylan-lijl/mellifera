import MappingService from "@/modules/service/MappingService";
import {type CreateMappingRequest, type TokenRequest, type UpdateMappingRequest} from "@mellifera/common/entity";
import ServerService from "@/modules/service/ServerService";
import {MappingEntity} from "@/db/MappingEntity";
import {ResultApiException} from "@mellifera/common/CustomException";
import {ID_NOT_EXIST_EXCEPTION,ILLEGAL_ACCESS} from "@mellifera/common/ResultCode";

export default class MappingController {
    async add(request: Omit<CreateMappingRequest, "enabled" | "clientId"> & TokenRequest) {
        const clientId = ServerService.findClientIdByToken(request.token)
        return await MappingService.create({...request, enabled: true, clientId});
    }

    async list(request: { token: string, id?: number | null | undefined }) {
        const clientId = ServerService.findClientIdByToken(request.token);
        return await MappingService.list({clientId, id: request.id})
    }

    async remove(request: { token: string; id: number }) {
        const clientId = ServerService.findClientIdByToken(request.token);
        const item = await MappingEntity.findByPk(request.id);
        if(!item) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }
        if (item.clientId !== clientId) {
            throw new ResultApiException(ILLEGAL_ACCESS)
        }
        return await MappingService.delete({id: request.id})
    }

    async update(request: { token: string, id: number }&UpdateMappingRequest) {
        const clientId = ServerService.findClientIdByToken(request.token);
        const item = await MappingEntity.findByPk(request.id);
        if(!item) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }
        if (item.clientId !== clientId) {
            throw new ResultApiException(ILLEGAL_ACCESS)
        }
        return await MappingService.update(request);
    }
}
