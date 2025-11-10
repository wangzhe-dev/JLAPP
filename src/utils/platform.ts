// 平台判定辅助，与条件编译指令配合使用
// UNI_PLATFORM 在构建期注入，可用于 H5 / mp-weixin / app-plus 等

export const getUniPlatform = () => process.env.UNI_PLATFORM || ''
export const isH5 = () => getUniPlatform() === 'h5'
export const isMpWeixin = () => getUniPlatform() === 'mp-weixin'
export const isAppPlus = () => getUniPlatform() === 'app-plus'
export const isDev = () => process.env.NODE_ENV === 'development'

// 运行时也可通过 uni.getSystemInfo 来补充更细信息
