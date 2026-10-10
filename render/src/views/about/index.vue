<template>
  <div class="view-about">
    <div v-if="appInfo" style="width: 95%; display: inline-block">
      <div>
        <img src="@/assets/icon/favicon-128.png" alt="logo"/>
        <n-tabs v-model:value="activeName">
          <n-tab-pane :name="activeMap.basic" tab="基础信息">
            <div class="app-title">
              <span style="font-weight: bolder; font-size: larger">
                {{ appInfo.name }}
              </span>
            </div>
            <n-form label-placement="left" label-width="60">
              <n-form-item label="版本">
                {{ appInfo.version }}
              </n-form-item>
              <n-form-item label="环境">
                {{ appInfo.env }}
              </n-form-item>
              <n-form-item label="平台">
                {{ appInfo.platform.name }} {{ appInfo.platform.version }}
              </n-form-item>
            </n-form>
          </n-tab-pane>
          <n-tab-pane :name="activeMap.path" tab="路径">
            <n-form label-placement="left" label-width="80">
              <n-form-item
                  v-for="item in appPathOptions"
                  :key="item.key"
                  :label="item.label"
              >
                <n-button
                    text
                    type="primary"
                    :loading="requesting[item.key]"
                    @click="openDir(item.key)"
                >
                  {{ appInfo.path[item.key] }}
                </n-button>
              </n-form-item>
            </n-form>
          </n-tab-pane>
          <n-tab-pane :name="activeMap.updateLog" tab="更新日志">
            <n-timeline class="update-timeline">
              <n-timeline-item
                  v-for="(activity, index) in updateLogs"
                  :key="index"
                  :time="activity.createTime.toLocaleString()"
                  type="info"
                  placement="left"
              >
                <n-card size="small">
                  <h4>{{ activity.title }}</h4>
                  <p class="update-version">{{ activity.version }}</p>
                  <p>{{ activity.content }}</p>
                </n-card>
              </n-timeline-item>
            </n-timeline>
          </n-tab-pane>
        </n-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {type AppPath} from '@mellifera/common/types'
import {useStore} from '@/store'
import {updateLogs} from "@mellifera/common/constant"

const activeMap = {
  basic: 'basic',
  path: 'path',
  updateLog: 'updateLog',
}

const pathLabels: Record<keyof AppPath, string> = {
  appData: '应用数据',
  assets: '资源目录',
  sessionData: '会话数据',
  temp: '临时文件',
  exe: '执行文件',
  module: '内核路径',
  logs: '日志文件',
  crashDumps: '崩溃日志',
  appPath: '应用目录',
}

const appPathOptions = Object.entries(pathLabels).map(([key, label]) => ({
  key: key as keyof AppPath,
  label,
}))

const requesting = ref({} as Partial<Record<keyof AppPath, boolean>>)

const store = useStore()
const appInfo = computed(() => store.data.appInfo)
const activeName = ref(activeMap.updateLog)

function openDir(key: keyof AppPath) {
  if (requesting.value[key] || !appInfo.value || !appInfo.value.path[key]) {
    return
  }

  requesting.value[key] = true

  store.system.openFileDir(appInfo.value.path[key]).get().finally(() => {
    requesting.value[key] = false
  })
}
</script>

<style scoped lang="less">
.view-about {
  text-align: center;
}

.app-title {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.update-timeline {
  margin-top: 40px;
  text-align: left;
}

.update-version {
  font-size: 12px;
  color: #666;
}
</style>