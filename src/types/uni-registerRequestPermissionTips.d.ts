declare module '@/uni_modules/uni-registerRequestPermissionTips' {
	export interface RequestPermissionTipsListener {
		/**
		 * 申请系统权限回调，permissions为触发权限申请的所有权限
		 */
		onRequest ?: ((permissions : ('grant' | 'denied')[]) => void) | null
		/**
		 * 弹出系统权限授权框回调，permissions为触发弹出权限授权框的所有权限
		 */
		onConfirm ?: ((permission : ('grant' | 'denied')[]) => void) | null
		/**
		 * 权限申请完成回调，permissions包括权限及权限的状态
		 * grant为权限已获取，denied为权限已拒绝
		 */
		onComplete ?: ((permissions : Record<string, 'grant' | 'denied'>) => void) | null
	}

	export type RegisterRequestPermissionTipsListener = (listener : RequestPermissionTipsListener | null) => void
	export type UnregisterRequestPermissionTipsListener = (listener : RequestPermissionTipsListener | null) => void
	export type SetRequestPermissionTips = (tips : Record<string, string>) => void

	/**
	 * 注册权限监听器
	 * @see https://ext.dcloud.net.cn/plugin?name=uni-registerRequestPermissionTips
	 */
	export const registerRequestPermissionTipsListener : RegisterRequestPermissionTipsListener
	/**
	 * 设置权限监听的说明。支持针对权限设置具体的说明
	 * @see https://ext.dcloud.net.cn/plugin?name=uni-registerRequestPermissionTips
	 */
	export const setRequestPermissionTips : SetRequestPermissionTips
	/**
	 * 注销权限监听器
	 * @see https://ext.dcloud.net.cn/plugin?name=uni-registerRequestPermissionTips
	 */
	export const unregisterRequestPermissionTipsListener : UnregisterRequestPermissionTipsListener
}