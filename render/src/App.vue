<script setup lang="ts">
import {useStore} from "@/store";
import LayoutView from '@/components/layout/SimpleLayout.vue';
import {computed, ref} from "vue";
import {enUS, zhCN} from "naive-ui";

const store = useStore();
const language = ref('zh-cn')
const locale = computed(() => (language.value === 'zh-cn' ? zhCN : enUS))
</script>

<template>
  <n-spin :show="store.syncData.system.closing">
    <n-config-provider :locale="locale" abstract>
      <n-dialog-provider>
        <n-notification-provider>
          <n-message-provider>
            <LayoutView/>
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-config-provider>
  </n-spin>
</template>
<style scoped>
:deep(.form-hint) {
  font-size: 14px;
  color: #bbbbbb;
}
</style>
