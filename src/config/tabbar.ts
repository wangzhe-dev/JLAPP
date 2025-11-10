import type { Ref } from 'vue'

export interface AppTabItem {
  label: string
  path: string
  icon?: string
  badge?: number | string
  dot?: boolean
  // 预留：是否是中间操作按钮
  type?: 'tab' | 'action'
}

// 默认 Tab 配置（可按权限在外部过滤）
export const defaultTabs: AppTabItem[] = [
  { label: '首页', path: '/pages/index/index', icon: 'home' },
//   { label: '消息', path: '/pages/message/index', icon: 'message', badge: 0 },
  { label: '我的', path: '/pages/my/index', icon: 'user' }
]

// 工具：根据未读数更新消息徽标（可在 store 订阅中调用）
export function updateMessageBadge(tabs: AppTabItem[], unread: number) {
  const t = tabs.find(t => t.path.includes('/pages/message/'))
  if (t) t.badge = unread
}

// 工具：创建响应式 tabs（若需要在外部动态修改）
export function useReactiveTabs(source: AppTabItem[] | Ref<AppTabItem[]>) {
  // 这里暂时简单返回，后续如需深拷贝或 watch 可扩展
  return source
}
