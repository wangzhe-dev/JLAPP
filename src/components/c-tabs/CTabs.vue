<template>
  <!-- 包装层：支持 tabs 数组或完全插槽模式 -->
  <sar-tabs
    v-model:current="innerValue"
    :type="type"
    :swipeable="swipeable"
    :animated="animated"
    :sticky="sticky"
    :offset-top="offsetTop"
    :scrollspy="scrollspy"
    :scrollable="scrollableAuto"
    :ellipsis="ellipsis"
    :lazy-render="lazyRender"
    :line-width="lineWidth"
    :line-height="lineHeight"
    :color="color"
    :background="background"
    :title-active-color="titleActiveColor"
    :title-inactive-color="titleInactiveColor"
    :duration="duration"
    :before-change="beforeChangeProxy"
    class="c-tabs"
    @change="onNativeChange"
  >
    <!-- 若用户未提供默认 slot 且传了 tabs 数组，则自动生成 sar-tab -->
    <template v-if="!$slots.default">
      <sar-tab
        v-for="(t,idx) in normalizedTabs"
        :key="t.name ?? t.key ?? idx"
        :title="t.title"
        :name="t.name"
        :disabled="t.disabled"
        :dot="t.dot"
        :badge="t.badge"
        :title-style="t.titleStyle"
        :title-class="t.titleClass"
      >
        <!-- 内容区域：
             1. 若传 content slot name => 通过具名插槽渲染
             2. 否则：
                a. t.render 函数（函数式渲染，H5 有意义）
                b. 文本 content
        -->
        <slot v-if="t.slot" :name="t.slot" :tab="t" :index="idx" />
        <component
          v-else-if="t.is"
          :is="t.is"
          v-bind="t.componentProps || {}"
          :tab="t"
          :index="idx"
        />
        <template v-else-if="t.render">
          <component :is="t.render" :tab="t" :index="idx" />
        </template>
        <template v-else-if="t.content">{{ t.content }}</template>
      </sar-tab>
    </template>
    <!-- 直接透传用户自定义的 tab 列表 -->
    <slot />
  </sar-tabs>
</template>

<script setup lang="ts">
// @ts-nocheck  初版快速迭代，后续可补全 precise 类型
import { computed, watch, ref, onMounted, nextTick } from 'vue'

/** 外部驱动的 Tab 数据结构 */
interface CTabsItem {
  title: string
  name?: string | number
  key?: string | number
  disabled?: boolean
  dot?: boolean
  badge?: string | number
  slot?: string            // 指向一个具名插槽
  content?: string         // 直接显示文本内容
  is?: any                 // 动态组件
  componentProps?: Record<string, any>
  render?: any             // 函数式组件 (H5)
  titleStyle?: string | Record<string, any>
  titleClass?: string
}

const props = withDefaults(defineProps<{
  modelValue?: string | number
  tabs?: CTabsItem[]
  type?: 'line' | 'card'
  swipeable?: boolean
  animated?: boolean
  sticky?: boolean
  offsetTop?: number | string
  scrollspy?: boolean
  scrollable?: boolean | 'auto'
  ellipsis?: boolean
  lazyRender?: boolean
  lineWidth?: string | number
  lineHeight?: string | number
  color?: string
  background?: string
  titleActiveColor?: string
  titleInactiveColor?: string
  duration?: number | string
  beforeChange?: (next: any) => boolean | Promise<boolean>
  cacheKey?: string
}>(), {
  modelValue: 0,
  tabs: () => [],
  type: 'line',
  swipeable: false,
  animated: true,
  sticky: false,
  offsetTop: 0,
  scrollspy: false,
  scrollable: 'auto',
  ellipsis: true,
  lazyRender: true,
  lineWidth: undefined,
  lineHeight: undefined,
  color: undefined,
  background: undefined,
  titleActiveColor: undefined,
  titleInactiveColor: undefined,
  duration: 0.3,
  beforeChange: undefined,
  cacheKey: undefined,
})

const emit = defineEmits<{ (e:'update:modelValue', v:any):void; (e:'change', payload:{ name:any; index:number }):void }>()

