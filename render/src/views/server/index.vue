<script setup lang="ts">
import {ref} from 'vue'
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInputNumber,
  NIcon,
  NSpace,
  NStatistic,
  NTag,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import {PlayOutline, StopOutline} from '@vicons/ionicons5'
import type {
  ListClientResponse, SearchRequest,
  ServerConfig
} from "@mellifera/common/entity";
import {
  contentContainer,
  networkType,
  networkTypeOptions,
  runState,
  runStateOptions,
  type RunStateType
} from "@mellifera/common/constant";
import {useStore} from "@/store";
import type {NetworkIpInfo} from "@mellifera/common/types";
import {Eye24Regular as Eye} from "@vicons/fluent"
import Detail from "./detail.vue";
import {createPagination} from "@mellifera/common/util";
import {formatDateTime, showError} from "@/util";
import type {SuperTableColumn} from "@/types";

const message = useMessage()
const store = useStore();
const formRef = ref<FormInst | null>(null)

const config = ref<ServerConfig>({
  mode: networkType.all.value,
  hosts: [],
  port: 5175
})
const hostOptions = ref<NetworkIpInfo[]>([]);
const clients = ref<ListClientResponse[]>([])

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

async function updateHosts() {
  if (store.apiState.service.server.getNetworkIpInfos.requesting.size) {
    return
  }
  hostOptions.value = await store.service.server.getNetworkIpInfos().get();

}

function handleAdd() {
  infoDesc.value.show = true;
  infoDesc.value.title = "添加连接";
}

async function handleDelete(row: ListClientResponse) {
  if (store.apiState.service.client.delete.requesting.has(row.id)) {
    return
  }
  try {
    await store.service.client.delete({id: row.id}).errorMessage((r) => showError(message, r))
        .get();
    clients.value = clients.value.filter(item => item.id !== row.id);
  } catch (error) {
    message.error('删除失败')
  }
}

function handlePageSizeChange(pageSize: number) {
  client.page.pageSize = pageSize;
  loadData()
}

function handleEdit(row: ListClientResponse) {
  infoDesc.value.show = true;
  infoDesc.value.title = "修改连接";
  infoDesc.value.data = row;
}

async function loadConfig() {
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

const infoDesc = ref({
  title: "",
  show: false,
  data: null as ListClientResponse | null,
});
const client = reactive<{
  data: ListClientResponse[];
  page: ReturnType<typeof createPagination>;
  param: SearchRequest;
  columns: SuperTableColumn<ListClientResponse>,
  checkedRowId: number | null,
}>({
  data: [],
  page: createPagination(loadData),
  param: {
    keyword: undefined,
  },
  checkedRowId: null,
  columns: [
    {
      title: '',
      key: 'selection',
      width: 'auto',
    },
    {
      title: 'ID',
      key: 'id',
      minWidth: 80,
      resizable: true,
      hidden: true,
    },
    {
      title: '名称',
      key: 'name',
      minWidth: 150,
      resizable: true,
    },
    {
      title: '认证令牌',
      key: 'token',
      minWidth: 170,
      resizable: true,
    },
    {
      title: '状态',
      key: 'enabled',
      minWidth: 80,
      resizable: true,
    },
    {
      title: '描述',
      key: 'description',
      width: 150,
      resizable: true,
    }, {
      title: '创建时间',
      key: 'createdAt',
      width: 180,
      resizable: true,
    }, {
      title: '修改时间',
      key: 'updatedAt',
      width: 180,
      resizable: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right',
      resizable: true,
    },
  ]
});

async function loadData() {
  if (store.apiState.service.client.searchAndPage.requesting.size) {
    return;
  }
  const data = await store.service.client.searchAndPage(client.page.get(client.param))
      .errorMessage((r) => showError(message, r))
      .get();
  client.data = data.list;
}

function reloadData() {
  if (store.apiState.service.client.searchAndPage.requesting.size) {
    return;
  }
  client.page.current = 1;
  loadData();
}

function infoSuccess(item: ListClientResponse | null) {
  if (!item) {
    return;
  }
  if (infoDesc.value.data) {
    //替换
    let index = client.data.findIndex((o) => o.id === item.id);
    if (index > -1) {
      client.data[index] = item;
    }
  } else {
    client.page.total += 1;
    const maxPage = Math.ceil(client.page.total / client.page.pageSize) || 1;
    const isLastPage = client.page.current === maxPage;
    const isPageNotFull = client.data.length < client.page.pageSize;
    if (isLastPage && isPageNotFull) {
      client.data.push(item);
    }
  }
  infoDesc.value.show = false;
}

onMounted(() => {
  loadConfig()
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
        <n-button @click="loadConfig" :loading="!!store.apiState.service.server.getConfig.requesting.size">
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

      <!--      <n-grid-item>
              <n-card size="small">
                <n-statistic label="在线连接" :value="onlineCount"/>
              </n-card>
            </n-grid-item>-->

      <!--      <n-grid-item>
              <n-card size="small">
                <n-statistic label="活动映射" :value="mappingCount"/>
              </n-card>
            </n-grid-item>-->
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
    <n-card title="客户端" class="section-card">
      <template #header-extra>
        <ColumnVisibility :columns="client.columns"/>
        <n-button type="info" quaternary @click="reloadData">刷新</n-button>
        <n-button type="primary" quaternary @click="handleAdd">新增</n-button>
      </template>

      <SupperTable
          :columns="client.columns.filter((item:SuperTableColumn<ListClientResponse>)=>!item.hidden)"
          :data="client.data"
          :bordered="false"
          :single-line="false"
      >
        <template #render="{row,column}">
          <template v-if="column.key==='selection'">
            <n-radio
                :value="row.id"
                :checked="client.checkedRowId === row.id"
                @click.prevent=" client.checkedRowId = client.checkedRowId === row.id ? null : row.id"
            />
          </template>
          <template v-if="column.key==='enabled'">
            <n-tag :type="row.enabled?'success':'warning'">{{ row.enabled ? '已启用' : '已禁用' }}</n-tag>
          </template>
          <template v-else-if="column.key==='createdAt'||column.key==='updatedAt'">
            {{ formatDateTime(row.createdAt) }}
          </template>
          <template v-else-if="column.key==='updatedAt'">
            {{ formatDateTime(row.updatedAt) }}
          </template>
          <template v-else-if="column.key==='actions'">
            <n-button type="info" quaternary @click="()=>handleEdit(row)">编辑</n-button>
            <n-popconfirm
                @positive-click="()=>handleDelete(row)"
            >
              <template #trigger>
                <n-button type="error" quaternary>删除</n-button>
              </template>
              删除后对应用户将无法连接,确定要删除吗?
            </n-popconfirm>
          </template>
          <template v-else>
            {{ row[column.key as keyof ListClientResponse] }}
          </template>
        </template>
      </SupperTable>
      <div style="margin-block-start: 4px">
        <n-pagination
            v-model:page="client.page.current"
            v-model:page-size="client.page.pageSize"
            :item-count="client.page.total"
            show-size-picker
            :page-sizes="client.page.pageSizes"
            @update:page="loadConfig"
            @update:page-size="handlePageSizeChange"
        />
      </div>
    </n-card>
    <NDrawer
        v-model:show="infoDesc.show"
        placement="right"
        :width="'50%'"
        :to="'.'+contentContainer"
        :auto-focus="false"
    >
      <NDrawerContent :title="infoDesc.title" closable>
        <Detail
            :data="infoDesc.data"
            @success="infoSuccess"
            @close="()=>infoDesc.show = false"
        />
      </NDrawerContent>
    </NDrawer>
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

</style>
