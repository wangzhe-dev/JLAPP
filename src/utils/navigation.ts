// 统一封装导航，预留权限或登录校验扩展
// 目前 DISABLE_AUTH_GUARD = true 时，直接透传到 uni.x API
// options: { params?: Record<string,any>, method?: 'navigateTo'|'switchTab'|'redirectTo'|'reLaunch' }
import { showModalAsync } from '@/utils/modal'
export interface NavOptions {
  params?: Record<string, any>
  method?: 'navigateTo' | 'switchTab' | 'redirectTo' | 'reLaunch'
}

function buildUrl(path: string, params?: Record<string, any>) {
  if (!params || !Object.keys(params).length) return path
  const usp = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return usp ? `${path}?${usp}` : path
}

export function navigateToWithGuard(path: string, options: NavOptions = {}) {
  if (!path) return
  const method = options.method || 'navigateTo'
  const url = buildUrl(path, options.params)
  try {
    switch (method) {
      case 'switchTab':
        uni.switchTab({ url })
        break
      case 'redirectTo':
        uni.redirectTo({ url })
        break
      case 'reLaunch':
        uni.reLaunch({ url })
        break
      default:
        uni.navigateTo({ url })
    }
  } catch (e) {
    console.warn('[navigateToWithGuard] failed', e)
  }
}

// 导航函数简化版本
export function navigateTo(path: string, params?: Record<string, any>) {
  navigateToWithGuard(path, { params })
}

export function navigateBack(delta: number = 1) {
  uni.navigateBack({ delta })
}

// 弹窗函数

export function showModal(options: {
  title?: string
  content?: string
  showCancel?: boolean
  cancelText?: string
  confirmText?: string
  lockKey?: string
}): Promise<boolean> {
  const title = options.title || '提示'
  const content = options.content || ''
  return showModalAsync({
    title,
    content,
    showCancel: options.showCancel !== false,
    cancelText: options.cancelText || '取消',
    confirmText: options.confirmText || '确定',
    lockKey: options.lockKey || `${title}::${content}`,
  })
    .then((res) => !!res.confirm)
    .catch(() => false)
}

export function showToast(title: string, options?: {
  icon?: 'success' | 'error' | 'loading' | 'none'
  duration?: number
}) {
  uni.showToast({
    title,
    icon: options?.icon || 'none',
    duration: options?.duration || 2000
  })
}

export default {
  install(app: any) {
    app.config.globalProperties.$navigateToWithGuard = navigateToWithGuard
  }
}
