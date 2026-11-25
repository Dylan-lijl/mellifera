import {type TokenRequest} from "@mellifera/common/entity";
import ServerService from "@/modules/service/ServerService";
import {defineController, RpcMethod} from "@/utils/network";

export const CommonController = defineController("common",
    class CommonController {
        @RpcMethod()
        async disconnect(request: TokenRequest) {
            if (!request.token) {
                return
            }
            await ServerService.disconnect(request);
        }
    });