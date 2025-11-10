// 多端（尤其 H5 内嵌微信环境）可能存在的全局桥对象声明
// 仅提供最小能力，按需扩展
export {}

declare global {
  // 微信 H5 环境关闭窗口等操作
  const WeixinJSBridge: undefined | {
    call(method: string, ...args: any[]): void
    on?(event: string, handler: (...args: any[]) => void): void
    invoke?(method: string, data: any, cb: (...args: any[]) => void): void
  }
}
