<template>
  <div class="connection-layout">
    <div class="page-header">
      <div>
        <div class="page-title">连接管理</div>
        <div class="page-description">
          管理服务端连接及对应的端口映射
        </div>
      </div>
      <div class="page-utils">
        <n-button type="info" @click="()=>reloadData()" ghost :bordered="false">
          <template #icon>
            <n-icon>
              <Refresh/>
            </n-icon>
          </template>
          刷新
        </n-button>
        <n-button type="primary" @click="handleAdd" ghost :bordered="false">
          <template #icon>
            <n-icon>
              <AddOutline/>
            </n-icon>
          </template>
          添加连接
        </n-button>
      </div>
    </div>

    <div class="connection-list">
      <n-card
          v-for="(item,index) in connection.data"
          :key="item.id"
          class="connection-card"
          :bordered="true"
      >
        <div class="connection-header">
          <div class="connection-info">
            <div class="connection-icon">
              {{ index }}
            </div>

            <div class="connection-detail">
              <div class="connection-name">
                <span>{{ item.name }}</span>

                <n-tag
                    :type="store.syncData.connection.details.get(item.id)?.running===runState.running.value ? 'success' : 'default'"
                    size="small"
                    ghost :bordered="false"
                >
                  {{
                    store.syncData.connection.details.get(item.id)?.running === runState.running.value ? '已连接' : '未连接'
                  }}
                </n-tag>
              </div>

              <div class="connection-address">
                {{ item.host }}:{{ item.port }}
              </div>
            </div>
          </div>

          <div class="connection-actions">
            <n-button
                v-if="store.syncData.connection.details.get(item.id)?.running===runState.running.value"
                size="small"
                type="error"
                secondary
                :loading="store.apiState.service.connection.disconnect.requesting.has(item.id)"
                @click="handleDisconnect(item)"
            >
              断开
            </n-button>

            <n-button
                v-else
                size="small"
                type="primary"
                :loading="store.apiState.service.connection.connect.requesting.has(item.id)"
                @click="handleConnect(item)"
                ghost
            >
              连接
            </n-button>
            <n-button type="primary" size="small" @click="()=>handleEdit(item)" ghost :bordered="false"
                      :disabled="store.syncData.connection.details.get(item.id)?.running===runState.running.value">
              <template #icon>
                <EditFilled/>
              </template>
              编辑
            </n-button>
            <n-button type="error" size="small" @click="()=>handleDelete(item)" ghost :bordered="false"
                      :disabled="store.syncData.connection.details.get(item.id)?.running===runState.running.value">
              <template #icon>
                <DeleteFilled/>
              </template>
              删除
            </n-button>
            <!--            <n-popover trigger="hover" placement="bottom-end">
                          <template #trigger>
                            <n-button quaternary circle size="small">
                              <template #icon>
                                <n-icon>
                                  <EllipsisHorizontal/>
                                </n-icon>
                              </template>
                            </n-button>
                          </template>
                          <div>
                            <div>
                              <n-button type="primary" size="small" @click="()=>handleEdit(item)" ghost :bordered="false">
                                <template #icon>
                                  <EditFilled/>
                                </template>
                                编辑
                              </n-button>
                            </div>
                            <n-divider style="margin: 4px 0"/>
                            <div>
                              <n-button type="error" size="small" @click="()=>handleDelete(item)" ghost :bordered="false">
                                <template #icon>
                                  <DeleteFilled/>
                                </template>
                                删除
                              </n-button>
                            </div>
                          </div>
                        </n-popover>-->
          </div>
        </div>

        <n-divider/>

        <div class="mapping-header">
          <div class="mapping-title">
            <span>端口映射</span>
            <n-text depth="3" class="mapping-count">
              <span>{{ store.syncData.connection.details.get(item.id)?.connected?.size ?? 0 }}</span>/
              <span>{{ mappingMap.get(item.id)?.length ?? 0 }}</span>
            </n-text>
          </div>
          <div style="display: flex;align-items: center;">
            <ColumnVisibility :columns="mappingColumns"/>
            <n-button
                secondary
                :disabled="store.syncData.connection.details.get(item.id)?.running!==runState.running.value"
                @click="handleAddMapping(item)"
            >
              <template #icon>
                <n-icon>
                  <AddOutline/>
                </n-icon>
              </template>
              添加映射
            </n-button>
          </div>
        </div>
        <SupperTable
            v-if="!!(mappingMap.get(item.id)?.length)"
            :columns="mappingColumns.filter((i:SuperTableColumn<ListConnectionMappingResponse>)=>!i.hidden)"
            :data="mappingMap.get(item.id)!"
            :row-key="(row) => row.id"
            :bordered="false"
            :single-line="false"
            size="small"
        >
          <template #render="{row,column}">
            <template v-if="column.key==='enabled'">
              <NPopconfirm @positive-click="()=>handlePositiveClick(row)">
                <template #trigger>
                  <NButton :type="row.enabled?'success':'error'" secondary>{{ row.enabled ? '已启用' : '已禁用' }}
                  </NButton>
                </template>
                <span v-show="row.enabled">
                  禁用会断开正在运行的连接,同时不响应服务端的代理请求,确定禁用吗
                </span>
                <span v-show="!row.enabled">
                  开启后响应服务端代理请求,确定开启吗
                </span>
              </NPopconfirm>
            </template>
            <template v-else-if="column.key==='autoUpdate'">
              <NPopconfirm @positive-click="()=>handlePositiveClick(row,false)">
                <template #trigger>
                  <NButton :type="row.autoUpdate?'success':'error'" secondary>{{ row.autoUpdate ? '已启用' : '已禁用' }}
                  </NButton>
                </template>
                <span v-show="row.autoUpdate">
                  禁用后,服务端修改映射连接信息后,会自动禁用,需要手动开启,确定禁用吗
                </span>
                <span v-show="!row.autoUpdate">
                  开启后,服务端修改映射连接信息后,会自动更新连接信息,确定开启吗(非常信任该服务器)
                </span>
              </NPopconfirm>
            </template>
            <template v-else-if="column.key==='remoteRemove'">
              <NTag :type="row.remoteRemove?'error':'default'">{{ row.remoteRemove ? '是' : '否' }}</NTag>
            </template>
            <template v-else-if="column.key==='name'">
              {{ row.remoteConfig?.name ?? '' }}
            </template>
            <template v-else-if="column.key==='protocol'">
              <div>
                {{ transportProtocolOptions.find(i => i.value === row.remoteConfig?.protocol)?.label ?? '未知' }}
              </div>
              <div v-if="row.appliedConfig?.protocol!==row.remoteConfig?.protocol" class="old-mapping-value">
                {{ transportProtocolOptions.find(i => i.value === row.remoteConfig?.protocol)?.label ?? '未知' }}
              </div>
            </template>
            <template v-else-if="column.key==='targetHost'">
              <div>
                {{ row.remoteConfig?.targetHost }}
              </div>
              <div v-if="row.appliedConfig?.targetHost!==row.remoteConfig?.targetHost" class="old-mapping-value">
                {{ row.remoteConfig?.targetHost }}
              </div>
            </template>
            <template v-else-if="column.key==='targetPort'">
              <div>
                {{ row.remoteConfig?.targetPort }}
              </div>
              <div v-if="row.appliedConfig?.targetPort!==row.remoteConfig?.targetPort" class="old-mapping-value">
                {{ row.remoteConfig?.targetPort }}
              </div>
            </template>
            <template v-else-if="column.key==='listenPort'">
              <div>
                {{ row.remoteConfig?.listenPort }}<span
                  v-if="row.remoteConfig?.listenPort===0&&row.enabled&&store.syncData.connection.details?.get(item.id)?.connected?.get(row.id)">
                ({{ store.syncData.connection.details?.get(item.id)?.connected?.get(row.id)?.runningPort }})
              </span>
              </div>
              <div v-if="row.appliedConfig?.listenPort!==row.remoteConfig?.listenPort" class="old-mapping-value">
                {{ row.remoteConfig?.listenPort }}
              </div>
            </template>
            <template v-else-if="column.key==='disabledPorts'&&row.remoteConfig?.listenPort===0">
              <div>
                {{ row.remoteConfig?.disabledPorts }}
              </div>
              <!--如果里面顺序不一样也会匹配失败,暂时不解决,要么拆分成数组逐个对比,要么添加的时候排序完并插入-->
              <div v-if="row.remoteConfig?.disabledPorts!==row.appliedConfig?.disabledPorts" class="old-mapping-value">
                {{ row.appliedConfig?.disabledPorts }}
              </div>
            </template>
            <template v-else-if="column.key==='description'">
              {{ row.remoteConfig?.description ?? '' }}
            </template>
            <template v-else-if="column.key==='createdAt'">
              {{ formatDateTime(row.remoteConfig?.createdAt) }}
            </template>
            <!--            修改时间可以取配置跟远程配置最大时间-->
            <template v-else-if="column.key==='updatedAt'">
              {{ formatDateTime(row.remoteConfig?.updatedAt) }}
            </template>
            <template v-else-if="column.key==='actions'">
              <NButton quaternary @click="()=>handleEditMapping(row)" type="info"
                       :disabled="store.syncData.connection.details.get(item.id)?.running!==runState.running.value">编辑
              </NButton>
              <NPopconfirm @positive-click="()=>handleDeleteMapping(row)">
                <template #trigger>
                  <NButton quaternary type="error"
                           :disabled="store.syncData.connection.details.get(item.id)?.running!==runState.running.value">
                    删除
                  </NButton>
                </template>
                确认删除吗?
              </NPopconfirm>
              <NButton quaternary type="warning"
                       v-if="store.syncData.connection.details.get(item.id)?.connected?.get(row.id)">断开
              </NButton>
            </template>
            <template v-else>
              {{ (row as any)[column.key] }}
            </template>
          </template>
        </SupperTable>

        <n-empty
            v-else
            description="暂无端口映射"
            class="mapping-empty"
        />
      </n-card>

      <n-empty
          v-if="!connection.data.length"
          description="暂无服务端连接"
          class="connection-empty"
      >
      </n-empty>
    </div>
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
    <NDrawer
        v-model:show="mappingInfoDesc.show"
        placement="right"
        :width="'50%'"
        :to="'.'+contentContainer"
        :auto-focus="false"
    >
      <NDrawerContent :title="mappingInfoDesc.title" closable>
        <MappingDetail
            :from-client="true"
            :data="mappingInfoDesc.data"
            :clientId="mappingInfoDesc.clientId"
            @success="infoMappingSuccess"
            @close="()=>mappingInfoDesc.show = false"
        />
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import {
  NButton,
  NIcon,
  NTag,
  NText,
  NDivider,
  NEmpty,
  NCard,
  useMessage, useDialog,
} from 'naive-ui'
import {
  AddOutline,
  Refresh,
} from '@vicons/ionicons5'
import {EditFilled, DeleteFilled} from '@vicons/antd'
import {createPagination} from "@mellifera/common/util";
import type {
  SearchRequest,
  ListConnectionResponse,
  InfoConnectionResponse, ListConnectionMappingResponse, UpdateConnectionMappingRequest
} from "@mellifera/common/entity";
import {useStore} from "@/store";
import Detail from "./detail.vue"
import {contentContainer, runState, transportProtocolOptions} from "@mellifera/common/constant";
import type {SuperTableColumn} from "@/types";
import {formatDateTime, showError} from "@/util";
import MappingDetail from "@/views/server/mappingDetail.vue";

