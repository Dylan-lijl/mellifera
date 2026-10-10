import  { type ApiClient ,ApiDefinition} from "@mellifera/common/api";
import {MessageApiInjection} from "naive-ui/es/message/src/MessageProvider";

declare global {
    interface Window {
        api: ApiClient<typeof ApiDefinition>;
        $message:MessageApiInjection
    }
}

export {};