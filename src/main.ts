/*
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-02 03:21:22
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-02 03:22:32
 * @FilePath: /NEWAPP/src/main.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import App from './App.vue'
import { createUnistorage } from 'pinia-plugin-unistorage'
import uniapi from './utils/common/uniapi'
import { registerRouteGuard } from '@/utils/route-guard'
import { loginPage, imgUrl, mainColor } from '@/config'
import 'sard-uniapp/global.d.ts'
import '@/uni.scss'
// 自定义包装组件（未走 easycom 自动匹配时需显式注册）
import CCard from '@/components/c-card/CCard.vue'
import CButton from '@/components/c-button/CButton.vue'
import CQuickActionSheet from '@/components/c-quick-action-sheet/CQuickActionSheet.vue'
import PageLayout from '@/components/c-page-layout/PageLayout.vue'
import AppTabbar from '@/components/app-tabbar/AppTabbar.vue'
import NavigationPlugin from '@/utils/navigation'

// #ifdef MP-WEIXIN
import mpShareMixin from './mixin/mp-share-mixin'
// #endif

export const createApp = () => {
	const app = createSSRApp(App)

	// 全局属性
	app.config.globalProperties.$loginPage = loginPage
	app.config.globalProperties.$imgUrl = imgUrl
	app.config.globalProperties.$mainColor = mainColor

	// pinia 的本地数据缓存插件
	const store = Pinia.createPinia()
	store.use(createUnistorage())
	app.use(store)

	// uni工具类函数
	app.use(uniapi)
	// 导航封装（带预留守卫能力）
	app.use(NavigationPlugin)

	// 全局注册自定义 c-* 组件，避免页面局部 import
	app.component('CCard', CCard)
	app.component('CButton', CButton)
	app.component('CQuickActionSheet', CQuickActionSheet)
	app.component('PageLayout', PageLayout)
	app.component('AppTabbar', AppTabbar)

	// 注册路由守卫（需在 pinia 初始化之后）
	registerRouteGuard(app)

	// #ifdef MP-WEIXIN
	// 小程序分享的mixin封装
	app.mixin(mpShareMixin)
	// #endif

	return {
		app,
		Pinia
	}
}

