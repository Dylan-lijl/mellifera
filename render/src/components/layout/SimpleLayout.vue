<template>
  <div class="layout-root">
    <div>
      <AppHeader/>
    </div>
    <div class="layout-wrapper">
      <div class="layout-menu">
        <n-menu
            :value="activeMenu"
            :options="menuOptions"
            :collapsed-width="64"
            :collapsed-icon-size="18"
            @update:value="handleMenuSelect"
            style="border-inline-end: 1px solid #bbbbbb"
        />
        <section class="layout-main">
          <header class="layout-header">
            <n-breadcrumb separator="/">
              <n-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="item.path">
                  <span class="breadcrumb-item">
                    <component :is="renderMenuIcon(item.meta?.icon, item.meta?.title)" v-if="item.meta?.icon"/>
                    <span v-if="index === breadcrumbs.length - 1 || item.meta?.clickable === false" class="no-redirect">{{
                        item.meta?.title
                      }}</span>
                    <a v-else href="#" @click.prevent="handleLink(item)">{{ item.meta?.title }}</a>
                  </span>
              </n-breadcrumb-item>
            </n-breadcrumb>
          </header>
          <main class="layout-content">
            <router-view v-slot="{ Component, route }">
              <keep-alive :include="cachedViews">
                <component :is="Component" :key="route.fullPath"/>
              </keep-alive>
            </router-view>
          </main>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, computed, watch, markRaw, h} from 'vue';
import {useRouter, useRoute} from 'vue-router';
import {NIcon, useMessage} from 'naive-ui'
import type {MenuOption} from 'naive-ui'
import AppHeader from "@/components/AppHeader.vue";

const router = useRouter();
const route = useRoute();
const canBack = ref(false);
window.$message = useMessage()
window.addEventListener('popstate', () => {
  canBack.value = window.history.state?.position > 0;
});
const activeMenu = computed(() => {
  const {meta, path} = route;
  // 如果 metadata.ts 里定义了 activeMenu，则高亮指定的路径（常用于详情页高亮列表页菜单）
  if (meta.activeMenu) {
    return meta.activeMenu as string;
  }
  return path;
});
// 2. 从路由配置中过滤出需要在菜单显示的项
const menuList = computed(() => {
  // 1. 获取所有需要显示的原始路由（克隆一份，避免修改原始路由对象）
  const rawItems = router.options.routes
      .filter(item => item.meta && !item.meta.hidden && item.path !== '/')
      .map(item => ({...item, children: []})); // 预初始化 children
  // 2. 按照路径长度排序（短的路径通常是父级）
  rawItems.sort((a, b) => a.path.length - b.path.length);
  const tree: any[] = [];
  const map: Record<string, any> = {};
  // 3. 构建映射表
  rawItems.forEach(item => {
    map[item.path] = item;
    if (item.meta && item.meta.icon) {
      item.meta.icon = markRaw(item.meta.icon);
    }
  });
  // 4. 寻找父子关系
  rawItems.forEach(item => {
    const pathParts = item.path.split('/').filter(Boolean);
    if (pathParts.length > 1) {
      // 尝试推导出父路径，例如：/system/user -> /system
      const parentPath = '/' + pathParts.slice(0, -1).join('/');

      if (map[parentPath]) {
        map[parentPath].children.push(item);
      } else {
        // 如果找不到父级，则作为根节点
        tree.push(item);
      }
    } else {
      // 一级目录直接入根
      tree.push(item);
    }
  });
  // 5. 最后统一进行自定义 order 排序
  const sortByOrder = (list: any[]) => {
    list.sort((a, b) => (Number(a.meta?.order) || 100_000) - (Number(b.meta?.order) || 100_000));
    list.forEach(node => {
      if (node.children?.length > 0) sortByOrder(node.children);
    });
    return list;
  };
  return sortByOrder(tree);
});

const breadcrumbs = ref<any[]>([]);

function renderMenuIcon(icon: any, title?: string) {
  if (typeof icon === 'string') {
    return h('img', {
      src: icon,
      alt: title || '',
      style: {
        width: '18px',
        height: '18px',
        objectFit: 'contain',
        flexShrink: 0,
      },
    })
  }

  return h(NIcon, {size: 18}, {
    default: () => h(icon),
  })
}

function transformMenuItem(item: any): MenuOption {
  const children = item.children?.map(transformMenuItem)
  return {
    key: item.path,
    label: item.meta?.title || '未命名',
    icon: item.meta?.icon
        ? () => renderMenuIcon(item.meta.icon, item.meta?.title)
        : undefined,
    children: children?.length ? children : undefined,
  }
}

const menuOptions = computed<MenuOption[]>(() =>
    menuList.value.map(transformMenuItem)
)

const handleMenuSelect = (key: string) => {
  handleLink({path: key})
}
const getBreadcrumbs = () => {
  const path = route.path;
  const pathParts = path.split('/').filter(Boolean);
  const matched: any[] = [];

  // 2. 逐步推导父路径并从路由表中匹配 meta 信息
  let currentPath = '';
  pathParts.forEach((part) => {
    currentPath += `/${part}`;

    // 从路由表里寻找匹配的记录，获取它的 title 等 meta 信息
    const found = router.getRoutes().find(r => r.path === currentPath);

    if (found && found.meta?.title) {
      matched.push({
        path: found.path,
        meta: found.meta
      });
    } else {
      // 如果中间层级没有对应的路由记录（例如只是个文件夹名），也可以手动构造一个占位符
      matched.push({
        path: currentPath,
        meta: {title: part, clickable: false}
      });
    }
  });

  breadcrumbs.value = matched;
};
// 监听路由变化，实时更新面包屑
watch(() => route.path, () => getBreadcrumbs());
onMounted(() => getBreadcrumbs());

const handleLink = async (item: any) => {
  await router.push(item.path)
}
const cachedViews = computed(() => {
  return router.getRoutes()
      .filter(route => route.meta?.keepAlive && route.name)
      .map(route => route.name as string);
});

</script>

<style scoped lang="less">
.layout-root {
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
  border: 1px solid #a4a4a4;
  border-radius: 5px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .layout-wrapper {
    display: flex;
    position: relative;
    width: 100%;
    flex: 1;
    min-height: 0;
    padding: 10px;
    box-sizing: border-box;
    background: transparent;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

    :deep(.el-overlay) {
      position: absolute; /* 💡 关键：将固定定位改为绝对定位 */
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 2000; /* 确保遮罩层在该容器内的最上层 */
    }

    :deep(.el-drawer) {
      position: absolute;
    }

    .layout-menu {
      display: flex;
      flex: 1;
      min-height: 0;
      min-width: 0; /* ⭐ 新增：防止被子元素撑宽 */
      overflow: hidden; /* ⭐ 新增：切断溢出链条 */

      .layout-main {
        flex: 1;
        margin-left: 10px;
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0; // ⭐ 必须
        min-width: 0; /* ⭐ 确保 main 也不会被撑开 */
        overflow: hidden; /* ⭐ 确保 main 不会出现横向滚动条 */

        .layout-header {
          flex: 0 0 auto;

          .breadcrumb-item {
            display: inline-flex;
            align-items: center;
            gap: 6px;

            img {
              width: 18px;
              height: 18px;
              object-fit: contain;
              flex-shrink: 0;
            }
          }

          .no-redirect {
            cursor: default;
          }
        }

        .layout-content {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding-right: 10px;
        }
      }
    }
  }
}
</style>