const dialog = useDialog()
const message = useMessage()
const store = useStore();
const infoDesc = ref({
  title: "",
  show: false,
  data: null as ListConnectionResponse | null,
});
const mappingInfoDesc = ref({
  title: "",
  show: false,
  data: null as ListConnectionMappingResponse | null,
  clientId: 0,
});
const connection = ref<{
  data: ListConnectionResponse[];
  page: ReturnType<typeof createPagination>;
  param: SearchRequest;
}>({
  data: [],
  page: createPagination(reloadData),
  param: {
    keyword: undefined,
  },
});
const mappingMap = ref(new Map<number, ListConnectionMappingResponse[]>());

async function reloadData() {
  if (store.apiState.service.connection.searchAndPage.requesting.size) {
    return;
  }
  const data = await store.service.connection.searchAndPage(connection.value.page.get(connection.value.param)).errorMessage(r => showError(message, r)).get();
  (connection.value.data = data.list).forEach(item => reloadMappingData(item.id))
}

async function reloadMappingData(id: number) {
  if (store.apiState.service.connection.mapping.load.requesting.has(id)) {
    return;
  }
  const r = await store.service.connection.mapping.load({id}).errorMessage(r => showError(message, r)).get()
  mappingMap.value.set(id, r);
}

const mappingColumns: SuperTableColumn<ListConnectionMappingResponse> = reactive([
  {
    title: '主键',
    key: 'id',
    minWidth: 80,
    hidden: true,
  }, {
    title: '远程主键',
    key: 'remoteId',
    minWidth: 80,
    hidden: true,
  }, {
    title: '连接主键',
    key: 'connectionId',
    minWidth: 80,
    hidden: true,
  },
  {
    title: '启用',
    key: 'enabled',
    minWidth: 70,
    resizable: true,
  }, {
    title: '自动更新',
    key: 'autoUpdate',
    minWidth: 70,
    resizable: true,
  }, {
    title: '已删除',
    key: 'remoteRemove',
    minWidth: 70,
    resizable: true,
  },
  //=========映射字段============
  {
    title: '名称',
    key: 'name',
    minWidth: 150,
    resizable: true,
  }, {
    title: '传输协议',
    key: 'protocol',
    minWidth: 90,
    resizable: true,
  },
  {
    title: '映射端口',
    key: 'listenPort',
    minWidth: 90,
    resizable: true,
  }, {
    title: '目标主机',
    key: 'targetHost',
    minWidth: 170,
    resizable: true,
  }, {
    title: '目标端口',
    key: 'targetPort',
    minWidth: 90,
    resizable: true,
  },
  {
    title: '禁用端口',
    key: 'disabledPorts',
    minWidth: 110,
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
    align: 'right',
    fixed: 'right',
  },
]);

