<template>
  <!-- 统一采用下拉刷新结构，保持行为一致 -->
  <sar-pull-down-refresh
    :loading="refreshing"
    :disabled="loading && !list.length"
    @refresh="onPullRefresh"
    class="pl-refresh-wrapper"
  >
    <view class="pl-container" :style="{ height: containerHeight }">
      <view v-if="showFirstLoading && loading && !list.length" class="pl-first-loading">
        <slot name="first-loading">
          <text class="pl-first-loading-text">{{ firstLoadingText }}</text>
        </slot>
      </view>
      <slot name="top" />
      <scroll-view
        v-if="!usePageScroll"
        :scroll-y="true"
        class="pl-scroll"
        :throttle="false"
        lower-threshold="60"
        @scrolltolower="onReachBottom"
      >
        <view class="pl-list">
          <slot name="item" v-for="(it,idx) in list" :item="it" :index="idx" :key="getKey(it, idx)" />
          <view v-if="!loading && !error && !list.length" class="pl-empty">
            <slot name="empty" :reload="reload">
              <text class="pl-empty-text">{{ emptyText }}</text>
            </slot>
          </view>
          <view v-if="error && !list.length" class="pl-error" @click="reload">
            <slot name="error" :retry="reload" :error="error">
              <text class="pl-error-text">{{ errorText }}</text>
            </slot>
          </view>
          <template v-if="list.length">
            <template v-if="finished">
              <slot name="finished">
                <view class="pl-finished-text">{{ finishedText }}</view>
              </slot>
            </template>
            <sar-load-more
              v-else
              :status="loadMoreStatus"
              @load-more="onMoreClick"
              @reload="onReloadClick"
            />
          </template>
        </view>
        <slot name="bottom" />
      </scroll-view>
      <template v-else>
        <view class="pl-list">
          <slot name="item" v-for="(it,idx) in list" :item="it" :index="idx" :key="getKey(it, idx)" />
          <view v-if="!loading && !error && !list.length" class="pl-empty">
            <slot name="empty" :reload="reload">
              <text class="pl-empty-text">{{ emptyText }}</text>
            </slot>
          </view>
          <view v-if="error && !list.length" class="pl-error" @click="reload">
            <slot name="error" :retry="reload" :error="error">
              <text class="pl-error-text">{{ errorText }}</text>
            </slot>
          </view>
          <template v-if="list.length">
            <template v-if="finished">
              <slot name="finished">
                <view class="pl-finished-text">{{ finishedText }}</view>
              </slot>
            </template>
            <sar-load-more
              v-else
              :status="loadMoreStatus"
              @load-more="onMoreClick"
              @reload="onReloadClick"
            />
          </template>
        </view>
        <slot name="bottom" />
      </template>
    </view>
  </sar-pull-down-refresh>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, watch, onMounted, nextTick, getCurrentInstance, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'

interface RequestResult<T> { list: T[]; total?: number; hasMore?: boolean }
interface RequestParams<Q=any> { page: number; pageSize: number; query?: Q; signal?: AbortSignal }
type PullListRequest<T, Q=any> = (params: RequestParams<Q>) => Promise<RequestResult<T>>

const props = withDefaults(defineProps<{
  request: PullListRequest<any, any>
  pageSize?: number
  immediate?: boolean
  autoMore?: boolean
  manual?: boolean
  query?: any
  watchQueryDeep?: boolean
  height?: string
  transform?: (raw:any)=>any
  emptyText?: string
  finishedText?: string
  errorText?: string
  loadingText?: string
  usePageScroll?: boolean
  keyField?: string
  showFirstLoading?: boolean
  firstLoadingText?: string
}>(), {
  pageSize: 20,
  immediate: true,
  autoMore: true,
  manual: false,
  watchQueryDeep: false,
  height: 'auto',
  transform: (v:any) => v,
  emptyText: '暂无数据',
  finishedText: '没有更多了',
  errorText: '加载失败，点击重试',
  loadingText: '加载中…',
  usePageScroll: false,
  keyField: '',
  showFirstLoading: true,
  firstLoadingText: '加载中...'
})

