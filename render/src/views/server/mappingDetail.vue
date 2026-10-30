<script setup lang="ts" generic="T extends boolean = true">
import {computed, reactive, ref, watch} from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSwitch,
  NSpace,
  type FormInst,
  type FormRules, useMessage,
} from 'naive-ui'
import type {
  ListConnectionMappingResponse,
  ListMappingResponse, MappingModel,
} from '@mellifera/common/entity'
import {useStore} from "@/store";
import {createMapping} from '@mellifera/common/factory';
import {transportProtocolOptions} from "@mellifera/common/constant";
import {showError} from "@/util";

const props = defineProps<{
  fromClient?: T
  data: T extends false ? ListMappingResponse | null : ListConnectionMappingResponse | null
  clientId: T extends false ? number | null : number
}>()

const emit = defineEmits<{
  success: [payload: T extends false ? ListMappingResponse | null : ListConnectionMappingResponse | null]
  error: [any]
  close: []
}>()
const message = useMessage();
const formRef = ref<FormInst | null>(null)
const isEdit = computed(() => props.data != null)
const submitting = computed(() => !!(isEdit.value ? store.apiState.service.mapping.update.requesting.has(props.data!.id)
    : store.apiState.service.mapping.create.requesting.size))
const form = reactive(createMapping())
const store = useStore();
const rules: FormRules = {
  name: [
    {required: true, message: '请输入名称', trigger: ['input', 'blur']},
    {max: 100, message: '名称不能超过 100 个字符', trigger: ['input', 'blur']},
  ],
  protocol: [
    {required: true, message: '未选择传输协议', trigger: ['change', 'blur']},
  ],
  listenPort: [
    {
      type: 'number',
      required: true,
      message: '请输入端口',
      trigger: ['blur', 'change'],
    },
    {
      type: 'integer',
      message: '端口必须是整数',
      trigger: ['blur', 'change'],
    },
    {
      type: 'number',
      min: 0,
      max: 65535,
      message: '端口范围为 0-65535',
      trigger: ['blur', 'change'],
    },
  ],
  targetHost: [
    {
      type: 'string',
      required: true,
      min: 1,
      max: 255,
      message: '主机名长度在范围为1-255',
      trigger: ['blur', 'change'],
    },
  ],
  targetPort: [
    {
      type: 'number',
      required: true,
      message: '请输入端口',
      trigger: ['blur', 'change'],
    },
    {
      type: 'integer',
      message: '端口必须是整数',
      trigger: ['blur', 'change'],
    },
    {
      type: 'number',
      min: 1,
      max: 65535,
      message: '端口范围为 1-65535',
      trigger: ['blur', 'change'],
    },
  ],
}

watch(
    () => props.data,
    (data) => {
      Object.assign(form, createMapping())

      if (data) {
        Object.keys(form).forEach((key) => {
          const value = props.fromClient === true
              ? (props.data as ListConnectionMappingResponse)?.remoteConfig?.[key as keyof MappingModel]
              : (props.data as ListMappingResponse)?.[key as keyof ListMappingResponse];
          if (value !== undefined) {
            Object.assign(form, {[key]: value})
          }
        })
      }
      formRef.value?.restoreValidation()
    },
    {immediate: true},
)
watch(() => props.clientId, (clientId) => {
  if (clientId) {
    form.clientId = clientId
  } else {
    form.clientId = 0;
  }
}, {immediate: true},)

function close() {
  if (!submitting.value) {
    emit('close')
  }
}

async function handleSubmit() {
  if (submitting.value) {
    return
  }
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  try {
    let id: number;
    if (props.data) {
      if (props.fromClient) {
        await store.service.connection.mapping.update({
          config: {...form, id: (props.data as ListConnectionMappingResponse).remoteId} as any,
          id: props.data.id
        }).errorMessage(r => showError(message, r)).get();
      } else {
        await store.service.mapping.update({
          ...form,
          id: props.data.id
        }).errorMessage(r => showError(message, r)).get();
      }
      id = props.data.id;
    } else {
      if (props.fromClient) {
        id = await store.service.connection.mapping.add({
          config: {...form},
          connectionId: props.clientId!,
          enabled: true
        }).errorMessage(r => showError(message, r)).get();
      } else {
        if (!form.clientId) {
          message.error("缺少客户id")
          return
        }
        id = await store.service.mapping.create({...form}).errorMessage(r => showError(message, r)).get();
      }

    }
    if (props.fromClient === true) {
      const data = await store.service.connection.mapping.load({id}).errorMessage(r => showError(message, r)).get();
      // 显式断言当前分支对应的类型
      emit("success", (data.length ? data[0] : null) as any);
    } else {
      const data = await store.service.mapping.searchAndPage({
        pageNum: 1,
        pageSize: 1,
        id
      }).errorMessage(r => showError(message, r)).get();
      // 显式断言当前分支对应的类型
      emit("success", (data && data.list.length ? data.list[0] : null) as any);
    }
  } catch (e) {
    emit("error", e);
  }
}

