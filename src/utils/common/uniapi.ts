import validate from './validate'

/**
 * 显示消息提示框
 * @param title 提示消息
 * @param duration 提示的延迟时间
 */
const toast = (title : string, duration : number = 1500) => {
	uni.showToast({
		title,
		duration,
		icon: 'none'
	})
}

/**
 * 设置系统剪贴板的内容
 * @param text 需要设置的内容
 * @param toastTitle 设置成功后的提示文字
 */
const copy = (text : string, toastTitle : string = '复制成功') => {
	uni.setClipboardData({
		data: text,
		success: () => {
			uni.$tao.toast(toastTitle)
		}
	})
}

// 自定义属性挂载到uni对象上
export default {
	install() {
		if (!uni || typeof uni !== 'object') return

		uni.$tao = {
			toast,
			copy,
			validate: {
				...validate
			}
		}
	}
}