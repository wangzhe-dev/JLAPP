<template>
  <view class="c-tabs-pull">
    <CTabs
      v-model="innerTab"
      :tabs="tabs"
      :type="tabsType"
      :swipeable="swipeable"
      :animated="animated"
      :sticky="sticky"
      :offset-top="offsetTop"
      :scrollable="scrollable"
      :ellipsis="ellipsis"
      :lazy-render="lazyRender"
      :color="color"
      :background="background"
      :title-active-color="titleActiveColor"
      :title-inactive-color="titleInactiveColor"
      :duration="duration"
      :before-change="beforeChange"
      @change="onTabChange"
      class="c-tabs-pull__tabs"
    />

    <PullList
      ref="pullRef"
      class="c-tabs-pull__list"
      :request="activeRequest"
      :query="activeQuery"
      :page-size="pageSize"
      :auto-more="autoMore"
      :height="listHeight"
      :card-body-layout="cardBodyLayout"
      :row-fields="rowFields"
      :title-field="titleField"
      :auto-map="autoMap"
      :transform="transform"
      :immediate="immediate"
      @loaded="(p)=>emit('loaded', { ...p, tab: currentTabMeta })"
      @error="(e)=>emit('error', { error: e, tab: currentTabMeta })"
    >
      <template v-for="(_,slotName) in $slots" v-slot:[slotName]="slotProps" >
        <slot :name="slotName" v-bind="slotProps" :tab="currentTabMeta" />
      </template>
    </PullList>
  </view>
</template>

<script setup lang="ts">
// @ts-nocheck  初版快速实现
import { ref, watch, computed } from 'vue'
import CTabs from '@/components/c-tabs/CTabs.vue'
import PullList from '@/components/pull-list/PullList.vue'

/** 单个 Tab 的数据结构（在数组驱动场景下） */
interface TabsPullItem {
  title: string
  name?: string|number
  key?: string|number
  // request 支持：单独函数 或继承全局默认 request + query 拼接方式
  request?: Function
  query?: any
  // optional meta for outside usage
  meta?: any
  disabled?: boolean
  dot?: boolean
  badge?: string|number
}

const props = withDefaults(defineProps<{
  modelValue?: string|number
  tabs: TabsPullItem[]
  // PullList 基础行为
  request?: Function              // 全局默认请求函数（单 tab 未提供时使用）
  buildQuery?: (tab:TabsPullItem)=>any // 当 tab 未显式 query 时，通过此函数构造 query
  immediate?: boolean
  autoRefreshOnTabChange?: boolean // 切换是否自动 reload（默认 true）
  refreshIfSame?: boolean          // 再次点击当前 Tab 也刷新
  pageSize?: number
  autoMore?: boolean
  listHeight?: string
  // CCard & PullList 相关
  cardBodyLayout?: 'rows'|'grid'|'custom'|'text'
  rowFields?: any[]
  titleField?: string
  autoMap?: boolean
  transform?: (v:any)=>any
  // CTabs 外观传递
  tabsType?: 'line'|'card'
  swipeable?: boolean
  animated?: boolean
  sticky?: boolean
  offsetTop?: number|string
  scrollable?: boolean|'auto'
  ellipsis?: boolean
  lazyRender?: boolean
  color?: string
  background?: string
  titleActiveColor?: string
  titleInactiveColor?: string
  duration?: number|string
  beforeChange?: (next:any)=>boolean|Promise<boolean>
}>(), {
  modelValue: 0,
  tabs: () => [],
  immediate: true,
  autoRefreshOnTabChange: true,
  refreshIfSame: false,
  pageSize: 20,
  autoMore: true,
  listHeight: 'auto',
  cardBodyLayout: 'rows',
  rowFields: () => [],
  titleField: '',
  autoMap: true,
  transform: (v:any)=>v,
  tabsType: 'line',
  swipeable: false,
  animated: true,
  sticky: false,
  offsetTop: 0,
  scrollable: 'auto',
  ellipsis: true,
  lazyRender: true,
  duration: 0.3,
})

const emit = defineEmits<{(e:'update:modelValue', v:any):void; (e:'tab-change', payload:{ name:any; index:number; tab:TabsPullItem }):void; (e:'loaded', payload:any):void; (e:'error', payload:any):void}>()

const innerTab = ref<any>(props.modelValue)
watch(() => props.modelValue, v => innerTab.value = v)
watch(innerTab, v => emit('update:modelValue', v))

const tabsMap = computed(() => new Map(props.tabs.map((t,i)=>[t.name!=null?t.name:i, t])))
const currentTabMeta = computed(() => tabsMap.value.get(innerTab.value) || props.tabs[0])

// 当前 tab 的 request 与 query
const activeRequest = computed(() => currentTabMeta.value?.request || props.request)
const activeQuery = computed(() => {
  if (currentTabMeta.value?.query !== undefined) return currentTabMeta.value.query
  if (props.buildQuery) return props.buildQuery(currentTabMeta.value)
  return { tab: currentTabMeta.value?.name ?? innerTab.value }
})

const pullRef = ref<any>()

function reloadActive(){
  pullRef.value?.reload && pullRef.value.reload()
}

function onTabChange(e:{ name:any; index:number }){
  const meta = tabsMap.value.get(e.name) || currentTabMeta.value
  emit('tab-change', { ...e, tab: meta })
  if (props.autoRefreshOnTabChange) {
    reloadActive()
  }
}

// 再次点击刷新：监听外部 emit（可在父级用 :before-change 或监听 change 做处理），这里提供一个 watcher 方案
watch(innerTab, (nv,ov) => {
  if(nv === ov && props.refreshIfSame){
    reloadActive()
  }
})

// 首次挂载，如果 immediate=false 但需要首屏加载，可手动调用：父组件调用 ref.reload()

defineExpose({ reload: reloadActive, getList: ()=>pullRef.value?.getList?.(), currentTabMeta })
</script>

<style scoped lang="scss">
.c-tabs-pull { display:flex; flex-direction:column; width:100%; height:100%; }
.c-tabs-pull__tabs { flex-shrink:0; }
.c-tabs-pull__list { flex:1; }
</style>
