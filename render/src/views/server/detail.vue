<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSwitch,
  NSpace,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import type {
  ListClientResponse, ListMappingResponse,
} from '@mellifera/common/entity'
import {useStore} from "@/store";
import {createClient} from '@mellifera/common/factory';

const props = defineProps<{
  data?: ListClientResponse | null
}>()

const emit = defineEmits<{
  success: [ListClientResponse | null],
  error: [any],
  close: []
}>()

const formRef = ref<FormInst | null>(null)
const isEdit = computed(() => props.data != null)
const submitting = computed(() => !!(isEdit.value ? store.apiState.service.client.update.requesting.has(props.data!.id)
    : store.apiState.service.client.create.requesting.size))
const form = reactive(createClient())
const store = useStore();
const rules: FormRules = {
  name: [
    {required: true, message: '请输入客户端名称', trigger: ['input', 'blur']},
    {max: 100, message: '名称不能超过 100 个字符', trigger: ['input', 'blur']},
  ],
  token: [
    {required: true, message: '请输入认证令牌', trigger: ['input', 'blur']},
    {max: 255, message: '地址不能超过 255 个字符', trigger: ['input', 'blur']},
  ],
}

watch(
    () => props.data,
    (data) => {
      if (!data) return

      Object.assign(form, createClient())

      if (data) {
        Object.keys(form).forEach((key) => {
          const value = data[key as keyof ListClientResponse]
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
  const token = form.token.trim()
  if (!name || !token) return
  try {
    let id: number;
    if (props.data) {
      await store.service.client.update({
        id: props.data.id,
        name,
        token,
        enabled: form.enabled,
        description: form.description?.trim() || null,
      }).get();
      id = props.data.id;
    } else {
      id = await store.service.client.create({
        name,
        token,
        enabled: form.enabled,
        description: form.description?.trim() || null,
      }).get();
    }
    const data = await store.service.client.searchAndPage({pageNum: 1, pageSize: 1, id}).get();
    emit("success", data && data.list.length ? data.list[0] : null);
  } catch (e) {
    emit("error", e);
  }
}
function generateToken(){
  form.token = crypto.randomUUID().replace(/-/g, '').toUpperCase();
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
          连接名称<FormHelp content="例如：客户端1"/>
        </template>
        <NInput
            v-model:value="form.name"
            maxlength="100"
            show-count
        />
      </NFormItem>

      <NFormItem path="token">
        <template #label>
          认证令牌<FormHelp content="连接服务端的认证凭据"/>
        </template>
        <NInput
            v-model:value="form.token"
            type="password"
            show-password-on="click"
            autocomplete="new-password"
        ><template #suffix>
          <n-button quaternary type="info" @click="generateToken">生成</n-button>
        </template>
        </NInput>
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

      <NFormItem label="">
        <template #label>
          启用<FormHelp content="禁用状态客户端会连接失败"/>
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
