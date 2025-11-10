<template>
  <sar-tabbar
    v-if="tabs && tabs.length"
    v-model:current="currentIndex"
    :root-class="wrapperClass"
    :root-style="wrapperStyle"
    :color="inactiveColor"
    :active-color="activeColor"
    :bordered="false"
  >
    <sar-tabbar-item
      v-for="(item, index) in tabs"
      :key="item.path || index"
      :name="index"
      :icon="item.icon"
      :icon-family="item.iconFamily"
      :icon-size="String(props.iconSize)"
      :text="item.label"
      :badge="formatBadge(item.badge)"
      :dot="!!item.dot && !item.badge"
    />
  </sar-tabbar>
</template>
<script lang="ts" setup>
// @ts-nocheck 暂时关闭严格类型校验，待内置标签类型统一调整后移除此行
import { computed, withDefaults, defineProps, defineEmits, watch, ref, onMounted, nextTick } from 'vue'
import type { AppTabItem } from '@/config/tabbar'

const props = withDefaults(defineProps<{ 
  tabs: AppTabItem[]
  modelValue?: string
  safeArea?: boolean
  background?: string
  blur?: boolean
  transparent?: boolean
  iconSize?: number
  labelSize?: number
  height?: number
}>(), {
  tabs: () => [],
  safeArea: true,
  background: '#ffffff',
  blur: false,
  transparent: false,
  iconSize: 26,
  labelSize: 16,
  height: 70
})

const emits = defineEmits<{ (e:'update:modelValue', v:string):void; (e:'change', v:AppTabItem):void }>()

const activePath = computed(() => props.modelValue || getCurrentRoute())
const currentIndex = ref(0)
let syncing = false
const safeAreaBottom = ref(0)

function getCurrentRoute(): string {
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1]
    // @ts-ignore
    return '/' + (cur.route || '')
  } catch { return '' }
}

const inactiveColor = computed(() => '#667085')
const activeColor = computed(() => 'var(--app-primary, #0B3D91)')

const wrapperClass = computed(() => [
  'app-tabbar',
  props.transparent ? 'app-tabbar--transparent' : '',
  props.blur ? 'app-tabbar--blur' : '',
].filter(Boolean).join(' ').trim() || undefined)

const safeBottomCss = computed(() => {
  if (props.safeArea === false) return '0px'
  return safeAreaBottom.value > 0
    ? `${safeAreaBottom.value}px`
    : 'env(safe-area-inset-bottom, 0px)'
})

const wrapperStyle = computed(() => {
  const styles: string[] = [
    `--sar-tabbar-height:${props.height}px`,
    `--sar-tabbar-bg:${props.transparent ? 'transparent' : props.background}`,
    `--sar-tabbar-color:${inactiveColor.value}`,
    `--sar-tabbar-item-ative-color:${activeColor.value}`,
    `--sar-tabbar-border-color:rgba(0,0,0,0)`,
    `--sar-tabbar-item-text-font-size:${props.labelSize}px`,
    `--sar-tabbar-item-icon-font-size:${props.iconSize}px`,
    `left:0`,
    `right:0`,
    `bottom:0`,
    `position:fixed`,
    `z-index:500`,
    `padding-bottom:${safeBottomCss.value}`,
    `height:calc(${props.height}px + ${safeBottomCss.value})`,
    `border-top-left-radius:20px`,
    `border-top-right-radius:20px`,
    `overflow:hidden`,
  ]
  if (!props.transparent) {
    styles.push(`box-shadow:0 10px 28px rgba(0,0,0,.14)`)
  }
  if (props.blur) {
    styles.push(`backdrop-filter:blur(18px) saturate(1.4)`)
  }
  return styles.join(';')
})

watch(activePath, syncFromActive, { immediate: true })
watch(() => props.tabs, syncFromActive, { deep: true })

function syncFromActive() {
  if (!props.tabs.length) return
  const current = normalizePath(activePath.value)
  let index = props.tabs.findIndex((item) => normalizePath(item.path) === current)
  if (index < 0) index = 0
  syncing = true
  currentIndex.value = index
  nextTick(() => {
    syncing = false
  })
}