function handleAdd() {
  infoDesc.value.show = true;
  infoDesc.value.title = "添加连接";
}

async function handleConnect(item: ListConnectionResponse) {
  if (store.apiState.service.connection.connect.requesting.has(item.id)) {
    return;
  }
  await store.service.connection.connect({id: item.id}).errorMessage(r => showError(message, r)).get();
}

async function handleDisconnect(item: ListConnectionResponse) {
  if (store.apiState.service.connection.disconnect.requesting.has(item.id)) {
    return;
  }
  await store.service.connection.disconnect({id: item.id}).errorMessage(r => showError(message, r)).get();
}

function handleEdit(item: ListConnectionResponse) {
  infoDesc.value.data = item;
  infoDesc.value.title = `编辑${item.name}`
  infoDesc.value.show = true;
}

function handleDelete(item: ListConnectionResponse) {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除' + item.name + '这个连接吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (store.apiState.service.connection.delete.requesting.has(item.id)) {
        return
      }
      await store.service.connection.delete({id: item.id}).errorMessage(r => showError(message, r)).get();
      connection.value.data = connection.value.data.filter(dist => dist.id !== item.id);
      connection.value.page.total = Math.max(0, connection.value.page.total - 1);
      if (connection.value.data.length === 0 && connection.value.page.current > 1) {
        const maxPage = Math.ceil(connection.value.page.total / connection.value.page.pageSize) || 1;
        if (connection.value.page.current > maxPage) {
          connection.value.page.current = maxPage;
        }
        await reloadData();
      }
    },
  })
}

