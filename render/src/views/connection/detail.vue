<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NSpace,
  type FormInst,
  type FormRules, useDialog, useMessage,
} from 'naive-ui'
import type {
  ListConnectionResponse,
} from '@mellifera/common/entity'
import {useStore} from "@/store";
import {createConnection} from '@mellifera/common/factory';
import {showError} from "@/util";
const message = useMessage();
const props = defineProps<{
  data?: ListConnectionResponse | null
}>()
const dialog = useDialog();
const emit = defineEmits<{
  success: [ListConnectionResponse | null],
  error: [any],
  close: []
}>()

const formRef = ref<FormInst | null>(null)
const isEdit = computed(() => props.data != null)
const submitting = computed(() => !!(isEdit.value ? store.apiState.service.connection.update.requesting.has(props.data!.id)
    : store.apiState.service.connection.create.requesting.size))
const form = reactive(createConnection())
const store = useStore();
const rules: FormRules = {
  name: [
    {required: true, message: '请输入连接名称', trigger: ['input', 'blur']},
    {max: 100, message: '名称不能超过 100 个字符', trigger: ['input', 'blur']},
  ],
  host: [
    {required: true, message: '请输入服务器地址', trigger: ['input', 'blur']},
    {max: 255, message: '地址不能超过 255 个字符', trigger: ['input', 'blur']},
  ],
  port: [
    {
      required: true,
      type: 'number',
      message: '请输入服务器端口',
      trigger: ['input', 'blur'],
    },
    {
      validator: (_rule, value: number | null) =>
          value != null && Number.isInteger(value) && value >= 0 && value <= 65535,
      message: '端口范围为 0–65535',
      trigger: ['input', 'blur'],
    },
  ],
}

watch(
    () => props.data,
    (data) => {
      if (!data) return

      Object.assign(form, createConnection())

      if (data) {
        Object.keys(form).forEach((key) => {
          const value = data[key as keyof ListConnectionResponse]
          if (value !== undefined) {
            Object.assign(form, {[key]: value})
          }
        })
      }

      formRef.value?.restoreValidation()
    },
    {immediate: true},
)

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
  const name = form.name.trim()
  const host = form.host.trim()
  const port = form.port
  if (!name || !host || port == null) return
  try {
    let id: number;
    if (props.data) {
      await store.service.connection.update({
        ...form,
        id: props.data.id,
      }).errorMessage(r=>showError(message,r)).get();
      id = props.data.id;
    } else {
      id = await store.service.connection.create({
        ...form,
      }).errorMessage(r=>showError(message,r)).get();
    }
    const data = await store.service.connection.searchAndPage({pageNum: 1, pageSize: 1, id}).errorMessage(r=>showError(message,r)).get();
    emit("success", data && data.list.length ? data.list[0] : null);
  } catch (e) {
    emit("error", e);
  }
}

function handleEnabledChange(value: boolean) {
  if (!value) {
    form.autoUpdate = false
    return
  }

  dialog.warning({
    title: '启用自动更新',
    content: '启用后，服务端可以同步更新客户端的映射信息。请确认你信任该服务端，是否继续启用？',
    positiveText: '确认启用',
    negativeText: '取消',
    onPositiveClick: () => {
      form.autoUpdate = true
    },
  })
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
      <NFormItem path="name">
        <template #label>
          连接名称
          <FormHelp content="例如：家里的服务端"/>
        </template>
        <NInput
            v-model:value="form.name"
            maxlength="100"
            show-count
        />
      </NFormItem>

      <NFormItem label="" path="host">
        <template #label>
          服务器地址
          <FormHelp content="服务器的IP或域名"/>
        </template>
        <NInput
            v-model:value="form.host"
            maxlength="255"
        />
      </NFormItem>

      <NFormItem path="port">
        <template #label>
          服务器端口
        </template>
        <NInputNumber
            v-model:value="form.port"
            :min="1"
            :max="65535"
            :precision="0"
            :step="1"
            placeholder="1–65535"
            class="full-width"
        />
      </NFormItem>
      <NFormItem path="token">
        <template #label>
          认证令牌
          <FormHelp content="连接服务端的认证凭据"/>
        </template>
        <NInput
            v-model:value="form.token"
            type="password"
            show-password-on="click"
            autocomplete="new-password"
            :placeholder="isEdit ? '留空表示不修改令牌' : '请输入认证令牌'"
        />
      </NFormItem>

      <NFormItem label="备注" path="description">
        <NInput
            v-model:value="form.description"
            type="textarea"
            placeholder="可选，填写连接用途"
            :maxlength="1000"
            show-count
            :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </NFormItem>

      <NFormItem>
        <template #label>
          启用连接
          <FormHelp content="保存后启用连接"/>
        </template>
        <NSwitch v-model:value="form.enabled"/>
      </NFormItem>
      <NFormItem>
        <template #label>
          自动更新
          <FormHelp content="启用后服务端映射信息更新，客户端也会同步更新，如果你信任该服务端可开启"/>
        </template>
        <NSwitch
            :value="!!form.autoUpdate"
            @update:value="handleEnabledChange"
        />
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
