/*
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-09-30 11:10:38
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-11 11:27:36
 * @FilePath: /NEWAPP/vite.config.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineConfig, Plugin, loadEnv } from 'vite'
import path from 'path'
import uni from '@dcloudio/vite-plugin-uni'
import AutoImport from 'unplugin-auto-import/vite'
// 提前加载环境辅助（使用相对路径，避免别名在解析 config 前不可用）
// (当前 isDevRuntime 仅在需要时可使用，如需区分构建逻辑可调用)
// import { isDevRuntime } from './src/utils/env'
	// 根据 UNI 平台判断是否为 H5（HBuilderX / CLI 构建时通常通过 UNI_PLATFORM 注入）
export default defineConfig(({ mode }) => {
	// 读取 env（第三个参数传 '' 以保留原始 key）
	const env = loadEnv(mode, process.cwd(), '')
	const isH5 = process.env.UNI_PLATFORM === 'h5'
	const apiPrefix = env.VITE_API_PREFIX || 'prod-api'
	const base = isH5 ? (env.VITE_BASE_H5 || '/jl-app/') : (env.VITE_BASE_DEFAULT || '/')
	const target = env.VITE_API_TARGET || 'http://localhost:3000'
	const passthrough = env.VITE_API_PREFIX_PASSTHROUGH === '1'
	if (env.VITE_HTTP_DEBUG === '1') {
		// eslint-disable-next-line no-console
		console.log('[DEV:proxy]', { apiPrefix, target, passthrough, base })
	}
	return {
	base,
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src')
		}
	},
	plugins: [
		uni(),
		AutoImport({
			// 自动导入 Vue 相关函数，如：ref, reactive, toRef, onLoad 等
			imports: ['vue', 'vue-router', 'uni-app'],
			dts: './src/types/auto-imports.d.ts',
			vueTemplate: true,
			// 生成相应的.eslintrc-auto-import.json文件。
			eslintrc: {
				// 1、改为true 用于生成eslint配置。2、生成后改回false，避免重复生成消耗
				enabled: false
			}
		}),
		(function injectIsCustomElement(): Plugin {
			return {
				name: 'inject-is-custom-element',
				configResolved(resolved) {
					const vuePlugin: any = resolved.plugins.find(p => p.name === 'vite:vue')
					if (vuePlugin && vuePlugin.options) {
						vuePlugin.options.template = vuePlugin.options.template || {}
						vuePlugin.options.template.compilerOptions = vuePlugin.options.template.compilerOptions || {}
						const tags = ['view','text','image','button','scroll-view','swiper','swiper-item','navigator','icon','picker','picker-view','picker-view-column','form','input','textarea','label','checkbox','checkbox-group','radio','radio-group','switch','slider','progress','rich-text','web-view','video','audio','camera','live-player','live-pusher','map','canvas','cover-image','cover-view','movable-area','movable-view']
						vuePlugin.options.template.compilerOptions.isCustomElement = (tag: string) => tags.includes(tag)
					}
				}
			}
		})()
	],
	optimizeDeps: {
		exclude: ['sard-uniapp'],
	},
	build: {
		minify: 'terser',
		terserOptions: {
			compress: {
				// 生产环境去除log语句和DBUG
				drop_console: process.env.NODE_ENV === 'production',
				drop_debugger: process.env.NODE_ENV === 'production'
			}
		}
	},
	// 合并项目自定义 server 配置（增加 host / headers / prod-api 代理）
	server: {
		host: 'localhost',
		port: 8080,
		open: true,
		strictPort: false,
		headers: { 'Cache-Control': 'no-store' },
		proxy: {
			[`/${apiPrefix}`]: passthrough ? {
				target,
				changeOrigin: true
			} : {
				target,
				changeOrigin: true,
				// rewrite: (p: string) => p.replace(new RegExp(`^/${apiPrefix}`), '')
			}
		}
	}
	}
})