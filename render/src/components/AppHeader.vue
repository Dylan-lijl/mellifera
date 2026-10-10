<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {useStore} from "@/store";
import {normalReload, reloadOptions, storeKeys} from "@mellifera/common/constant";
import {Minus as MinimizeIcon} from '@vicons/tabler'
import {RefreshRound as RefreshIcon} from '@vicons/material'
import {PushpinOutlined as KeepOffIcon, PushpinFilled as KeepIcon, CloseOutlined as CloseIcon} from '@vicons/antd'
import {
  Maximize48Filled as MaximizeIcon,
  ArrowLeft12Filled as LeftIcon,
  ArrowRight12Filled as RightIcon,
  DividerTall20Filled as DividingLineIcon
} from '@vicons/fluent'
import type {DropdownOption} from "naive-ui";
import {type ReloadType} from "@mellifera/common/constant";

const store = useStore();
const windowTitle = computed(() => store.data.system.windowTitle);
const hideTray = ref(false);
const reloadDropdownOptions: DropdownOption[] = reloadOptions.map(option => ({
  label: option.label,
  key: option.value,
  enabled: option.enabled,
}))

function handleReloadSelect(key: ReloadType) {
  store.system.refresh(key).get()
}

onMounted(async () => {
  hideTray.value = !!(await store.store.getData(storeKeys.hideTray).get() || false);
})
</script>

<template>
  <div class="app-header">
    <div style="display: flex;align-items: center">
      <img width="16" height="16" style="display: inline-block;margin: 0 5px 0 8px" src="~@/assets/icon/favicon.png"
           :alt="windowTitle"/>
      <span style="font-size: 14px">{{ windowTitle }}</span>
    </div>
    <div class="app-btn">
      <span class="custom">
        <LeftIcon
            @click="()=>store.system.goBack().get()"
            :style="{color: store.data.system.canGoBack?'#409EFF':'#909399','--hover-bg':'#f5f5f5','--hover-color':store.data.system.canGoBack?'#409EFF':'#909399'}"/>
        <RightIcon
            @click="()=>store.system.goForward().get()"
            :style="{color: store.data.system.canGoForward?'#409EFF':'#909399','--hover-bg':'#f5f5f5','--hover-color':store.data.system.canGoForward?'#409EFF':'#909399'}"/>
        <span>
          <n-dropdown :options="reloadDropdownOptions" @select="handleReloadSelect">
            <RefreshIcon class="custom-icon"
                title="重载"
                @click="store.system.refresh(normalReload.value).get()"
            />
      </n-dropdown>
        </span>
      </span>
      <DividingLineIcon width="16px" height="16px" style="color: black;margin: 0 10px"/>
      <n-tooltip>
        <template #trigger>
          <n-button
              quaternary
              circle
              :type="store.data.system.alwaysOnTop ? 'primary' : 'default'"
              style="margin-right: 5px"
              @click="store.system.setAlwaysOnTop(!store.data.system.alwaysOnTop).get()"
          >
            <template #icon>
              <KeepIcon v-if="store.data.system.alwaysOnTop"/>
              <KeepOffIcon v-else/>
            </template>
          </n-button>
        </template>
        切换窗口是否置顶
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-switch
              v-model:value="hideTray"
              size="small"
              @update:value="(v:any) => store.store.saveData(storeKeys.hideTray, !!v).get()"
          />
        </template>
        {{ hideTray ? '关闭时隐藏到系统托盘' : '关闭时直接退出程序' }}
      </n-tooltip>
      <span class="system">
        <MinimizeIcon style="--hover-bg:#f5f5f5;--hover-color:#000" @click="()=>store.system.minimize().get()"
                      title="最小化"/>
        <MaximizeIcon style="--hover-bg:#f5f5f5;--hover-color:#000" @click="()=>store.system.maximize().get()"
                      title="最大化"/>
        <CloseIcon style="--hover-bg:#f44336;--hover-color:#fff" @click="()=>store.system.close().get()" title="关闭"/>
      </span>
    </div>
  </div>
</template>

<style scoped lang="less">
.app-header {
  display: flex;
  justify-content: space-between;
  -webkit-app-region: drag;

  .app-btn {
    -webkit-app-region: no-drag;
    display: flex;
    align-items: center;
    justify-content: right;

    .system {
      > * {
        padding: 8px 15px;
        width: 16px;
        height: 16px;
        color: black;

        &:hover {
          background-color: var(--hover-bg);
          color: var(--hover-color);
        }
      }
    }

    .custom {
      > *,.custom-icon{
        padding: 8px 4px;
        width: 16px;
        height: 16px;
        color: black;

        &:hover {
          background-color: var(--hover-bg);
          color: var(--hover-color);
        }
      }
    }
  }
}

.suspension-gray {
  background-color: #f5f5f5;
}

.suspension-red {
  background-color: #f44336;
}
</style>