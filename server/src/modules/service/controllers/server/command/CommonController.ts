import { type TokenRequest} from "@mellifera/common/entity";
import ServerService from "@/modules/service/ServerService";

export class CommonController {
    async disconnect(request: TokenRequest) {
        if(!request.token){
            return
        }
        await ServerService.disconnect(request);
    }
}