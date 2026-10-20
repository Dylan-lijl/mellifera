<script setup lang="ts" generic="T extends { id: string | number }">
import {computed, useAttrs, useSlots} from 'vue'
import {NDataTable} from 'naive-ui'
import type {SuperTableColumn} from "@/types";

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  columns: SuperTableColumn<T>
  data: T[]
  rowKey?: (row: T) => string | number
}>()

defineSlots<{
  render?: (props: {
    row: T
    index: number
    column: SuperTableColumn<T>
  }) => any
}>()
const attrs = useAttrs()
const slots = useSlots()

const columns = computed<SuperTableColumn<T>>(() =>
    props.columns.map((column: SuperTableColumn<T>) => ({
      ...column,
      render: (row: T, index: number) => {
        // 优先使用父组件自定义渲染函数
        if (typeof column.render === 'function') {
          return column.render(row, index)
        }
        // 自定义渲染插槽
        if (slots.render) {
          const result = slots.render({ row, index, column })

          // 插槽明确返回 null 时，使用默认列值
          if (result == null) {
            return column.key != null ? (row as any)[column.key] : null
          }

          return result
        }

        // 没有自定义渲染时，显示原始列值
        return column.key != null ? (row as any)[column.key] : null
      },
    })),
)
</script>

<template>
  <n-data-table
      v-bind="attrs"
      :columns="columns"
      :data="data"
      :row-key="rowKey ?? ((row: T) => row.id)"
  >
    <template
        v-for="(_, name) in slots"
        #[name]="slotProps"
    >
      <slot
          v-if="name !== 'render'"
          :name="name"
          v-bind="slotProps ?? {}"
      />
    </template>
  </n-data-table>
</template>