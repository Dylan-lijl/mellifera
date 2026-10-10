import {createRouter, createWebHashHistory as createHistory, type RouteRecordRaw} from "vue-router";
import type {RouterMetadata} from "@/types";
import {useStore} from "@/store";

const store = new Proxy({} as any, {
    get(_target, prop) {
        // 只有当你真正去调用 storer.setWindowTitle(...) 的那一刻
        // 它才会触发这个 get 拦截，去动态获取真正的 useStore()
        const realStore = useStore();
        return Reflect.get(realStore, prop);
    }
});
const viewPath = "../views";
const metadataFile = "metadata.ts";
const indexName = "index.vue";
const appTitle = import.meta.env.VITE_APP_TITLE || "未知";
const pages = import.meta.glob("../views/**/metadata.ts", {
    eager: true,
    import: "default",
}) as Record<string, any>;

// 2. 扫描所有的 index.vue 获取组件
const components = import.meta.glob("../views/**/index.vue");

const routes = Object.entries(pages).map(([path, data]) => {
    const pageData = data as RouterMetadata;
    const {config, ...meta} = pageData;
    // 计算对应的组件路径
    const commonPath = path.replace(metadataFile, indexName);

    // 转换文件路径为 URL 路径
    // 示例: ../views/monitor/metadata.ts -> /monitor
    // 更加健壮的路径提取
    let routePath = path
        .replace(viewPath, "")
        .replace("/" + metadataFile, "");
    // 统一处理路径前缀
    routePath = routePath.startsWith('/') ? routePath : '/' + routePath;
    // 生成路由名称，将 / 替换为 -
    const name = routePath.split("/").filter(Boolean).join("-") || 'home';
    return {
        path: config?.path ? config.path : routePath,
        name: config?.name ? config.name : name,
        component: config?.component ? config?.component : components[commonPath],
        meta, // 这里的 meta 就是你在 metadata.ts 中 export default 的内容
        ...config,
    } as RouteRecordRaw;
});
export const router = createRouter({
    history: createHistory(),
    routes,
});
router.afterEach((to) => {
    const {title, originalTitle} = to.meta ?? {};
    store.setWindowTitle(title && !originalTitle ? title as string : appTitle);
    store.system.saveRoute(to.name).get();
});