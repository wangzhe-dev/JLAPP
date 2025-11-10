<template>
  <!-- 统一按钮封装：对外仍使用项目语义 type，内部映射到 sard-uniapp 的 sar-button -->
  <sar-button
    :type="mappedType"
    :size="size"
    :loading="loading"
    :disabled="computedDisabled"
    :block="block"
    :round="round"
    :square="square"
    :background="background"
    :color="color"
    :plain="plain"
    :hairline="hairline"
    :icon="icon"
    :open-type="openType"
    :form-type="formType"
    @click="handleClick"
  >
    <template v-if="loading && loadingText">{{ loadingText }}</template>
    <slot v-else />
  </sar-button>
</template>
<script setup lang="ts">
// @ts-nocheck 迁移期
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type?: string            // 项目语义: primary | default | outline | danger | success | warning | text
  size?: string            // small | normal | large  (透传)
  loading?: boolean
  loadingText?: string
  disabled?: boolean
  block?: boolean
  round?: boolean
  square?: boolean
  background?: string
  color?: string
  plain?: boolean
  hairline?: boolean
  icon?: string
  openType?: string        // 小程序 open-type 直传
  formType?: string        // 小程序 form-type 直传
  throttle?: number        // ms 节流间隔
}>(), {
  type: 'primary',
  size: 'normal',
  loading: false,
  loadingText: '',
  disabled: false,
  block: false,
  round: false,
  square: false,
  background: '',
  color: '',
  plain: false,
  hairline: false,
  icon: '',
  openType: '',
  formType: '',
  throttle: 0
})

const mappedType = computed(() => {
  switch (props.type) {
    case 'default': return 'default'
    case 'outline': return 'outline'
    case 'danger': return 'danger'
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'text': return 'text'
    // primary / 未知 => 品牌色
    default: return 'primary'
  }
})

const computedDisabled = computed(() => props.disabled || props.loading)

let lastClick = 0
function handleClick(e:any){
  if (props.throttle && props.throttle > 0){
    const now = Date.now()
    if (now - lastClick < props.throttle) return
    lastClick = now
  }
  if (props.loading) return
  // 透传 click
  emit('click', e)
}

const emit = defineEmits<{(e:'click', ev:any):void}>()
</script>
<style scoped>
/* 可在此追加项目统一按钮尺寸差异（如果与 sar-button 默认不一致） */
</style>
