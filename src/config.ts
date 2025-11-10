/*
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-02 03:47:13
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-14 15:09:14
 * @FilePath: /NEWAPP/src/config.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// 兼容 CJS：使用工具函数安全识别开发环境
// 使用相对路径，避免在 Vite config 解析阶段（尚未注入别名 @）出现模块无法解析
import { getEnvVar, isDevRuntime } from './utils/env'

const apiPrefix = getEnvVar('VITE_API_PREFIX') || 'prod-api'

// 统一抽取后端接口域名（兼容历史命名）
const envApiBase =
  getEnvVar('VITE_APP_API_BASE') ||
  getEnvVar('VITE_API_BASE') ||
  getEnvVar('VITE_API_TARGET') ||
  ''

// 资源域名：优先单独配置 -> MinIO -> 接口域名
const envImgBase =
  getEnvVar('VITE_APP_IMG_BASE') ||
  process.env.VITE_APP_IMG_BASE ||
  process.env.IMG_BASE_URL ||
  ''

const cliMinioBase =
  process.env.npm_config_VITE_MINIO_BASE ||
  process.env.npm_config_minio_base ||
  process.env.npm_config_minioBase

const DEFAULT_MINIO_BASE = 'http://10.147.128.87:9000'

const envMinioBase =
  getEnvVar('VITE_MINIO_BASE') ||
  process.env.VITE_MINIO_BASE ||
  process.env.MINIO_BASE_URL ||
  process.env.MINIO_BASE ||
  cliMinioBase ||
  ''
let requestUrl = envApiBase
let imgUrl = envImgBase
let minioBaseUrl = envMinioBase
const isDev = isDevRuntime()

// 在非 HBuilder / Node 纯执行（如 vite.config.ts 加载）阶段可能没有 uni，对其访问做保护
const uniGlobal: any = (globalThis as any)?.uni
if (isDev) {
  if (uniGlobal && typeof uniGlobal.getStorageSync === 'function') {
    let url = ''
    try { url = uniGlobal.getStorageSync('requestUrl') || '' } catch { url = '' }
    if (url) requestUrl = url
  }
  // eslint-disable-next-line no-console
  console.log('[ENV] 当前接口地址 =>', requestUrl || '(相对路径)')
}

function appendPrefixIfNeeded(base: string) {
  if (!base || !apiPrefix) return base
  if (base.includes(`/${apiPrefix}`)) return base
  return `${base.replace(/\/+$/, '')}/${apiPrefix}`
}

requestUrl = appendPrefixIfNeeded(requestUrl)

if (!imgUrl) imgUrl = minioBaseUrl || requestUrl || DEFAULT_MINIO_BASE
if (!minioBaseUrl) minioBaseUrl = imgUrl || requestUrl || DEFAULT_MINIO_BASE

if (!requestUrl) requestUrl = ''

// 默认登录页路径（保持与 pages.json 中实际存在的页面一致）
// 如需扩展多种登录方式，可在此加逻辑动态返回
const loginPage = '/pages/login/index'

// h5 接口代理的路径前缀（需与 vite.config.ts 中 proxy 的前缀保持一致）
// 默认 prod-api，可通过 VITE_API_PREFIX 覆盖

// 主题色
const mainColor = '#FF6E26'

// 分享给朋友
const mpShareFriend = { title: 'uniapp - 分享给朋友', path: '/pages/index/index', imageUrl: `${imgUrl}/default-share.png` }

// 分享到朋友圈
const mpShareTimeline = { title: 'uniapp - 分享到朋友圈', query: '', imageUrl: `${imgUrl}/default-share.png` }

export {
  requestUrl,
  imgUrl,
  minioBaseUrl,
  loginPage,
  apiPrefix,
  mainColor,
  mpShareFriend,
  mpShareTimeline
}