watch(currentIndex, (value, previous) => {
  if (syncing || value === previous) return
  const item = props.tabs[value]
  if (!item) return
  emits('update:modelValue', item.path)
  emits('change', item)
  if (item.type === 'action') return
  const target = normalizePath(item.path, true)
  const current = normalizePath(activePath.value, true)
  if (!target || target === current) return
  uni.switchTab({
    url: target,
    fail: (err) => {
      console.warn('[AppTabbar] switchTab failed', target, err)
      uni.reLaunch({ url: target })
    }
  })
})

function formatBadge(v: any) {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return n > 99 ? '99+' : String(n)
}

function normalizePath(path?: string, withSlash = false) {
  if (!path) return ''
  const trimmed = String(path).trim()
  if (!trimmed) return ''
  if (withSlash) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }
  return trimmed.startsWith('/') ? trimmed : trimmed
}

onMounted(() => {
  try {
    const info = uni.getSystemInfoSync()
    const toNumber = (value: any) => {
      const num = Number(value)
      return Number.isFinite(num) && num > 0 ? num : 0
    }
    const safeInsets = info.safeAreaInsets || {}
    const safeArea = info.safeArea || {}
    const windowHeight = toNumber((info as any).windowHeight)
    const screenHeight = toNumber((info as any).screenHeight)

    let bottom = toNumber((safeInsets as any).bottom)
    if (!bottom && safeArea) {
      const safeBottom = toNumber((safeArea as any).bottom)
      const safeTop = toNumber((safeArea as any).top)
      if (windowHeight && safeBottom) {
        bottom = Math.max(0, windowHeight - safeBottom)
      } else if (screenHeight && safeBottom) {
        const safeHeight = toNumber((safeArea as any).height)
        if (safeHeight) {
          bottom = Math.max(0, screenHeight - safeHeight - safeTop)
        } else {
          bottom = Math.max(0, screenHeight - safeBottom)
        }
      }
    }
    safeAreaBottom.value = bottom
  } catch {}
})
</script>
<style lang="scss" scoped>
.app-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 500;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  background: var(--sar-tabbar-bg, rgba(255, 255, 255, 0.96));
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  overflow: hidden;
  backdrop-filter: brightness(1) saturate(1.15);
}

.app-tabbar--transparent {
  background: transparent;
  box-shadow: none;
}

.app-tabbar--blur {
  backdrop-filter: blur(18px) saturate(1.4);
}

:deep(.sar-tabbar__item) {
  font-size: v-bind('props.labelSize + "px"');
  padding: 8px 0 4px;
  transition: color 0.25s ease, transform 0.25s ease;
}

:deep(.sar-tabbar__item--current) {
  font-weight: 600;
}

:deep(.sar-tabbar__icon) {
  font-size: v-bind('props.iconSize + "px"');
  transition: transform 0.3s ease-in-out;
}

:deep(.sar-tabbar__item--current .sar-tabbar__icon) {
  transform: translateY(-2px);
}

:deep(.sar-tabbar__item--current .sar-tabbar__text) {
  color: transparent !important;
  background: linear-gradient(120deg, #0B3D91, #1672D6 45%, #4AAFFF 80%);
  -webkit-background-clip: text;
  background-clip: text;
  filter:
    drop-shadow(0 0 6px rgba(11, 61, 145, 0.55))
    drop-shadow(0 2px 12px rgba(22, 114, 214, 0.45))
    drop-shadow(0 -2px 8px rgba(74, 175, 255, 0.35));
}
:deep(.sar-tabbar__text) {
  position: relative;
}
:deep(.sar-tabbar__item--current .sar-tabbar__text::after) {
  content: '';
  position: absolute;
  inset: -6px -10px;
  background: radial-gradient(circle, rgba(46,137,255,0.48) 0%, rgba(46,137,255,0) 70%);
  opacity: 0.9;
  pointer-events: none;
  filter: blur(8px);
}

:deep(.sar-badge) {
  top: -4px;
  right: -12px;
}
</style>
