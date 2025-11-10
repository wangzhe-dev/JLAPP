// 简易 token 工具，兼容老项目 getToken/setToken/removeToken 签名
const TOKEN_KEY = 'ACCESS_TOKEN'

export function getToken(key: string = TOKEN_KEY): string | null {
  try { return uni.getStorageSync(key) || null } catch { return null }
}
export function setToken(token: string, key: string = TOKEN_KEY) {
  try { uni.setStorageSync(key, token) } catch { /* ignore */ }
}
export function removeToken(key: string = TOKEN_KEY) {
  try { uni.removeStorageSync(key) } catch { /* ignore */ }
}

export { setToken as saveToken }