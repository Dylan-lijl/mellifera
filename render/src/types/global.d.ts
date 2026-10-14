import  { type ApiClient ,ApiDefinition} from "@mellifera/common/api";
import {MessageApiInjection} from "naive-ui/es/message/src/MessageProvider";
import type {StateSyncApi} from "@mellifera/common/stateSync";

declare global {
    interface Window {
        api: ApiClient<typeof ApiDefinition>;
        $message:MessageApiInjection;
        syncApi: StateSyncApi
    }
}

export {};