const emit = defineEmits<{
  (e:'loaded', payload:{ page:number; pageSize:number; added:number; total?:number; finished:boolean }):void
  (e:'error', err:Error):void
  (e:'update:loading', v:boolean):void
}>()

const measuredHeight = ref('')
const windowHeightCache = ref<number | null>(null)

const instance = getCurrentInstance()

const autoHeightEnabled = computed(() => {
  if (props.usePageScroll) return false
  const raw = props.height
  if (raw === undefined || raw === null) return true
  if (typeof raw !== 'string') return false
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return true
  return normalized === 'auto' || normalized === '100%' || normalized === '100vh'
})

const containerHeight = computed(() => {
  if (autoHeightEnabled.value) {
    return measuredHeight.value || '100%'
  }
  return props.height
})

const list = ref<any[]>([])
const page = ref(1)
const loading = ref(false)
const refreshing = ref(false)
const finished = ref(false)
const error = ref<Error | null>(null)
let aborter: AbortController | null = null
let pendingReload = false
const REQUEST_REPEAT_INTERVAL = 1000 // align with src/utils/request.ts repeat guard
let lastRequestAt = 0
let deferredLoadTimer: ReturnType<typeof setTimeout> | null = null
let deferredLoadConfig: { isRefresh: boolean } | null = null

// load-more 状态映射: incomplete | loading | complete | error
const loadMoreStatus = computed(() => {
  if(error.value) return 'error'
  if(loading.value && list.value.length) return 'loading'
  if(finished.value) return 'complete'
  return 'incomplete'
})

function onMoreClick(){
  if(loading.value || finished.value) return
  next()
}
function onReloadClick(){
  if(loading.value) return
  reload()
}

function getKey(it:any, idx:number){
  if(props.keyField && it && it[props.keyField] != null) return it[props.keyField]
  return it?.id ?? idx
}

function clearDeferredLoad(){
  if(deferredLoadTimer){
    clearTimeout(deferredLoadTimer)
    deferredLoadTimer = null
  }
  deferredLoadConfig = null
}

function settleLoad(controller: AbortController | null){
  if(controller && aborter === controller){
    aborter = null
  }
  loading.value = false
  refreshing.value = false
  emit('update:loading', false)
  if(pendingReload){
    pendingReload = false
    nextTick(() => {
      if(instance?.isUnmounted) return
      reload()
    })
  }
}

