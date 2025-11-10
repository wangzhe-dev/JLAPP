// #ifdef APP-PLUS
import { useSysInfoStore } from '@/stores'
import { isDevRuntime } from '@/utils/env'
import { registerRequestPermissionTipsListener, setRequestPermissionTips } from '@/uni_modules/uni-registerRequestPermissionTips'
import { showModalAsync } from '@/utils/modal'

/**
 * App Android平台权限监听申请
 */
export const listenPermissionRequest = async () => {
	const sysInfo = useSysInfoStore()
	if (sysInfo.systemInfo.osName !== 'android') return

	type PermissionTipsType = {
		[key : string] : string
	}

	const permissionTips : PermissionTipsType = {
		'android.permission.CAMERA': '<h4 style="font-size:40px;">正在读取相机权限</h4><font color=#cccccc>允许访问摄像头以方便为您个人资料拍摄照片、拍摄终端门店资质文件、扫描二维码等内容</font>',
		'android.permission.READ_EXTERNAL_STORAGE': '<h4 style="font-size:40px;">正在读取相册权限</h4><font color=#cccccc>允许访问照片以从图库添加到您的个人资料、上传终端门店资质文件、发布视频动态等内容</font>',
		'android.permission.READ_MEDIA_IMAGES': '<h4 style="font-size:40px;">正在读取相册权限</h4><font color=#cccccc>允许访问照片以从图库添加到您的个人资料、上传终端门店资质文件、发布视频动态等内容</font>',
		'android.permission.WRITE_EXTERNAL_STORAGE': '<h4 style="font-size:40px;">正在读取相册存储权限</h4><font color=#cccccc>允许访问照片以保存资质图片</font>',
		'android.permission.CALL_PHONE': '<h4 style="font-size:40px;">正在读取电话权限</h4><font color=#cccccc>为了方便您在应用内直接拨打电话或联系其他用户，请授予我们访问您的电话权限</font>',
		'android.permission.RECORD_AUDIO': '<h4 style="font-size:40px;">正在读取麦克风权限</h4><font color=#cccccc>允许访问麦克风以方便您能够进行语音聊天或录制音频</font>',
		'android.permission.ACCESS_COARSE_LOCATION': '<h4 style="font-size:40px;">正在读取位置权限</h4><font color=#cccccc>您的位置信息用于获取您的省市区位置、显示附近的终端门店</font>'
	}

	const permission = [{
		permissionKey: 'android.permission.CAMERA',
		permissionName: '相机'
	}, {
		// 安卓api等级 < 33 走的是这个权限
		permissionKey: 'android.permission.READ_EXTERNAL_STORAGE',
		permissionName: '相册'
	}, {
		permissionKey: 'android.permission.READ_MEDIA_IMAGES',
		permissionName: '相册'
	}, {
		permissionKey: 'android.permission.WRITE_EXTERNAL_STORAGE',
		permissionName: '相册'
	}, {
		permissionKey: 'android.permission.CALL_PHONE',
		permissionName: '电话'
	}, {
		permissionKey: 'android.permission.RECORD_AUDIO',
		permissionName: '麦克风'
	}, {
		permissionKey: 'android.permission.ACCESS_COARSE_LOCATION',
		permissionName: '位置'
	}]

	let startTime = 0
	setRequestPermissionTips(permissionTips)
	registerRequestPermissionTipsListener({
		// 监听弹出系统权限授权框
		onConfirm: () => {
			startTime = new Date().getTime()
		},

		// 监听权限申请完成
		onComplete: (e : Record<string, 'grant' | 'denied'>) => {
			const appName = sysInfo.systemInfo.appName
			const diffTime = startTime ? new Date().getTime() - startTime : 0

			const tips : PermissionTipsType = {}
			let hasDeniedPermission = false
			for (const k in permissionTips) {
				if (e[k] !== 'denied') {
					tips[k] = permissionTips[k]
				} else {
					hasDeniedPermission = true
				}
			}

			// 更新弹框提醒，防止华为手机不出现权限申请框时权限提醒框闪烁的情况
			setRequestPermissionTips(tips)

			const permissionKey = Object.keys(e)[0]
			const permissionObj = permission.find((item) => item.permissionKey === permissionKey)
			const permissionName = permissionObj ? permissionObj.permissionName : permissionKey

			if (startTime) {
				startTime = 0
				// 已弹出权限申请框
				if (diffTime > 300) {
					if (hasDeniedPermission) {
						plus.nativeUI.toast(`${permissionName}权限已被拒绝，请前往设置-应用-${appName}-权限中开启`)
					}
					return
				}
			}

			if (hasDeniedPermission) {
				showModalAsync({
					title: '权限申请',
					content: `当前无${permissionName}访问权限，请前往设置-应用-${appName}-权限中开启${permissionName}权限`,
					confirmText: '去设置',
					lockKey: `permission::${permissionKey}`
				}).then((res) => {
					if (res.confirm) {
						uni.openAppAuthorizeSetting()
					}
				}).catch(() => {})
			}
		}
	})
}

