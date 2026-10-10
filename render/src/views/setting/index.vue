<template>
  <div class="view-setting">
    <div style="text-align: center">
      <n-button text type="primary" @click="()=>store.system.openDevTools().get()">
        打开调试
      </n-button>
    </div>
    <n-divider>配置信息</n-divider>
    <n-form label-placement="left" label-width="auto">
      <n-form-item
          v-for="line in data"
          :key="line.key"
          :label="line.key"
      >
        <div class="setting-row">
          <n-input
              :value="
              line.value == null
                ? ''
                : typeof line.value === 'object'
                  ? JSON.stringify(line.value, null, 2)
                  : String(line.value)
            "
              :type="line.value != null && typeof line.value === 'object'
              ? 'textarea'
              : 'text'"
              :autosize="line.value != null && typeof line.value === 'object'
              ? { minRows: 2, maxRows: 8 }
              : false"
              readonly
          />

          <n-button
              quaternary
              type="error"
              :loading="requesting.remove.has(line.key)"
              @click="deleteSetting(line.key)"
          >
            删除
          </n-button>
        </div>
      </n-form-item>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import {useStore} from '@/store'
import {onMounted, ref} from 'vue'
import type {StoreKey} from '@mellifera/common/constant'

const requesting = ref({
  remove: new Set<string>(),
})

const store = useStore()
const data = ref<{ key: string; value: unknown }[]>([])

async function reloadSetting() {
  data.value = await store.store.getAll().get() as any;
}

function deleteSetting(key: string) {
  if (requesting.value.remove.has(key)) {
    return
  }

  requesting.value.remove.add(key)

  store.store.deleteData(key as StoreKey).get()
      .then(() => {
        const index = data.value.findIndex(item => item.key === key)

        if (index > -1) {
          data.value.splice(index, 1)
        }
      })
      .finally(() => {
        requesting.value.remove.delete(key)
      })
}

onMounted(() => {
  reloadSetting()
})
</script>

<style scoped lang="less">
.view-setting {
  /* styles */
}

.setting-row {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 8px;
}

.setting-row :deep(.n-input) {
  flex: 1;
  min-width: 0;
}
</style>