function normalize(v:any){ return v === 0 || v === '0' ? '0' : (v != null ? String(v) : v) }
const innerValue = ref<any>(normalize(props.modelValue))
watch(() => props.modelValue, v => { innerValue.value = normalize(v) })
watch(innerValue, v => {
  emit('update:modelValue', v)
  persistCache(v)
})

const normalizedTabs = computed(() => (props.tabs || []).map((t,idx) => ({ ...t, name: normalize(t.name ?? t.key ?? idx) })))
const scrollableAuto = computed(() => {
  if (props.scrollable === 'auto') {
    return normalizedTabs.value.length > 4 // 简单策略：超过4个启用滚动
  }
  return props.scrollable
})

const cacheKey = computed(() => (props.cacheKey ? String(props.cacheKey) : ''))

function getUni() {
  return typeof uni === 'undefined' ? null : uni
}

function readCachedValue(){
  if(!cacheKey.value) return null
  const uniApp = getUni()
  if (!uniApp || typeof uniApp.getStorageSync !== 'function') return null
  try {
    const val = uniApp.getStorageSync(cacheKey.value)
    if (val === undefined || val === null || val === '') return null
    return normalize(val)
  } catch { return null }
}

function writeCachedValue(value: any) {
  if(!cacheKey.value) return
  const uniApp = getUni()
  if (!uniApp) return
  try {
    const normalized = normalize(value)
    if (normalized === undefined || normalized === null || normalized === '') {
      if (typeof uniApp.removeStorageSync === 'function') {
        uniApp.removeStorageSync(cacheKey.value)
      } else if (typeof uniApp.setStorageSync === 'function') {
        uniApp.setStorageSync(cacheKey.value, '')
      }
      return
    }
    if (typeof uniApp.setStorageSync === 'function') {
      uniApp.setStorageSync(cacheKey.value, normalized)
    }
  } catch {}
}

function persistCache(value:any){
  if(!cacheKey.value) return
  writeCachedValue(value)
}

async function beforeChangeProxy(next:any){
  if(!props.beforeChange) return true
  try {
    const r = props.beforeChange(next)
    return typeof (r as any)?.then === 'function' ? await (r as any) : r
  } catch { return false }
}

function onNativeChange(e:any){
  // sard tabs change 事件：通常直接返回当前 name，也可能返回对象
  const rawName = (e && typeof e === 'object' && 'name' in e) ? e.name : e
  const name = normalize(rawName ?? innerValue.value)
  let index = -1
  if (name != null) {
    index = normalizedTabs.value.findIndex(t => t.name === name)
  }
  emit('change', { name, index })
}

onMounted(() => {
  // 若外部给的是数字 0 以外的 name，统一已 normalize；检查是否存在
  const names = normalizedTabs.value.map(t => t.name)
  if(innerValue.value == null){
    if(names.length){ innerValue.value = names[0]; emit('update:modelValue', innerValue.value) }
    return
  }
  if(names.length && !names.includes(innerValue.value)){
    innerValue.value = names[0]
    emit('update:modelValue', innerValue.value)
  }
  // 强制一次同步到 sard 内部（某些平台初次渲染 timing 差异）
  nextTick(() => { innerValue.value = normalize(innerValue.value) })
  if(cacheKey.value){
    const cached = readCachedValue()
    const names = normalizedTabs.value.map(t => t.name)
    if(cached != null && names.includes(cached)){
      innerValue.value = cached
      emit('update:modelValue', cached)
    }
  }
})

// tabs 动态变化时重新校验
watch(() => props.tabs, () => {
  const names = normalizedTabs.value.map(t => t.name)
  if(!names.length) return
  if(cacheKey.value){
    const cached = readCachedValue()
    if(cached != null && names.includes(cached)){
      innerValue.value = cached
      emit('update:modelValue', cached)
      return
    }
  }
  if(innerValue.value == null || !names.includes(innerValue.value)){
    innerValue.value = names[0]
    emit('update:modelValue', innerValue.value)
  }
}, { deep: true })
</script>

<style scoped lang="scss">
.c-tabs { width:100%; }
/* 可在此添加主题变量或轻度覆盖 */
</style>
