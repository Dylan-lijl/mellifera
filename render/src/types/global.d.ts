import  { type ApiClient ,ApiDefinition} from "@mellifera/common/api";

declare global {
    interface Window {
        api: ApiClient<typeof ApiDefinition>;
    }
}

export {};