async function internalLoad(isRefresh=false){
  // 防止重复加载
  if(loading.value) {
    console.log('[PullList] 已在加载中,跳过本次请求')
    return
  }
  if(deferredLoadTimer) {
    console.log('[PullList] 已计划新的加载,等待触发')
    if(!deferredLoadConfig){
      deferredLoadConfig = { isRefresh }
    } else {
      deferredLoadConfig.isRefresh = deferredLoadConfig.isRefresh || isRefresh
    }
    return
  }

  const now = Date.now()
  if(lastRequestAt && (now - lastRequestAt) < REQUEST_REPEAT_INTERVAL) {
    const wait = REQUEST_REPEAT_INTERVAL - (now - lastRequestAt)
    console.log('[PullList] 请求间隔过短,延迟重新加载', wait)
    deferredLoadConfig = { isRefresh }
    deferredLoadTimer = setTimeout(() => {
      const config = deferredLoadConfig
      deferredLoadTimer = null
      deferredLoadConfig = null
      if(instance?.isUnmounted) return
      internalLoad(config?.isRefresh ?? false)
    }, wait)
    return
  }
  
  // 设置加载状态
  if(isRefresh){
    refreshing.value = true
  }
  loading.value = true
  emit('update:loading', true)
  
  // 清理错误状态(必须在设置 loading 后)
  error.value = null
  
  // 创建新的 AbortController
  if(typeof AbortController !== 'undefined') {
    aborter = new AbortController()
  } else {
    aborter = null
  }
  
  lastRequestAt = Date.now()
  const currentAborter = aborter
  const targetPage = isRefresh ? 1 : page.value
  let isAborted = false
  
  try {
    const res = await props.request({ 
      page: targetPage, 
      pageSize: props.pageSize, 
      query: props.query, 
      signal: currentAborter?.signal 
    })
    
    // 检查请求是否已过期(被新请求取代)
    if(currentAborter !== aborter) {
      console.log('[PullList] 请求已过期,忽略响应')
      return
    }
    
    const rawList = Array.isArray(res?.list) ? res.list : []
    const transformFn = typeof props.transform === 'function' ? props.transform : ((v:any)=>v)
    const transformed:any[] = []
    for(let idx=0; idx<rawList.length; idx++){
      transformed.push(transformFn(rawList[idx], idx))
    }
    
    if(isRefresh){
      list.value = transformed
      page.value = 1
    } else {
      list.value = list.value.concat(transformed)
    }
    
    let hasMore: boolean
    if(typeof res?.hasMore === 'boolean') hasMore = res.hasMore
    else if(typeof res?.total === 'number') hasMore = (targetPage * props.pageSize) < res.total
    else hasMore = rawList.length === props.pageSize
    
    finished.value = !hasMore
    if(!finished.value) page.value = targetPage + 1
    
    emit('loaded', { 
      page: targetPage, 
      pageSize: props.pageSize, 
      added: transformed.length, 
      total: res?.total, 
      finished: finished.value 
    })
  } catch(e:any){
    // 检查请求是否已过期
    if(currentAborter !== aborter) {
      console.log('[PullList] 请求已过期,忽略错误')
      isAborted = true
      return
    }
    
    // 处理取消错误:不设置 error 状态,但要重置 loading
    if(e?.name === 'AbortError' || e?.code === 'ECONNABORTED' || e?.message?.includes('aborted')) {
      console.log('[PullList] 请求被取消,重置状态')
      isAborted = true
      settleLoad(currentAborter)
      return
    }
    
    // 处理重复提交错误:静默失败,不显示错误
    if(e?.name === 'RepeatSubmitError') {
      console.log('[PullList] 重复提交被拦截,静默失败')
      isAborted = true
      settleLoad(currentAborter)
      return
    }
    
    // 真正的错误才设置 error 状态
    console.error('[PullList] 加载失败:', e)
    error.value = e
    emit('error', e)
  } finally {
    // 非取消的情况才在这里重置状态(取消已在 catch 中处理)
    if(!isAborted) {
      settleLoad(currentAborter)
    }
  }
}

function reload(){
  clearDeferredLoad()
  finished.value = false
  error.value = null // 清理错误状态
  page.value = 1
  
  // 如果正在加载中,只标记状态并在完成后重新加载
  if(loading.value) {
    pendingReload = true
    console.log('[PullList] reload: 当前加载未完成,标记为待重载')
    if(aborter) {
      try {
        aborter.abort()
      } catch(e) {
        console.warn('[PullList] 取消请求失败:', e)
      }
    }
    return
  }
  
  pendingReload = false
  internalLoad(true)
}

function next(){
  if(loading.value || finished.value || error.value) return
  internalLoad(false)
}

// 防抖:避免快速多次下拉
let pullRefreshTimer: ReturnType<typeof setTimeout> | null = null
let lastPullRefreshTime = 0
function onPullRefresh(){ 
  const now = Date.now()
  
  // 如果距离上次下拉不到 300ms,忽略
  if(now - lastPullRefreshTime < 300) {
    console.log('[PullList] onPullRefresh: 下拉过快,忽略')
    return
  }
  
  lastPullRefreshTime = now
  
  // 清除之前的防抖计时器
  if(pullRefreshTimer) {
    clearTimeout(pullRefreshTimer)
    pullRefreshTimer = null
  }
  
  // 如果正在刷新中,忽略
  if(refreshing.value) {
    console.log('[PullList] onPullRefresh: 正在刷新中,忽略下拉')
    return
  }
  
  // 使用防抖处理
  pullRefreshTimer = setTimeout(() => {
    pullRefreshTimer = null
    reload()
  }, 150) // 150ms 防抖
}

function onReachBottom(){
  if(!props.autoMore) return
  next()
}

// 监听 query 变化
watch(() => props.query, () => {
  reload()
}, { deep: props.watchQueryDeep })

let unlistenResize: null | (() => void) = null

