// 页面导航与跳转策略常量
// 统一集中，后续若需根据角色动态首页可在此扩展

export const HOME_PAGE = '/pages/index/index'

// 控制是否启用登录前 pendingPath 回跳逻辑
// true = 忽略 pendingPath，始终进入 HOME_PAGE
// false = 保留原逻辑（若有 pendingPath 优先回跳）
export const IGNORE_PENDING_PATH = true