function handleAddMapping(item: ListConnectionResponse) {
  mappingInfoDesc.value.show = true;
  mappingInfoDesc.value.title = `为 ${item.name} 添加映射`;
  mappingInfoDesc.value.data = null;
  mappingInfoDesc.value.clientId = item.id;
}

async function handlePositiveClick(row: ListConnectionMappingResponse, isEnabled = true) {
  //修改enabled状态
  const p: UpdateConnectionMappingRequest = {id: row.id}
  if (isEnabled) {
    p.enabled = !row.enabled;
  } else {
    p.autoUpdate = !row.autoUpdate;
  }
  const r = await store.service.connection.mapping.update(p).errorMessage((r) => showError(message, r)).get();
  if (!r) {
    return;
  }
  if (isEnabled) {
    row.enabled = p.enabled!;
  } else {
    row.autoUpdate = p.autoUpdate!;
  }
}

function handleEditMapping(row: ListConnectionMappingResponse) {
  mappingInfoDesc.value.show = true;
  mappingInfoDesc.value.title = `${row?.appliedConfig?.name ?? row?.remoteConfig?.name ?? row.id}`;
  mappingInfoDesc.value.data = row;
  mappingInfoDesc.value.clientId = row.connectionId;
}

function handleDeleteMapping(row: ListConnectionMappingResponse) {
  message.info(`删除映射：${row?.appliedConfig?.name ?? row?.remoteConfig?.name ?? row.id}`)
}

