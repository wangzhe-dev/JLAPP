/*
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-02 03:24:41
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-14 15:09:00
 * @FilePath: /NEWAPP/src/config/index.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * 应用公共配置出口
 * - 统一为各模块提供常量，避免在代码中写死路径/URL
 */
import { getEnvVar } from '@/utils/env'

const DEFAULT_IMG_URL = 'http://10.147.128.87:9000'

// 接口前缀（仅 H5 下用于代理前缀），默认 'api'
export const apiPrefix: string = (getEnvVar('VITE_API_PREFIX') as string) || 'api'

// 后端基地址（App-Plus/小程序等非 H5 平台使用），例如：https://api.example.com
export const requestUrl: string = (getEnvVar('VITE_API_BASE') as string) || ''

// 图片基础地址，未配置则回退到 requestUrl
export const imgUrl: string =
  (getEnvVar('VITE_IMG_BASE') as string) || requestUrl || DEFAULT_IMG_URL

export const minioBaseUrl: string =
  (getEnvVar('VITE_MINIO_BASE') as string) || imgUrl || requestUrl || DEFAULT_IMG_URL

// 登录页路径（以 / 开头，与 pages.json 中的 path 对齐）
export const loginPage = '/pages/login/index'

// 主题主色，可与全局样式保持一致
export const mainColor = (getEnvVar('VITE_MAIN_COLOR') as string) || '#FF6E26'

export default {
  apiPrefix,
  requestUrl,
  imgUrl,
  minioBaseUrl,
  loginPage,
  mainColor
}