const disabledPortsError = ref<string | undefined>()

function handleDisabledPortsInput(value: string) {
  form.disabledPorts = value || null
  // 输入过程中只更新错误提示，不阻止输入
  disabledPortsError.value = validateDisabledPorts(value)
}

function validateDisabledPorts(value: string): string | undefined {
  if (!value.trim()) return undefined
  const parts = value.split(',')
  for (const item of parts) {
    const part = item.trim()
    // 单个端口
    if (/^\d+$/.test(part)) {
      const port = Number(part)
      if (port < 1 || port > 65535) {
        return `端口 ${part} 必须在 1-65535 之间`
      }
      continue
    }
    // 端口段
    const match = part.match(/^(\d+)-(\d+)$/)
    if (!match) {
      return `格式错误：${part}，请使用端口或起始端口-结束端口`
    }
    const start = Number(match[1])
    const end = Number(match[2])
    if (start < 1 || end > 65535 || start > end) {
      return `端口段 ${part} 不合法，必须满足 1 ≤ 起始端口 ≤ 结束端口 ≤ 65535`
    }
  }
  return undefined
}
</script>

<template>
  <div style="width: 100%">
    <NForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        require-mark-placement="right-hanging"
        @submit.prevent="handleSubmit"
    >
      <NFormItem path="name" :show-require-mark="true">
        <template #label>
          名称
        </template>
        <NInput
            v-model:value="form.name"
            maxlength="100"
            show-count
        />
      </NFormItem>

      <NFormItem path="token" :show-require-mark="true">
        <template #label>
          传输协议
          <FormHelp content="转发对应传输协议数据"/>
        </template>
        <NRadioGroup v-model:value="form.protocol">
          <NRadio v-for="item in transportProtocolOptions" :value="item.value" :disabled="!item.enabled">
            {{ item.label }}
          </NRadio>
        </NRadioGroup>
      </NFormItem>
      <NFormItem path="listenPort" :show-require-mark="true">
        <template #label>
          映射端口
          <FormHelp content="对应外网访问的端口,0是服务端自动分配"/>
        </template>
        <NInputNumber v-model:value="form.listenPort"/>
      </NFormItem>
      <template v-if="form.listenPort===0">
        <NFormItem path="disabledPorts" :show-require-mark="true"
                   :validation-status="disabledPortsError ? 'error' : undefined"
                   :feedback="disabledPortsError">
          <template #label>
            禁用端口
            <FormHelp content="服务端自动分配时,不使用禁用端口"/>
          </template>
          <NInput
              :value="form.disabledPorts ?? ''"
              placeholder="例如：80,443,8000-8100"
              @update:value="handleDisabledPortsInput"
              clearable
          />
        </NFormItem>
      </template>
      <NFormItem path="name" :show-require-mark="true">
        <template #label>
          目标主机
          <FormHelp content="对应内网域名或IP"/>
        </template>
        <NInput
            v-model:value="form.targetHost"
            maxlength="255"
            show-count
        />
      </NFormItem>
      <NFormItem path="targetPort" :show-require-mark="true">
        <template #label>
          目标端口
          <FormHelp content="对应内网穿透的端口"/>
        </template>
        <NInputNumber v-model:value="form.targetPort"/>
      </NFormItem>
      <NFormItem label="备注" path="description">
        <NInput
            v-model:value="form.description"
            type="textarea"
            placeholder="备注"
            :maxlength="1000"
            show-count
            :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </NFormItem>

      <NFormItem v-if="props.fromClient!==true">
        <template #label>
          启用
          <FormHelp content="禁用时服务端直接中断连接"/>
        </template>
        <NSwitch v-model:value="form.enabled"/>
      </NFormItem>

      <NSpace justify="end">
        <NButton :disabled="submitting" @click="close">
          取消
        </NButton>
        <NButton
            type="primary"
            attr-type="submit"
            :loading="submitting"
        >
          保存
        </NButton>
      </NSpace>
    </NForm>
  </div>
</template>

<style scoped>
.full-width {
  width: 100%;
}
</style>
