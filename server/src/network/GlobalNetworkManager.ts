import type {NetworkServerContext} from "@/types/network";

export class GlobalNetworkManager{
    commandMap=new Map<number,NetworkServerContext>()
    dataMap=new Map<number,NetworkServerContext[]>()
}
export default new GlobalNetworkManager();