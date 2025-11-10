// 运行时环境辅助（兼容 CJS 构建下无 import.meta.env 的情况）
// 使用惰性求值 + 多重回退，避免在打包为 commonjs 时访问 undefined 属性
export function getEnvVar(key: string): any {
  try {
    // 仅在支持 import.meta 的打包环境下有效 (ESM)
    const viteEnv = (import.meta as any)?.env
    if (viteEnv && key in viteEnv) return viteEnv[key]
  } catch (_) { /* ignore for CJS */ }
  if (typeof process !== 'undefined' && process.env && key in process.env) return (process.env as any)[key]
  return undefined
}

export function isDevRuntime(): boolean {
  const val = getEnvVar('DEV')
  if (typeof val === 'boolean') return val
  const mode = getEnvVar('MODE') || getEnvVar('NODE_ENV') || (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined)
  return mode === 'development'
}
