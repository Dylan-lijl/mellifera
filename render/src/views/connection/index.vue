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
                    :type="connectionStatusMap.get(item.id) ? 'success' : 'default'"
                    size="small"
                    ghost :bordered="false"
                >
                  {{ connectionStatusMap.get(item.id) ? '已连接' : '未连接' }}
                </n-tag>
              </div>

              <div class="connection-address">
                {{ item.host }}:{{ item.port }}
              </div>
            </div>
          </div>

          <div class="connection-actions">
            <n-button
                v-if="connectionStatusMap.get(item.id)"
                size="small"
                secondary
                @click="handleDisconnect(item)"
                ghost
            >
              断开
            </n-button>

            <n-button
                v-else
                size="small"
                type="primary"
                @click="handleConnect(item)"
                ghost
            >
              连接
            </n-button>
            <n-popover trigger="hover" placement="bottom-end">
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
            </n-popover>
          </div>
        </div>

        <n-divider/>

        <div class="mapping-header">
          <div class="mapping-title">
            <span>端口映射</span>
            <n-text depth="3" class="mapping-count">
              {{ mappingMap.get(item.id)?.length ?? 0 }}
            </n-text>
          </div>

          <n-button
              size="small"
              secondary
              :disabled="!connectionStatusMap.get(item.id)"
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

        <n-data-table
            v-if="!!(mappingMap.get(item.id)?.length)"
            :columns="mappingColumns"
            :data="mappingMap.get(item.id)!"
            :row-key="(row) => row.id"
            :bordered="false"
            :single-line="false"
            size="small"
        />

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
  </div>
</template>

<script setup lang="ts">
import {h, ref} from 'vue'
import {
  NButton,
  NIcon,
  NTag,
  NText,
  NDivider,
  NDataTable,
  NEmpty,
  NCard,
  useMessage,
  type DataTableColumns, useDialog,
} from 'naive-ui'
import {
  AddOutline,
  EllipsisHorizontal,
  Refresh,
} from '@vicons/ionicons5'
import {EditFilled, DeleteFilled} from '@vicons/antd'
import {createPagination} from "@mellifera/common/util";
import type {
  SearchRequest,
  ListConnectionResponse,
  InfoConnectionResponse
} from "@mellifera/common/entity";
import {useStore} from "@/store";
import Detail from "./detail.vue"
import {contentContainer} from "@mellifera/common/constant";

interface PortMapping {
  parentId: number;
  id: number,
  name: string
  protocol: 'TCP' | 'UDP'
  targetAddress: string
  targetPort: number
  remotePort?: number
  status: 'running' | 'stopped'
}

interface ConnectionStatus {
  id: number,
  connected: boolean
}

const dialog = useDialog()
const message = useMessage()
const store = useStore();
const infoDesc = ref({
  title: "",
  show: false,
  data: null as ListConnectionResponse | null,
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
const mappings = ref<PortMapping[]>([]);
const mappingMap = computed(() => {
  const map = new Map<number, PortMapping[]>();

  for (const item of mappings.value) {
    const list = map.get(item.parentId);

    if (list) {
      list.push(item);
    } else {
      map.set(item.parentId, [item]);
    }
  }

  return map;
});
const connectionStatus = ref<ConnectionStatus[]>();
const connectionStatusMap = computed(() => {
  const map = new Map<number, boolean>();
  connectionStatus.value?.forEach((item) => {
    map.set(item.id, item.connected)
  });
  return map;
})

async function reloadData() {
  if (store.apiState.service.connection.searchAndPage.requesting.size) {
    return;
  }
  const data = await store.service.connection.searchAndPage(connection.value.page.get(connection.value.param)).get();
  connection.value.data = data.list;
}

const mappingColumns: DataTableColumns<PortMapping> = [
  {
    title: '名称',
    key: 'name',
    minWidth: 120,
  },
  {
    title: '协议',
    key: 'protocol',
    width: 90,
    render: (row) =>
        h(
            NTag,
            {size: 'small', bordered: false},
            {default: () => row.protocol},
        ),
  },
  {
    title: '目标地址',
    key: 'target',
    minWidth: 190,
    render: (row) => `${row.targetAddress}:${row.targetPort}`,
  },
  {
    title: '公网入口',
    key: 'remote',
    minWidth: 210,
    render: (row) =>
        row.remotePort
            ? `${row.remotePort}`
            : h(NText, {depth: 3}, {default: () => '待分配'}),
  },
  {
    title: '状态',
    key: 'status',
    width: 110,
    render: (row) =>
        h(
            NTag,
            {
              type: row.status === 'running' ? 'success' : 'default',
              size: 'small',
              bordered: false,
            },
            {
              default: () =>
                  row.status === 'running' ? '运行中' : '未启动',
            },
        ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    align: 'right',
    render: (row) =>
        h('div', {class: 'mapping-actions'}, [
          h(
              NButton,
              {
                size: 'tiny',
                quaternary: true,
                type: 'primary',
                onClick: () => handleEditMapping(row),
              },
              {default: () => '编辑'},
          ),
          h(
              NButton,
              {
                size: 'tiny',
                quaternary: true,
                type: 'error',
                onClick: () => handleDeleteMapping(row),
              },
              {default: () => '删除'},
          ),
        ]),
  },
]

function handleAdd() {
  infoDesc.value.show = true;
  infoDesc.value.title = "添加连接";
}

function handleConnect(item: ListConnectionResponse) {
  message.info(`连接服务端：${item.name}`)
}

function handleDisconnect(item: ListConnectionResponse) {
  message.info(`断开服务端：${item.name}`)
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
      await store.service.connection.delete({id: item.id}).get();
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
  message.info(`为 ${item.name} 添加映射`)
}

function handleEditMapping(row: PortMapping) {
  message.info(`编辑映射：${row.name}`)
}

function handleDeleteMapping(row: PortMapping) {
  message.info(`删除映射：${row.name}`)
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
</style>