function setupResizeListener() {
  if (typeof uni?.onWindowResize === 'function') {
    const handler = (res: any) => {
      if (autoHeightEnabled.value) {
        const height = Number(res?.size?.windowHeight)
        if (Number.isFinite(height) && height > 0) {
          windowHeightCache.value = height
        }
        measureHeight()
      }
    }
    uni.onWindowResize(handler)
    unlistenResize = () => {
      if (typeof uni?.offWindowResize === 'function') {
        uni.offWindowResize(handler)
      }
    }
  }
}

onBeforeUnmount(() => {
  // 清理防抖计时器
  if(pullRefreshTimer) {
    clearTimeout(pullRefreshTimer)
    pullRefreshTimer = null
  }
  
  // 取消进行中的请求
  if(aborter) {
    try {
      aborter.abort()
    } catch(e) {
      console.warn('[PullList] 组件卸载时取消请求失败:', e)
    }
    aborter = null
  }
  pendingReload = false
  clearDeferredLoad()
  
  // 清理窗口监听器
  if (unlistenResize) unlistenResize()
})

onMounted(() => {
  measureHeight()
  setupResizeListener()
  if(props.immediate && !props.manual){
    internalLoad(true)
  }
})

onShow(() => {
  measureHeight()
})

watch(() => props.height, () => {
  measureHeight()
})

watch(() => props.usePageScroll, () => {
  measureHeight()
})

function getSafeInsets() {
  try {
    const info = uni.getSystemInfoSync()
    const bottom = Number(info?.safeAreaInsets?.bottom ?? 0)
    const windowH = Number(info?.windowHeight ?? info?.screenHeight ?? 0)
    if (Number.isFinite(windowH) && windowH > 0) {
      windowHeightCache.value = windowH
    }
    return {
      bottom: Number.isFinite(bottom) ? Math.max(bottom, 0) : 0,
      windowHeight: windowHeightCache.value ?? windowH,
    }
  } catch {
    return { bottom: 0, windowHeight: windowHeightCache.value ?? 0 }
  }
}

function measureHeight() {
  if (!autoHeightEnabled.value) {
    measuredHeight.value = ''
    return
  }
  nextTick(() => {
    const { bottom, windowHeight } = getSafeInsets()
    if (!instance?.proxy) return
    const query = uni.createSelectorQuery().in(instance.proxy)
    query
      .select('.pl-container')
      .boundingClientRect((rect) => {
        if (!rect || !windowHeight) return
        const top = Number(rect?.top ?? 0)
        let available = windowHeight - top - bottom
        if (!Number.isFinite(available) || available <= 0) {
          available = windowHeight - bottom
        }
        const minHeight = 160
        measuredHeight.value = `${Math.max(available, minHeight)}px`
      })
      .exec()
  })
}

// 暴露方法
function getListRef(){ return list }
function setQuery(q:any){ (props as any).query = q; reload() }
function refresh(){ reload() }

defineExpose({ reload, next, refresh, getList: getListRef, setQuery, recalcHeight: measureHeight, state:{ list, page, loading, finished, error } })
</script>

<style scoped lang="scss">
.pl-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}
.pl-inner { display:flex; flex-direction:column; width:100%; overflow:hidden; }
.pl-scroll { flex:1; min-height:0; width:100%; height:100%; }
.pl-list { display:flex; flex-direction:column; gap:12px; padding:12px; box-sizing:border-box; }
.pl-skeleton { padding:6px 0; }
.pl-loading-more, .pl-finished { padding:20px 12px; }
.pl-finished-text { font-size:13px; color:#64748b; text-align:center; }
/* 状态块 */
.pl-empty, .pl-error, .pl-loading-more, .pl-finished { display:flex; justify-content:center; align-items:center; padding:28px 12px; font-size:13px; color:#64748b; }
.pl-error { color:#dc2626; cursor:pointer; }
.pl-loading-more { color:#0b3d91; }

/* 首次加载遮罩 */
.pl-first-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.9); z-index:2; }
.pl-first-loading-text { font-size:14px; color:#64748b; }

/* Divider 可选实现：直接利用 gap，不额外加；如需可添加 before 伪元素。 */
</style>
