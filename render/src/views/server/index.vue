<script setup lang="ts">
import {computed, h, ref} from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInputNumber,
  NPopconfirm,
  NIcon,
  NSpace,
  NStatistic,
  NTag,
  NText,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import {PlayOutline, StopOutline} from '@vicons/ionicons5'
import {type ServerConfig} from "@mellifera/common/entity";
import {
  networkType,
  networkTypeOptions,
  runState,
  runStateOptions,
  type RunStateType
} from "@mellifera/common/constant";
import {useStore} from "@/store";
import type {NetworkIpInfo} from "@mellifera/common/types";
import {Eye24Regular as Eye} from "@vicons/fluent"

interface ClientInfo {
  id: number
  name: string
  address: string
  connectedAt: string
  status: 'connected' | 'disconnected'
  mappingCount: number
}

const message = useMessage()
const store = useStore();
const formRef = ref<FormInst | null>(null)

const config = ref<ServerConfig>({
  mode: networkType.all.value,
  hosts: [],
  port: 5175
})
const hostOptions = ref<NetworkIpInfo[]>([]);
const clients = ref<ClientInfo[]>([])

const onlineCount = computed(
    () => clients.value.filter(item => item.status === 'connected').length,
)

const mappingCount = computed(
    () =>
        clients.value
            .filter(item => item.status === 'connected')
            .reduce((sum, item) => sum + item.mappingCount, 0),
)
watch(() => config.value.mode, () => {
  if (config.value.mode === networkType.selected.value) {
    updateHosts();
  }
})
const rules: FormRules = {
  name: [
    {required: true, message: '请输入服务名称', trigger: 'blur'},
    {max: 100, message: '服务名称不能超过 100 个字符', trigger: 'blur'},
  ],
  host: [
    {required: true, message: '请输入监听地址', trigger: 'blur'},
  ],
  port: [
    {
      required: true,
      type: 'number',
      min: 1,
      max: 65535,
      message: '端口范围为 1～65535',
      trigger: ['blur', 'change'],
    },
  ],
}

