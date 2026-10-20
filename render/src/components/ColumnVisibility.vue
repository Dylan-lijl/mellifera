<script setup lang="ts" generic="T">
import { computed } from 'vue'
import { NPopover, NButton, NCheckbox, NSpace, NDivider } from 'naive-ui'
import type { SuperTableColumn } from "@/types";

const props = defineProps<{
  columns: SuperTableColumn<T>[]
}>()

// 过滤出具有 key 的普通列，排除选择列等特殊列
const visibilityColumns = computed(() =>
    props.columns.filter(
        (column): column is SuperTableColumn<T> & { key: string | number } =>
            'key' in column &&
            column.key != null &&
            'title' in column &&
            column.key !== 'actions',
    ),
)

function isVisible(column: SuperTableColumn<T>) {
  return !column.hidden
}

function setVisible(column: SuperTableColumn<T>, visible: boolean) {
  column.hidden = !visible
}

function showAll() {
  visibilityColumns.value.forEach(column => {
    column.hidden = false
  })
}

function hideAll() {
  visibilityColumns.value.forEach(column => {
    column.hidden = true
  })
}
</script>

<template>
  <n-popover trigger="click" placement="bottom-end">
    <template #trigger>
      <n-button secondary>
        字段
      </n-button>
    </template>

    <div style="min-width: 180px">
      <n-space justify="space-between" align="center">
        <strong>显示字段</strong>
        <n-space :size="8">
          <n-button text size="tiny" @click="showAll">
            全选
          </n-button>
          <n-button text size="tiny" @click="hideAll">
            全不选
          </n-button>
        </n-space>
      </n-space>

      <n-divider style="margin: 10px 0" />

      <n-space vertical :size="10">
        <n-checkbox
            v-for="column in visibilityColumns"
            :key="column.key"
            :checked="isVisible(column)"
            @update:checked="value => setVisible(column, value)"
        >
          {{ column.title }}
        </n-checkbox>
      </n-space>
    </div>
  </n-popover>
</template>