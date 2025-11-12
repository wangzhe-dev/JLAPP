/**
 * 平台判定辅助 - 多端适配工具
 * 支持编译时和运行时平台判断
 */

// 平台类型
export type Platform = 'h5' | 'mp-weixin' | 'mp-alipay' | 'mp-baidu' | 'app-plus' | 'app-android' | 'app-ios'

// 编译时平台判断（基于 UNI_PLATFORM）
export const getUniPlatform = () => process.env.UNI_PLATFORM || ''
export const isH5 = () => getUniPlatform() === 'h5'
export const isMpWeixin = () => getUniPlatform() === 'mp-weixin'
export const isMpAlipay = () => getUniPlatform() === 'mp-alipay'
export const isMpBaidu = () => getUniPlatform() === 'mp-baidu'
export const isAppPlus = () => getUniPlatform() === 'app-plus'
export const isApp = () => isAppPlus()
export const isMiniProgram = () => getUniPlatform().startsWith('mp-')
export const isDev = () => process.env.NODE_ENV === 'development'

// 运行时平台信息
export interface SystemInfo {
	platform: string
	osName: string
	osVersion: string
	screenWidth: number
	screenHeight: number
	windowWidth: number
	windowHeight: number
	statusBarHeight: number
	safeArea: {
		top: number
		bottom: number
		left: number
		right: number
	}
	navigationBarHeight: number
}

let cachedSystemInfo: SystemInfo | null = null

// 获取系统信息（含安全区域）
export function getSystemInfo(): SystemInfo {
	if (cachedSystemInfo) return cachedSystemInfo

	try {
		const sysInfo = uni.getSystemInfoSync()

		// 状态栏高度
		const statusBarHeight = sysInfo.statusBarHeight || 0

		// 导航栏高度（不同平台不同）
		let navigationBarHeight = 44
		if (isMpWeixin()) navigationBarHeight = 32
		if (isMpAlipay()) navigationBarHeight = 40
		if (isAppPlus()) navigationBarHeight = 44
		if (isH5()) navigationBarHeight = 44

		// 安全区域
		const safeAreaInsets = sysInfo.safeAreaInsets || {}
		const safeArea = {
			top: safeAreaInsets.top || statusBarHeight,
			bottom: safeAreaInsets.bottom || 0,
			left: safeAreaInsets.left || 0,
			right: safeAreaInsets.right || 0
		}

		cachedSystemInfo = {
			platform: sysInfo.platform || 'unknown',
			osName: sysInfo.osName || sysInfo.platform || 'unknown',
			osVersion: sysInfo.osVersion || '',
			screenWidth: sysInfo.screenWidth,
			screenHeight: sysInfo.screenHeight,
			windowWidth: sysInfo.windowWidth,
			windowHeight: sysInfo.windowHeight,
			statusBarHeight,
			safeArea,
			navigationBarHeight
		}
	} catch (e) {
		console.warn('[platform] getSystemInfo failed:', e)
		cachedSystemInfo = {
			platform: 'unknown',
			osName: 'unknown',
			osVersion: '',
			screenWidth: 375,
			screenHeight: 667,
			windowWidth: 375,
			windowHeight: 667,
			statusBarHeight: 20,
			safeArea: { top: 20, bottom: 0, left: 0, right: 0 },
			navigationBarHeight: 44
		}
	}

	return cachedSystemInfo
}

// 获取顶部安全距离
export function getTopSafeArea(): number {
	return getSystemInfo().safeArea.top
}

// 获取底部安全距离
export function getBottomSafeArea(): number {
	return getSystemInfo().safeArea.bottom
}

// 获取完整头部高度
export function getHeaderHeight(): number {
	const info = getSystemInfo()
	return info.statusBarHeight + info.navigationBarHeight
}

// rpx 转 px
export function rpxToPx(rpx: number): number {
	const info = getSystemInfo()
	return (rpx / 750) * info.windowWidth
}

// px 转 rpx
export function pxToRpx(px: number): number {
	const info = getSystemInfo()
	return (px * 750) / info.windowWidth
}

// 判断是否为 Android
export function isAndroid(): boolean {
	if (!isAppPlus()) return false
	const info = getSystemInfo()
	return info.platform.toLowerCase() === 'android'
}

// 判断是否为 iOS
export function isIOS(): boolean {
	if (!isAppPlus()) return false
	const info = getSystemInfo()
	return info.platform.toLowerCase() === 'ios'
}

// 平台特定样式类
export function getPlatformClass(): string {
	return `platform-${getUniPlatform()}`
}

// 是否支持某个 API
export function isSupportAPI(api: string): boolean {
	return typeof uni[api] === 'function'
}

// 振动反馈
export function vibrateShort() {
	if (isSupportAPI('vibrateShort')) {
		try {
			uni.vibrateShort({ type: 'light' })
		} catch (e) {
			console.warn('[platform] vibrateShort failed:', e)
		}
	}
}

export function vibrateLong() {
	if (isSupportAPI('vibrateLong')) {
		try {
			uni.vibrateLong()
		} catch (e) {
			console.warn('[platform] vibrateLong failed:', e)
		}
	}
}
