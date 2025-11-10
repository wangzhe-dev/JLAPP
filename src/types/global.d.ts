import 'vite/client'

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_MINIO_BASE?: string
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

// WeixinJSBridge (H5 微信内置对象) - 使用宽松类型以避免阻塞开发
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const WeixinJSBridge: { call: (method: string, ...args: any[]) => void } | undefined

// 小程序 wx 对象（仅类型兜底）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const wx: any
