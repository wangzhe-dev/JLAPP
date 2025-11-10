// 路由前置守卫（H5 / App / 小程序 通用增强版）
// 目标：打包 APK 后（App-Plus 环境）依旧生效。
// 实现策略（多层保障）：
// 1. 全局 mixin: onLoad + onShow 双钩子，确保冷启动、热启动、后台切前台均拦截。
// 2. 导航方法拦截：通过 uni.addInterceptor 拦截 navigateTo / redirectTo / switchTab / reLaunch。
// 3. 路径解析兼容：优先 $page.fullPath -> route -> getCurrentPages() 最后一项。
// 4. 防止死循环：对登录页自身与白名单跳转做短路判断。
// 5. App-Plus 特殊场景（冷启动 plus.runtime 还未 ready）：守卫不依赖 plus 对象，避免阻塞。
// 6. 可扩展：登录后可读取 __pendingPath 恢复（预留注释）。

import { useUserStore } from '@/stores'
import { loginPage } from '@/config'
// 简化阶段：暂不做权限点校验，仅凭 token 判定是否允许访问

// ===== 登录/权限守卫开关 =====
// 使用环境变量控制：VITE_DISABLE_AUTH_GUARD=1 时完全关闭（用于联调放行）；未设置或为其它值时启用守卫。
// 关闭后效果：
// 1. 不注册任何导航拦截器
// 2. onLoad / onShow 不做 token / 权限检查
// 3. 所有页面（除自身逻辑限制）可直接访问
// 切记：生产环境不要设置该变量。
// 如果需要同时放开接口校验，可结合我们在 request.ts 中的 RELAX_* 开关。
const DISABLE_AUTH_GUARD = (import.meta as any).env?.VITE_DISABLE_AUTH_GUARD === '1'

// 不需要登录即可访问的页面（path 以 pages.json 中的 path 为准）
const WHITE_LIST = new Set<string>([
  loginPage,
  '/pages/workOrderPicker/index'
])

// 首页路径（token 存在访问登录页时重定向）
const HOME_PATH = '/pages/index/index'

function normalizePath(path: string): string {
  if (!path) return ''
  // 去掉 query/hash 再比较权限（查询参数不影响鉴权）
  const pure = path.split('?')[0].split('#')[0]
  return pure.startsWith('/') ? pure : `/${pure}`
}

function resolveCurrentPath(ctx: any): string {
  // @ts-ignore
  let route: string = ctx?.$page?.fullPath || ctx?.route || ''
  if (!route) {
    try {
      const pages = getCurrentPages()
      const last: any = pages[pages.length - 1]
      route = last?.$page?.fullPath || last?.route || ''
    } catch { /* ignore */ }
  }
  return normalizePath(route)
}

function needAuth(path: string, token: string | undefined) {
  if (!path) return false // 无路径不处理
  if (WHITE_LIST.has(path)) return false
  return !token
}

function reLaunchSafe(target: string, fallback?: string) {
  if (!target) return
  uni.reLaunch({
    url: target,
    fail: () => {
      if (fallback && fallback !== target) {
        uni.reLaunch({ url: fallback })
      } else if (fallback !== loginPage) {
        uni.reLaunch({ url: loginPage })
      }
    }
  })
}

function isLoginPage(path: string) { return path === loginPage }

let interceptorsRegistered = false
function registerInterceptors() {
  if (interceptorsRegistered) return
  interceptorsRegistered = true
   // 仅在 H5 与 App 平台使用拦截器（避免小程序平台 addInterceptor 差异导致警告）
   // #ifdef H5 || APP-PLUS
   const NAV_METHODS: Array<'navigateTo' | 'redirectTo' | 'switchTab' | 'reLaunch'> = ['navigateTo','redirectTo','switchTab','reLaunch']
   NAV_METHODS.forEach(method => {
     uni.addInterceptor(method, {
       invoke(args: any) {
         try {
           const userStore = useUserStore()
           const token = userStore.token
           const target = normalizePath(args?.url || '')
           if (!target) return args
           if (isLoginPage(target) && token) {
             uni.switchTab({ url: HOME_PATH })
             return false
           }
          if (needAuth(target, token)) {
            try { uni.setStorageSync('__pendingPath', target) } catch {}
            reLaunchSafe(loginPage)
            return false
          }
        } catch (e) { console.warn('[route-guard:intercept]', e) }
        return args
      }
     })
   })
   // #endif
}

export function registerRouteGuard(app: any) {
  if (DISABLE_AUTH_GUARD) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[route-guard] 已关闭 (VITE_DISABLE_AUTH_GUARD=1)，所有页面无需登录即可访问')
    }
    app.mixin({})
    return
  }

  // ===== 以下为原完整守卫逻辑（保留，开关恢复后即可生效） =====
  registerInterceptors()
  app.mixin({
    onLoad(this: any) {
      try {
        const userStore = useUserStore()
        const token = userStore.token
        const normalized = resolveCurrentPath(this)
        if (!normalized) return
        if (token && isLoginPage(normalized)) {
          let redirect = ''
          try { redirect = uni.getStorageSync('__pendingPath') || '' } catch { redirect = '' }
          if (redirect && redirect !== HOME_PATH && redirect !== loginPage) {
            try { uni.removeStorageSync('__pendingPath') } catch {}
            setTimeout(() => reLaunchSafe(redirect, HOME_PATH), 0)
            return
          }
          setTimeout(() => {
            uni.switchTab({
              url: HOME_PATH,
              fail: () => uni.reLaunch({ url: HOME_PATH })
            })
          }, 0)
          return
        }
        // 已去除权限点校验逻辑：只要有 token 即放行
        if (needAuth(normalized, token)) {
          setTimeout(() => reLaunchSafe(loginPage), 0)
        }
      } catch (e) { console.warn('[route-guard] onLoad error', e) }
    },
    onShow(this: any) {
      try {
        const userStore = useUserStore()
        const token = userStore.token
        const normalized = resolveCurrentPath(this)
        if (!normalized) return
        if (token && isLoginPage(normalized)) {
          let redirect = ''
          try { redirect = uni.getStorageSync('__pendingPath') || '' } catch { redirect = '' }
          if (redirect && redirect !== HOME_PATH && redirect !== loginPage) {
            try { uni.removeStorageSync('__pendingPath') } catch {}
            setTimeout(() => reLaunchSafe(redirect, HOME_PATH), 0)
            return
          }
          setTimeout(() => {
            uni.switchTab({
              url: HOME_PATH,
              fail: () => uni.reLaunch({ url: HOME_PATH })
            })
          }, 0)
          return
        }
        // 已去除权限点校验逻辑
        if (needAuth(normalized, token)) {
          setTimeout(() => reLaunchSafe(loginPage), 0)
        }
      } catch (e) { console.warn('[route-guard] onShow error', e) }
    }
  })
}

export { WHITE_LIST, HOME_PATH }
