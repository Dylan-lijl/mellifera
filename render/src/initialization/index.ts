import { useStore } from "@/store";
import { nextTick } from "vue";
import {router} from "@/router";

export async function init() {
    const store = useStore();
    /*window.api.onChangeListener.method((msg: IpcMessage) => {
        store.updateState(msg.key, msg.value);
    });*/

    await store.init();
    await nextTick(async () => {
        store.data.appInfo = await store.system.getAppInfo().get();
    });
    const routeName = await store.system.getRoute().get();
    if (routeName) {
        if (router.currentRoute.value.name !== routeName) {
            await router.replace({name: routeName});
        }
    }
}