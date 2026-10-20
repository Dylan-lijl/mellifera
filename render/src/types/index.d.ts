import type { RouteRecordRaw } from 'vue-router'

/**
 * 业务元数据定义 (即 metadata.ts 的主体结构)
 */
export interface RouterMetadata {
    title?: string;     // 页面标题
    icon?: string | Component;      // 菜单图标
    hidden?: boolean;   // 是否在侧边栏隐藏
    permissions?: string[]; // 权限控制
    originalTitle?: boolean;
    order?: number;
    keepAlive?: boolean,
    /**
     * 路由配置覆盖项
     * 使用 Omit 去掉 children, component 等由程序自动生成的属性
     * 确保用户在 metadata.ts 中只能配置合理的路由属性（如 redirect, alias, beforeEnter）
     */
    config?: Partial<Omit<RouteRecordRaw, 'children' | 'meta'>>;
}
export type SuperTableColumn<T> = DataTableColumns<T>[number] & {
    /** 是否隐藏该列 */
    hidden?: boolean

    /** 格式化字段值 */
    format?: (value: unknown, row: T, index: number) => VNodeChild

    /** 移动端是否默认收起该字段 */
    expand?: boolean
}