function infoMappingSuccess(info: ListConnectionMappingResponse | null) {
  if (!info || !info.connectionId) {
    return;
  }
  const connectionId = info.connectionId
  // 1. 获取当前 connectionId 下的列表，没有则初始化为空数组
  const list = mappingMap.value.get(connectionId) || []
  // 2. 查找数组中是否已经存在该项（假设每条数据有唯一的 id）
  const index = list.findIndex(item => item.id === info.id)
  if (index !== -1) {
    // 3a. 存在则替换（更新）
    list[index] = info
  } else {
    // 3b. 不存在则追加
    list.push(info)
  }
  // 4. 将更新后的数组重新 set 回 Map 中，确保 Vue 3 能够触发响应式更新
  mappingMap.value.set(connectionId, [...list])
}

function infoSuccess(item: InfoConnectionResponse | null) {
  if (!item) {
    return;
  }
  if (infoDesc.value.data) {
    //替换
    let index = connection.value.data.findIndex((o) => o.id === item.id);
    if (index > -1) {
      connection.value.data[index] = item;
    }
  } else {
    connection.value.page.total += 1;
    const maxPage = Math.ceil(connection.value.page.total / connection.value.page.pageSize) || 1;
    const isLastPage = connection.value.page.current === maxPage;
    const isPageNotFull = connection.value.data.length < connection.value.page.pageSize;
    if (isLastPage && isPageNotFull) {
      connection.value.data.push(item);
    }
  }
  infoDesc.value.show = false;
}

onMounted(() => {
  reloadData();
})
</script>

<style scoped lang="less">
.connection-layout {
  padding: 24px;
  min-width: 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.page-description {
  margin-top: 6px;
  color: var(--n-text-color-3);
  font-size: 13px;
}

.connection-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.connection-card {
  border-radius: 8px;

  :deep(.n-card__content) {
    padding-top: 18px;
  }
}

.connection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.connection-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: var(--n-action-color);
  color: var(--n-text-color-1);
}

.connection-detail {
  min-width: 0;
}

.connection-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
}

.connection-address {
  margin-top: 6px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.connection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mapping-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.mapping-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
}

.mapping-count {
  font-size: 12px;
  font-weight: normal;
}

.mapping-empty {
  padding: 28px 0;
}

.connection-empty {
  padding: 80px 0;
}

.mapping-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.page-utils {
  > * {
    margin-inline-end: 10px;
  }
}

.old-mapping-value {
  font-size: 14px;
  color: #a4a4a4;
}
</style>