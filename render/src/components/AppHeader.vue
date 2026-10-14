<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {useStore} from "@/store";
import {normalReload, reloadOptions, storeKeys} from "@mellifera/common/constant";
import {Minus as MinimizeIcon} from '@vicons/tabler'
import {RefreshRound as RefreshIcon} from '@vicons/material'
import {CopyOutline as RestoreDownIcon} from '@vicons/ionicons5'
import {PushpinOutlined as KeepOffIcon, PushpinFilled as KeepIcon, CloseOutlined as CloseIcon} from '@vicons/antd'
import {
  Maximize48Filled as MaximizeIcon,
  ArrowLeft12Filled as LeftIcon,
  ArrowRight12Filled as RightIcon,
} from '@vicons/fluent'
import type {DropdownOption} from "naive-ui";
import {type ReloadType} from "@mellifera/common/constant";

const store = useStore();
const windowTitle = computed(() => store.data.windowTitle);
const hideTray = ref(false);
const reloadDropdownOptions: DropdownOption[] = reloadOptions.map(option => ({
  label: option.label,
  key: option.value,
  enabled: option.enabled,
}))

function handleReloadSelect(key: ReloadType) {
  store.system.refresh(key).get()
}

async function handleTitleDblClick() {
  await store.system.maximize().get()
}

onMounted(async () => {
  hideTray.value = !!(await store.store.getData(storeKeys.hideTray).get() || false);
})
</script>

<template>
  <div class="app-header">
    <div style="display: flex;align-items: center;-webkit-app-region: no-drag"
         @dblclick="handleTitleDblClick">
      <img style="display: inline-block;margin: 0 5px 0 8px" src="~@/assets/icon/favicon-16.png"
           :alt="windowTitle"/>
      <span style="font-size: 14px">{{ windowTitle }}</span>
    </div>
    <div style="flex:1">

    </div>
    <div class="app-btn">
      <span class="custom">
        <n-button
            quaternary
            circle
            type="primary"
            :disabled="!store.syncData.system.canGoBack"
            @click="()=>store.system.goBack().get()"
        >
            <template #icon>
              <LeftIcon/>
            </template>
          </n-button>
        <n-button
            quaternary
            circle
            type="primary"
            :disabled="!store.syncData.system.canGoForward"
            @click="()=>store.system.goForward().get()"
        >
            <template #icon>
              <RightIcon/>
            </template>
          </n-button>
        <n-dropdown :options="reloadDropdownOptions" @select="handleReloadSelect">
           <n-button
               quaternary
               circle
               type="primary"
               @click="store.system.refresh(normalReload.value).get()"
           >
            <template #icon>
              <RefreshIcon/>
            </template>
          </n-button>
      </n-dropdown>
      </span>
      <n-divider vertical style="--n-color:rgb(0 0 0 / 0.5);width:2px"/>
      <n-tooltip>
        <template #trigger>
          <n-button
              quaternary
              circle
              :type="store.syncData.system.alwaysOnTop ? 'primary' : 'default'"
              style="margin-right: 5px"
              @click="store.system.setAlwaysOnTop(!store.syncData.system.alwaysOnTop).get()"
          >
            <template #icon>
              <KeepIcon v-if="store.syncData.system.alwaysOnTop"/>
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
        <n-button
            quaternary
            type="default"
            style="margin-right: 5px"
            @click="()=>store.system.minimize().get()"
        >
            <template #icon>
              <MinimizeIcon/>
            </template>
          </n-button>
        <n-button
            type="default"
            quaternary
            style="margin-right: 5px"
            @click="()=>store.system.maximize().get()"
        >
            <template #icon>
              <MaximizeIcon v-if="!store.syncData.system.maximize"/>
              <RestoreDownIcon style="transform: scaleX(-1);" v-else/>
            </template>
          </n-button>
        <n-button
            type="default"
            quaternary
            style="margin-right: 5px"
            @click="()=>store.system.close().get()"
        >
            <template #icon>
              <CloseIcon/>
            </template>
          </n-button>
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
  }
}

.suspension-gray {
  background-color: #f5f5f5;
}

.suspension-red {
  background-color: #f44336;
}
</style>