/**
 * Android权限查询
 * @param {array} permissionList [权限id]
 */
export const requestAndroidPermission = (permissionList : string[]) : Promise<number> => {
	return new Promise((resolve, reject) => {
		// 支持多个权限同时查询
		plus.android.requestPermissions(
			permissionList,
			(resultObj) => {
				let result = 0
				for (let i = 0; i < resultObj.granted.length; i++) {
					const grantedPermission = resultObj.granted[i]
					console.log('已获取的权限：' + grantedPermission)
					result = 1
				}
				for (let i = 0; i < resultObj.deniedPresent.length; i++) {
					const deniedPresentPermission = resultObj.deniedPresent[i]
					console.log('拒绝本次申请的权限：' + deniedPresentPermission)
					result = 0
				}
				for (let i = 0; i < resultObj.deniedAlways.length; i++) {
					const deniedAlwaysPermission = resultObj.deniedAlways[i]
					console.log('永久拒绝申请的权限：' + deniedAlwaysPermission)
					result = -1
				}
				resolve(result)
			},
			(error) => {
				console.log('申请权限错误：' + error.message)
				reject(error.message)
			}
		)
	})
}

/**
 * 检测第三方App是否安装
 * @param pname app包名称，用于安卓环境判断
 * @param scheme urlscheme，用于IOS环境判断（需要再manifest.json文件中配置应用访问白名单）
 * @return { Boolean }
 */
export const checkAppInstall = (pname : string = 'com.tencent.mm', scheme : string = 'weixin://') : Promise<boolean> => {
	return new Promise((resolve) => {
		if (plus.runtime.isApplicationExist({ pname, action: scheme })) {
			// 应用已安装
			resolve(true)
		} else {
			// 未安装
			resolve(false)
		}
	})
}

/**
 * 打开App（已知手机中已安装了对应的app）
 * @param scheme urlscheme
 * @param params 需要传递的参数 如：id=1
 */
export const openTheApp = (scheme : string = 'weixin://', params : string = '') => {
	// 传参需要先 encodeURIComponent编码，接收参数时在 decodeURIComponent解码
	if (params) scheme = scheme + encodeURIComponent(params)

	const sys = useSysInfoStore().systemInfo
	if (sys.osName === 'android') {
		plus.runtime.openURL(scheme, (res) => {
			uni.$tao.toast('打开失败：' + JSON.stringify(res))
		})
	} else if (sys.osName === 'ios') {
		// 传入的是app store中的下载地址的话可以直接进行跳转
		plus.runtime.launchApplication({ action: scheme }, (err) => {
			uni.$tao.toast('打开失败：' + err.message)
		})
	}
}

/**
 * app打开微信小程序
 * @param path 微信小程序打开的页面路径 为空跳转到首页
 * @param type 微信小程序版本类型 0正式版 1测试版 2体验版 默认值为0
 * @param id 微信小程序的原始ID
 */
export const openWechatMiniProgram = (path : string, type : number = 0, id : string) : Promise<void> => {
	return new Promise((resolve) => {
		plus.share.getServices((res) => {
			let sweixin = null
			for (let i = 0; i < res.length; i++) {
				const t = res[i]
				if (t.id && String(t.id) === 'weixin') {
					sweixin = t
				}
			}
			if (sweixin) {
				// 当为生产环境时，微信小程序版本类型默认为正式版 (兼容 CJS 无 import.meta)
				if (!isDevRuntime()) {
					type = 0
				}
				sweixin.launchMiniProgram({ id, path, type })
				resolve()
			} else {
				showModalAsync({
					title: '温馨提示',
					content: '当前环境不支持微信操作!',
					showCancel: false,
					lock: false
				}).catch(() => {})
			}
		}, (res) => {
			showModalAsync({
				title: '温馨提示',
				content: '打开微信小程序失败：' + JSON.stringify(res),
				showCancel: false,
				lock: false
			}).catch(() => {})
		})
	})
}

/**
 * 一键登录 - 预登录
 * @return { Boolean }
 */
export const preLogin = () : Promise<boolean> => {
	return new Promise((resolve) => {
		uni.preLogin({
			provider: 'univerify',
			success: () => resolve(true),
			fail(err) {
				// 如果手机没有插入有效的sim卡，或者手机蜂窝数据网络关闭，都有可能造成预登录校验失败。
				if (err.errMsg !== 'login:ok') {
					// 不同运营商 返回的报错字段不同
					showModalAsync({
						title: '温馨提示',
						content: err.errMsg || err.metadata.resultMsg || err.metadata.error_data || err.metadata.resultDesc ||
							'请检查是否插入有效sim卡及开启蜂窝数据网络',
						showCancel: false,
						lock: false
					}).catch(() => {})
				}
				resolve(false)
			}
		})
	})
}
// #endif
