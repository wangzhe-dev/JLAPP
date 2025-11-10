import { unref } from 'vue'
import type { Ref } from 'vue'

type MaybeRef<T> = T | Ref<T>

export interface TabDescriptor {
  name?: string | number
  key?: string | number
}

export interface TabSwitchPayload<T extends TabDescriptor = TabDescriptor> {
  name: any
  index: number
  tab: T
}

export interface UseTabSwipeOptions<T extends TabDescriptor = TabDescriptor> {
  tabs: MaybeRef<T[] | undefined | null>
  activeTab: Ref<any> | ((next: any) => void)
  disabled?: MaybeRef<boolean | undefined>
  /**
   * Minimum horizontal distance (px) required to trigger a swipe. Default: 60
   */
  minDistance?: number
  /**
   * Maximum vertical delta (px) allowed while swiping horizontally. Default: 40
   */
  maxVerticalDelta?: number
  /**
   * Invoked after a successful tab switch.
   */
  onSwitched?: (next: TabSwitchPayload<T>) => void
}

type SwipeEvent = UniHelper.TouchEvent

export interface UseTabSwipeReturn {
  onTouchStart: (e: SwipeEvent) => void
  onTouchMove: (e: SwipeEvent) => void
  onTouchEnd: (e: SwipeEvent) => void
  /**
   * Convenience object for `v-on="swipeHandlers"`
   */
  swipeHandlers: Record<string, (e: SwipeEvent) => void>
  /**
   * Programmatically move to previous / next tab
   */
  switchBy: (offset: number) => void
}

interface NormalizedTab<T extends TabDescriptor = TabDescriptor> {
  raw: T
  index: number
  value: any
  normalized: string
}

function resolveDisabled(flag?: MaybeRef<boolean | undefined>) {
  return !!unref(flag)
}

function toList<T extends TabDescriptor>(
  tabsSource: MaybeRef<T[] | undefined | null>
): NormalizedTab<T>[] {
  const resolved = unref(tabsSource)
  if (!Array.isArray(resolved)) return []
  return resolved.map<NormalizedTab<T>>((tab, idx) => {
    const value = tab?.name ?? tab?.key ?? idx
    return {
      raw: tab,
      index: idx,
      value,
      normalized: value === 0 ? '0' : String(value ?? idx)
    }
  })
}

function readActive(active: Ref<any> | ((next: any) => void)): any {
  if (typeof active === 'function') return undefined
  return active.value
}

function writeActive(active: Ref<any> | ((next: any) => void), next: any) {
  if (typeof active === 'function') {
    active(next)
  } else {
    active.value = next
  }
}

function readPoint(touch: any) {
  if (!touch) return null
  const candidateX =
    touch.clientX ?? touch.x ?? touch.pageX ?? touch.screenX ?? touch.changedTouches?.[0]?.clientX
  const candidateY =
    touch.clientY ?? touch.y ?? touch.pageY ?? touch.screenY ?? touch.changedTouches?.[0]?.clientY
  const x = Number(candidateX)
  const y = Number(candidateY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

export function useTabSwipe<T extends TabDescriptor = TabDescriptor>(
  options: UseTabSwipeOptions<T>
): UseTabSwipeReturn {
  let touchStartX = 0
  let touchStartY = 0
  let suppressed = false

  const minDistance = Number(options.minDistance ?? 60)
  const maxVerticalDelta = Number(options.maxVerticalDelta ?? 40)

  function onTouchStart(e: SwipeEvent) {
    if (resolveDisabled(options.disabled)) return
    const touch = readPoint(e.touches?.[0])
    if (!touch) return
    touchStartX = touch.x
    touchStartY = touch.y
    suppressed = false
  }

  function onTouchMove(e: SwipeEvent) {
    if (suppressed || resolveDisabled(options.disabled)) return
    const point = readPoint(e.touches?.[0])
    if (!point) return
    const dx = point.x - touchStartX
    const dy = Math.abs(point.y - touchStartY)
    if (dy > Math.abs(dx)) suppressed = true
  }

  function switchBy(offset: number) {
    if (!offset) return
    const tabs = toList<T>(options.tabs)
    if (!tabs.length) return
    const activeValue = readActive(options.activeTab)
    const normalizedActive = activeValue === 0 ? '0' : String(activeValue ?? '')
    let currentIndex = tabs.findIndex((tab) => tab.normalized === normalizedActive)
    if (currentIndex < 0) currentIndex = 0
    const nextIndex = currentIndex + offset
    if (nextIndex < 0 || nextIndex >= tabs.length) return
    const next = tabs[nextIndex]
    writeActive(options.activeTab, next.value)
    options.onSwitched?.({
      name: next.value,
      index: nextIndex,
      tab: next.raw as T
    })
  }

  function onTouchEnd(e: SwipeEvent) {
    if (suppressed || resolveDisabled(options.disabled)) return
    const touch = readPoint(e.changedTouches?.[0])
    if (!touch) return
    const dx = touch.x - touchStartX
    const dy = Math.abs(touch.y - touchStartY)
    if (Math.abs(dx) < minDistance || dy > maxVerticalDelta) return
    switchBy(dx < 0 ? 1 : -1)
  }

  const swipeHandlers: Record<string, (e: SwipeEvent) => void> = {
    touchstart: onTouchStart,
    touchmove: onTouchMove,
    touchend: onTouchEnd,
    touchcancel: onTouchEnd
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeHandlers,
    switchBy
  }
}
