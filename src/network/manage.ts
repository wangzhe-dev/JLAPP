// 兼容老项目导出：统一转向 utils/request.ts 中的增强 http 方法
// - postAction: 直接 body 传参
// - postQueryAction: 参数作为 query 拼接（浅层）
// - postParamsAction: 使用 tansParams 深度展开（数组/嵌套对象）后拼接
// 说明：老项目里经常出现 let urls = base + '?' + tansParams(finalData) 的写法
// 现在无需手工拼接，直接使用 postParamsAction 即可

import { http } from '@/utils/request'

/** 与老项目一致：POST body 方式 */
export function postAction<T = any>(url: string, data?: any, _opts?: any) {
  return http.post<T>(url, data)
}

/** 与老项目一致：POST + query 方式（浅层对象） */
export function postQueryAction<T = any>(url: string, params?: Record<string, any>, _opts?: any) {
  return http.postQuery<T>(url, params)
}

/** 老项目 tansParams 深度序列化后的 URL 方式 */
export function postParamsAction<T = any>(url: string, params?: Record<string, any>, _opts?: any) {
  return http.postParams<T>(url, params)
}

// 可按需补充 put / delete 的旧式别名
export const legacyHttp = { postAction, postQueryAction, postParamsAction }