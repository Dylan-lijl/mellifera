import MappingService from "@/modules/service/MappingService";
import {type CreateMappingRequest, type UpdateMappingRequest} from "@mellifera/common/entity";
import {MappingEntity} from "@/db/MappingEntity";
import {ResultApiException} from "@mellifera/common/CustomException";
import {ID_NOT_EXIST_EXCEPTION, ILLEGAL_ACCESS} from "@mellifera/common/ResultCode";
import {checkContextAvailable, defineController, RpcMethod} from "@/utils/network";
import type {ContextAware, NetworkServerContext} from "@/types/network";

export const MappingController = defineController("mapping", class MappingController implements ContextAware<NetworkServerContext> {
    context = null as unknown as NetworkServerContext;

    setContext(context: NetworkServerContext) {
        this.context = context;
    }

    @RpcMethod()
    async add(request: Omit<CreateMappingRequest, "enabled" | "clientId">) {
        checkContextAvailable(this.context);
        return await MappingService.create({...request, enabled: true, clientId: this.context.variable!.id});
    }

    @RpcMethod()
    async list(request: { id?: number | null | undefined }) {
        checkContextAvailable(this.context);
        return await MappingService.list({clientId: this.context.variable!.id, id: request.id});
    }

    @RpcMethod()
    async remove(request: { id: number }) {
        checkContextAvailable(this.context);
        const item = await MappingEntity.findByPk(request.id);
        if (!item) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }
        if (item.clientId !== this.context.variable!.id) {
            throw new ResultApiException(ILLEGAL_ACCESS)
        }
        return await MappingService.delete({id: request.id})
    }

    @RpcMethod()
    async update(request: { id: number } & UpdateMappingRequest) {
        checkContextAvailable(this.context);
        const item = await MappingEntity.findByPk(request.id);
        if (!item) {
            throw new ResultApiException(ID_NOT_EXIST_EXCEPTION)
        }
        if (item.clientId !== this.context.variable!.id) {
            throw new ResultApiException(ILLEGAL_ACCESS)
        }
        return await MappingService.update(request);
    }
});