const clientColumns: DataTableColumns<ClientInfo> = [
  {
    title: '客户端名称',
    key: 'name',
    minWidth: 150,
  },
  {
    title: '客户端地址',
    key: 'address',
    minWidth: 180,
  },
  {
    title: '连接时间',
    key: 'connectedAt',
    minWidth: 170,
  },
  {
    title: '端口映射',
    key: 'mappingCount',
    width: 100,
    render(row) {
      return `${row.mappingCount} 条`
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 110,
    render(row) {
      return h(
          NTag,
          {
            type: row.status === 'connected' ? 'success' : 'default',
            bordered: false,
          },
          {
            default: () =>
                row.status === 'connected' ? '已连接' : '已断开',
          },
      )
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      if (row.status !== 'connected') return '-'

      return h(
          NPopconfirm,
          {
            onPositiveClick: () => handleDisconnect(row),
          },
          {
            trigger: () =>
                h(
                    NButton,
                    {size: 'small', type: 'error', secondary: true},
                    {default: () => '断开连接'},
                ),
            default: () => `确定断开客户端「${row.name}」吗？`,
          },
      )
    },
  },
]

async function updateHosts() {
  if (store.apiState.service.server.getNetworkIpInfos.requesting.size) {
    return
  }
  hostOptions.value = await store.service.server.getNetworkIpInfos().get();

}

async function loadData() {
  if (!store.apiState.service.server.getConfig.requesting.size) {
    try {
      config.value = await store.service.server.getConfig().get();
    } catch {

    }
  }
}

async function handleSave() {
  if (store.apiState.service.server.saveConfig.requesting.size) {
    return
  }
  await store.service.server.saveConfig(config.value).get();
}

async function handleStart() {
  if (store.apiState.service.server.start.requesting.size
      || ([runState.starting.value, runState.running.value] as RunStateType[]).includes(store.syncData.server.running)) {
    return
  }
  await store.service.server.start().get();
}

async function handleStop() {
  if (store.apiState.service.server.stop.requesting.size
      || ([runState.stopping.value, runState.idle.value] as RunStateType[]).includes(store.syncData.server.running)) {
    return
  }
  await store.service.server.stop().get();
}

async function handleDisconnect(client: ClientInfo) {
  try {
    // TODO: 调用服务端断开指定客户端的 API。
    message.info(`请接入断开客户端 ${client.name} 的 API`)
  } catch {
    message.error('断开客户端失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
<template>
  <div class="server-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <div>
        <h2>服务管理</h2>
        <p>管理本机服务端，查看客户端连接与端口映射状态</p>
        <p v-if="store.syncData.server.error" style="font-size: 14px;color:red">{{ store.syncData.server.error }}</p>
      </div>

      <n-space>
        <n-button @click="loadData" :loading="!!store.apiState.service.server.getConfig.requesting.size">
          刷新
        </n-button>
        <n-button
            v-if="([runState.idle.value,runState.starting.value] as RunStateType[]).includes(store.syncData.server.running)"
            type="primary"
            :loading="runState.starting.value===store.syncData.server.running||!!store.apiState.service.server.start.requesting.size"
            @click="handleStart"
        >
          <template #icon>
            <n-icon>
              <PlayOutline/>
            </n-icon>
          </template>
          启动服务
        </n-button>
        <n-button
            v-if="([runState.running.value,runState.stopping.value] as RunStateType[]).includes(store.syncData.server.running)"
            type="error"
            :loading="runState.stopping.value===store.syncData.server.running||!!store.apiState.service.server.stop.requesting.size"
            @click="handleStop"
        >
          <template #icon>
            <n-icon>
              <StopOutline/>
            </n-icon>
          </template>
          停止服务
        </n-button>
      </n-space>
    </div>

    <!-- 状态概览 -->
    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen">
      <n-grid-item>
        <n-card size="small">
          <n-statistic label="服务状态">
            <template #default>
              <n-tag v-for="item in runStateOptions.filter(o=>o.value===store.syncData.server.running)"
                     :type="item.type">
                {{ item.label }}
              </n-tag>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>

      <n-grid-item v-if="store.syncData.server.port">
        <n-card size="small">
          <n-statistic label="监听端口" :value="store.syncData.server.port"/>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card size="small">
          <n-statistic label="在线连接" :value="onlineCount"/>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card size="small">
          <n-statistic label="活动映射" :value="mappingCount"/>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 服务端配置 -->
    <n-card title="服务端配置" class="section-card">
      <n-form
          ref="formRef"
          :model="config"
          :rules="rules"
          label-placement="left"
          label-width="110"
          :disabled="store.syncData.server.running!==runState.idle.value"
      >
        <n-form-item label="监听模式" path="mode">
          <n-radio-group v-model:value="config.mode">
            <n-radio
                v-for="item in networkTypeOptions"
                :key="item.value"
                :value="item.value"
                :disabled="!item.enabled"
            >
              {{ item.label }}
            </n-radio>
          </n-radio-group>
        </n-form-item>

        <n-form-item
            v-if="config.mode === networkType.selected.value"
            label="监听地址"
            path="host"
        >
          <n-checkbox-group v-model:value="config.hosts">
            <n-checkbox v-for="item in hostOptions" :value="item.address">
                <span style="display: flex">
                  <span>{{ item.address }}</span>
                  <n-popover trigger="hover">
                    <template #trigger>
                      <n-button type="primary" style="height: unset" :bordered="false" ghost><template #icon><Eye/></template></n-button>
                    </template>
                    <div>
                      <n-descriptions label-placement="left" title="网卡信息" :column="1" size="small">
                          <n-descriptions-item label="网卡名称">{{ item.name }}</n-descriptions-item>
                          <n-descriptions-item label="IP 地址">{{ item.address }}</n-descriptions-item>
                          <n-descriptions-item label="协议版本">IPV{{ item.family }}</n-descriptions-item>
                          <n-descriptions-item label="MAC 地址">{{ item.mac }}</n-descriptions-item>
                          <n-descriptions-item
                              label="是否内部地址">{{ item.internal ? '是' : '否' }}</n-descriptions-item>
                          <n-descriptions-item label="子网掩码">IPV{{ item.netmask }}</n-descriptions-item>
                          <n-descriptions-item label="CIDR 前缀长度">IPV{{ item.cidr }}</n-descriptions-item>
                      </n-descriptions>
                    </div>
                  </n-popover>
                </span>
            </n-checkbox>
          </n-checkbox-group>
        </n-form-item>

        <n-form-item label="监听端口" path="port">
          <n-input-number
              v-model:value="config.port"
              :min="1"
              :max="65535"
              :precision="0"
              class="full-width"
              placeholder="请输入监听端口"
          />
        </n-form-item>
        <div class="form-footer">
          <div style="text-align: right;width: 100%">
            <div v-if="store.syncData.server.running!==runState.idle.value"
                 style="font-size: 14px;color: #a4a4a4;text-align: left">
              服务运行期间不能修改监听配置，请先停止服务。
            </div>
            <n-button
                type="primary"
                :disabled="store.syncData.server.running!==runState.idle.value"
                :loading="!!store.apiState.service.server.saveConfig.requesting.size"
                @click="handleSave"
            >
              保存
            </n-button>
          </div>
        </div>
      </n-form>
    </n-card>

    <!-- 在线连接 -->
    <n-card title="客户端连接" class="section-card">
      <template #header-extra>
        <n-text depth="3">{{ clients.length }} 条记录</n-text>
      </template>

      <n-data-table
          :columns="clientColumns"
          :data="clients"
          :pagination="{ pageSize: 5 }"
          :bordered="false"
          :single-line="false"
      />

      <n-empty
          v-if="clients.length === 0"
          description="暂无客户端连接"
          class="empty-state"
      />
    </n-card>
  </div>
</template>
<style scoped>
.server-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.page-header p {
  margin: 8px 0 0;
  font-size: 13px;
}

.section-card {
  min-width: 0;
}

.full-width {
  width: 100%;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 8px;
}

.empty-state {
  padding: 24px 0;
}

@media (max-width: 760px) {
  .service-page {
    padding: 12px;
  }

  .page-header,
  .form-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
