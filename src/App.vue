<!--
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-02 03:16:14
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-02 03:16:29
 * @FilePath: /NEWAPP/src/App.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<script>
	import { useSysInfoStore } from '@/stores'

	// #ifdef MP-WEIXIN
	import { checkUpdate } from '@/utils/weixin'
	// #endif

	// #ifdef APP-PLUS
	import { unregisterRequestPermissionTipsListener } from '@/uni_modules/uni-registerRequestPermissionTips'
	import { listenPermissionRequest } from '@/utils/app'
	// #endif

	export default {
		onLaunch() {
			useSysInfoStore().setSystemInfo()

			// #ifdef APP-PLUS
			listenPermissionRequest()
			// #endif
		},

		onShow() {
			// #ifdef MP-WEIXIN
			checkUpdate()
			// #endif
		},

		onExit() {
			// #ifdef APP-PLUS
			// 取消注册权限监听事件
			if (useSysInfoStore().systemInfo.osName === 'android') unregisterRequestPermissionTipsListener(null)
			// #endif
		}
	}
</script>

<style lang="scss">
// 说明：原先使用 @use 会因 uni-app 条件编译指令插入导致出现“@use rules must be written before any other rules”报错，
// 在此改为 @import（Sass 未来将弃用但当前兼容性更好，且本项目仅用于聚合全局样式，不依赖命名空间特性）。
@import 'sard-uniapp/index.scss';
@import '@/static/css/flex.scss';
/* #ifndef APP-NVUE */
@import '@/static/css/global.scss';
/* #endif */
</style>