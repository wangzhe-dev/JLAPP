// #ifdef H5
/**
 * 判断是否在微信浏览器内
 * @return { Boolean }
 */
export const isWechat = () : boolean => {
	return navigator.userAgent.toLowerCase().indexOf('micromessenger') !== -1
}

/**
 * 关闭h5页面窗口
 */
export const closePage = () => {
	if (!isWechat()) return window.close()

	setTimeout(() => {
		// 安卓
		document.addEventListener('WeixinJSBridgeReady', () => {
			WeixinJSBridge?.call('closeWindow')
		}, false)

		// ios
		WeixinJSBridge?.call('closeWindow')
	}, 100)
}

/**
 * h5中打开App
 * @description 如果没下载app，android:直接下载、ios:跳转到AppStore。如果已下载，则直接打开
 * @param scheme urlscheme
 * @param downloadUrl app的下载地址 如果打开的是ios:传入AppStore的下载地址，android:传入apk的下载地址
 * @param h5Url h5中的app下载页的地址
 */
export const openApp = (scheme : string = 'weixin://', downloadUrl : string = '', h5Url ?: string) => {
	if (isWechat()) {
		// 在微信环境内可以使用微信开放标签wx-open-launch-app直接打开app 这样体验更好
		return showModalAsync({
			title: '温馨提示',
			content: '请在浏览器中打开该网页',
			confirmText: '复制链接',
			showCancel: false,
			lockKey: 'h5-open-app'
		}).then((res) => {
			if (res.confirm && h5Url) uni.$tao.copy(h5Url)
		}).catch(() => {})
	}

	uni.showLoading({
		title: '加载中'
	})
	const currentTime = Date.now()
	window.location.href = scheme

	// 启动间隔20ms运行的定时器，并检测累计消耗时间是否超过3000ms，超过则结束
	let count = 0
	let timer: ReturnType<typeof setInterval> | undefined
	timer = setInterval(() => {
		count++
		const endTime = Date.now() - currentTime
		if (count >= 100 || endTime > 3000) {
			uni.hideLoading()
			clearInterval(timer)
			timer = undefined
			const hidden = window.document.hidden
			if (typeof hidden === 'undefined' || hidden === false) {
				if (downloadUrl) window.location.href = downloadUrl
			}
		}
	}, 20)
}
// #endif
import { showModalAsync } from '@/utils/modal'
