<script setup lang="ts">
import {HelpFilled} from '@vicons/material'

defineProps<{
  trigger?: 'hover' | 'click' | 'focus' | 'manual'
  title?: string
  content?: string
}>()

defineSlots<{
  source?: () => any
  icon?: () => any
  title?: () => any
  default?: () => any
}>()
</script>

<template>
  <n-popover :trigger="trigger ?? 'hover'">
    <template #trigger>
      <slot name="source">
        <HelpFilled style="cursor: pointer;width: 1em;height: 1em;color: sandybrown" />
      </slot>
    </template>
    <div class="popover-content">
      <div v-if="$slots.title || title" class="popover-title">
        <slot name="title">
          {{ title }}
        </slot>
      </div>
      <div v-if="$slots.content || content" class="popover-description">
        <slot>
          {{ content }}
        </slot>
      </div>
    </div>
  </n-popover>
</template>

<style scoped lang="less">
.popover-content {
  max-width: 320px;
  overflow-wrap: anywhere;
}

.popover-title {
  margin-bottom: 6px;
  font-weight: 600;
}

.popover-description {
  color: var(--n-text-color-2);
  line-height: 1.6;
}
</style>