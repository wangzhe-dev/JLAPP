import { defineStore } from 'pinia'
import { loginPage } from '@/config'
import { EP } from '@/api/endpoints'
import { HOME_PAGE, IGNORE_PENDING_PATH } from '@/constants/navigation'
import type { GetInfo } from '@/types/api/user'
import { http } from '@/utils/request'
import { getDepartmentTree } from '@/api/common'

// 登录凭据（账号密码）
export interface Credentials { userName: string; password: string; [k: string]: any }
// 精简用户信息（兼容老项目与当前项目 getInfo 返回差异）
export interface UserInfoLite { userId?: string; userName?: string; avatar?: string; roles?: string[]; permissions?: string[]; [k: string]: any }

// 消息记录长度与用户信息等本地键名
const KEY_DOTS = 'dots'
const KEY_USER_INFO = 'setUerInfo'
const KEY_DEPT_TREE = 'departmentTree'
const KEY_HAVE_ORDER = 'haveOrderManagement'
const KEY_HAVE_MANAGEMENT_COPY = 'haveManagementCopy'

const parseBooleanLike = (val: any): boolean => {
	if (val === true || val === 'true') return true
	if (val === false || val === 'false') return false
	if (typeof val === 'number') return val === 1
	if (typeof val === 'string') {
		const lowered = val.trim().toLowerCase()
		if (!lowered) return false
		return lowered === '1' || lowered === 'true' || lowered === 'yes'
	}
	return false
}

const readAuthorityFlag = (key: string): boolean => {
	let stored: any
	try { stored = uni.getStorageSync(key) } catch { stored = undefined }
	const isEmpty = stored === undefined || stored === null || stored === ''
	if (isEmpty && typeof sessionStorage !== 'undefined') {
		try {
			const raw = sessionStorage.getItem(key)
			if (raw !== null && raw !== undefined) stored = raw
		} catch { /* ignore */ }
	}
	return parseBooleanLike(stored)
}

const syncAuthorityFlag = (key: string, value: boolean) => {
	try { uni.setStorageSync(key, value) } catch { /* ignore */ }
	if (typeof sessionStorage !== 'undefined') {
		try { sessionStorage.setItem(key, value ? 'true' : 'false') } catch { /* ignore */ }
	}
}

export const useUserStore = defineStore('user', () => {
	// 原结构保持
	const userInfo = ref<GetInfo.Body | UserInfoLite | null>()
	const token = ref<string>('')
	const refreshToken = ref<string>('')
	const message = ref<number | string | null>('')
	const isLoading = ref(false)
	const departmentTree = ref<any[]>([])
	const departmentTreeLoading = ref(false)
	const routerTree = ref<any[]>([])
	const authorityLoading = ref(false)
	const haveOrderManagement = ref(readAuthorityFlag(KEY_HAVE_ORDER))
	const haveManagementCopy = ref(readAuthorityFlag(KEY_HAVE_MANAGEMENT_COPY))
	try {
		const cachedTree = uni.getStorageSync(KEY_DEPT_TREE)
		if (Array.isArray(cachedTree)) {
			departmentTree.value = cachedTree
		}
	} catch { /* ignore */ }

	const setToken = (val: string) => { token.value = val }
	const setRefreshToken = (val: string) => { refreshToken.value = val }
	const setUserInfo = (val: any) => { userInfo.value = val }
	const setMessage = (val: number | string) => { message.value = val }
	const setDepartmentTree = (val: any[]) => {
		departmentTree.value = Array.isArray(val) ? val : []
	}

	const fetchDepartmentTree = async (query: Record<string, any> = {}) => {
		if (departmentTreeLoading.value) return departmentTree.value
		departmentTreeLoading.value = true
		try {
			const res = await getDepartmentTree(query)
			const unwrap = (payload: any): any[] => {
				if (Array.isArray(payload)) return payload
				if (payload && Array.isArray(payload.data)) return payload.data
				if (payload && Array.isArray(payload.records)) return payload.records
				if (payload && Array.isArray(payload.list)) return payload.list
				return []
			}
			const list = unwrap(res)
			setDepartmentTree(list)
			try { uni.setStorageSync(KEY_DEPT_TREE, list) } catch { /* ignore */ }
			return list
		} finally {
			departmentTreeLoading.value = false
		}
	}

	const fetchAuthority = async () => {
		if (authorityLoading.value) return routerTree.value
		authorityLoading.value = true
		const DEV = !!(import.meta as any)?.env?.DEV
		const unwrap = (payload: any): any[] => {
			if (Array.isArray(payload)) return payload
			if (payload && Array.isArray(payload.data)) return payload.data
			if (payload && Array.isArray(payload.records)) return payload.records
			if (payload && Array.isArray(payload.list)) return payload.list
			if (payload && Array.isArray(payload.routes)) return payload.routes
			if (payload && Array.isArray(payload.routers)) return payload.routers
			return []
		}
	const normalizeKey = (val: any): string => {
		if (val === undefined || val === null) return ''
		const str = String(val).trim()
		if (!str) return ''
		return str
			.replace(/\s+/g, '')
			.replace(/^\/+/, '')
			.replace(/\/+/g, '/')
			.toLowerCase()
	}
	const stripIndexSuffix = (val: string): string => {
		if (!val) return val
		return val.endsWith('/index') ? val.slice(0, -('/index'.length)) : val
	}
	const isTargetRoute = (node: any, target: string): boolean => {
		if (!node) return false
		const candidates = [
			node.name,
			node.path,
				node.routeName,
				node.route,
				node.fullPath,
				node.menuPath,
			node.menuUrl,
			node.url,
		]
		const normalizedTarget = normalizeKey(target)
		const normalizedTargetBase = stripIndexSuffix(normalizedTarget)
		const normalizedCandidates = candidates
			.map((raw) => normalizeKey(raw))
			.filter((val) => !!val)
		const normalizedCandidatesBase = normalizedCandidates.map(stripIndexSuffix)

		if (normalizedCandidates.includes(normalizedTarget)) return true
		if (normalizedCandidatesBase.includes(normalizedTarget)) return true
		if (normalizedTargetBase) {
			if (normalizedCandidates.includes(normalizedTargetBase)) return true
			if (normalizedCandidatesBase.includes(normalizedTargetBase)) return true
		}
		return false
	}
	const findNode = (nodes: any[] | undefined, target: string): any | null => {
		if (!Array.isArray(nodes)) return null
		for (const node of nodes) {
			if (isTargetRoute(node, target)) return node
			}
			return null
		}
		const searchRoute = (nodes: any[] | undefined, target: string): boolean => {
			if (!Array.isArray(nodes)) return false
			for (const node of nodes) {
				if (isTargetRoute(node, target)) return true
				if (Array.isArray(node?.children) && searchRoute(node.children, target)) return true
			}
			return false
		}
		const searchAny = (nodes: any[] | undefined, targets: string[]): boolean =>
			targets.some((key) => searchRoute(nodes, key))

		try {
			const res = await http.get<any>(EP.MENU_ROUTERS)
			const list = unwrap(res)
			routerTree.value = list
			const appNode = Array.isArray(list) ? findNode(list, '/app') : null
			const scope: any[] = Array.isArray(appNode?.children)
				? appNode.children
				: (Array.isArray(list) ? list : [])
			const orderFlag = searchAny(scope, [
				'/workbench',
				'workbench',
				'/eqManagement/orderManagement',
				'/eqManagement/orderManagement/index',
				'eqManagement/orderManagement',
				'orderManagement',
				'/orderManagement',
			])
			const managementCopyFlag = searchAny(scope, [
				'/eqManagementCopy',
				'eqManagementCopy',
				'/eqManagement/eqManagementCopy',
				'/eqManagementCopy/index',
			])

			haveOrderManagement.value = orderFlag
			haveManagementCopy.value = managementCopyFlag
			syncAuthorityFlag(KEY_HAVE_ORDER, orderFlag)
			syncAuthorityFlag(KEY_HAVE_MANAGEMENT_COPY, managementCopyFlag)
			return list
		} catch (err) {
			haveOrderManagement.value = false
			haveManagementCopy.value = false
			routerTree.value = []
			syncAuthorityFlag(KEY_HAVE_ORDER, false)
			syncAuthorityFlag(KEY_HAVE_MANAGEMENT_COPY, false)
			if (DEV) console.warn('[user store] fetchAuthority fail', err)
			return []
		} finally {
			authorityLoading.value = false
		}
	}

	if (token.value) {
		Promise.resolve().then(() => {
			fetchAuthority().catch((err) => {
				const DEV = !!(import.meta as any)?.env?.DEV
				if (DEV) console.warn('[user store] refresh authority on boot fail', err)
			})
		})
	}

	// ===== 登录相关 =====
		/**
		 * 账号密码登录
		 * 说明：
		 * 1. 保留老项目写法（/auth/repairAppLogin）
		 * 2. 若后端改造，可在此统一调整，不影响调用层
		 */
		const loginAction = async (credentials: Credentials) => {
			const DEV = !!import.meta?.env?.DEV
			const envAny: any = (import.meta as any)?.env || {}
			const preferRaw = String(envAny.VITE_LOGIN_PREFER || 'auto').toLowerCase()
			const preferQueue = preferRaw === 'auto'
				? ['json', 'form', 'query']
				: preferRaw.split(',').map((s) => s.trim()).filter((s) => ['json', 'form', 'query'].includes(s as any))
			const mode = (preferQueue.length ? preferQueue : ['json'])[0] || 'json'
			const payload = { userName: credentials.userName, password: credentials.password }
			let raw: any
			try {
				if (mode === 'form') raw = await http.postForm<any>(EP.AUTH_LOGIN, payload, { timeout: 8000 })
				else if (mode === 'query') raw = await http.postQuery<any>(EP.AUTH_LOGIN, payload, { timeout: 8000 })
				else raw = await http.post<any>(EP.AUTH_LOGIN, payload, { timeout: 8000 })
				if (DEV) console.log('[LOGIN attempt]', mode, raw)
			} catch (err: any) {
				if (DEV) console.warn('[LOGIN attempt fail]', mode, err)
				const msg = err?.raw?.msg || err?.raw?.data?.msg || err?.message || '登录失败'
				throw new Error(msg)
			}
			if (!raw) throw new Error('登录失败')
			const dataLayer = raw && (raw.data ? raw.data : raw)
			const tokenExtract = dataLayer?.access_token || dataLayer?.token || dataLayer?.accessToken
			if (!tokenExtract) throw new Error('登录失败：未获取 token')
			setToken(tokenExtract)
			if (dataLayer?.refresh_token) setRefreshToken(dataLayer.refresh_token)
			if (DEV) console.log('[LOGIN SINGLE]', { prefer: preferQueue, token: tokenExtract })
			uni.showToast({ title: '登录成功', icon: 'success' })
			// 先获取用户信息（确保权限就绪，避免 403 竞态）
			try { await fetchUserInfo() } catch (e) { if (DEV) console.warn('[LOGIN fetchUserInfo fail]', e) }
			await fetchAuthority()
			// 后台加载较慢的缓存型数据，避免阻塞进入首页
			Promise.resolve()
				.then(() => fetchDepartmentTree().catch((e) => {
					if (DEV) console.warn('[LOGIN fetchDepartmentTree fail]', e)
					return []
				}))
				.then((list) => {
					if (Array.isArray(list) && list.length) {
						setDepartmentTree(list)
					}
				})
			// 并行获取消息（无需阻塞）
			getMessage().catch(()=>{})
			
			// 导航逻辑精简：优先 pendingPath
			let redirect: string = ''
			if (!IGNORE_PENDING_PATH) {
				try { redirect = uni.getStorageSync('__pendingPath') || '' } catch { redirect = '' }
			}
			if (redirect) {
				try { uni.removeStorageSync('__pendingPath') } catch {}
			}
			const target = redirect || HOME_PAGE
			const isTab = /^\/pages\/(index|my)\//.test(target)
			if (isTab) {
				uni.switchTab({
					url: target,
					fail: () => {
						// 某些平台（或编译期未识别为 tab）失败时兜底 reLaunch
						uni.reLaunch({ url: target })
					}
				})
			} else {
				uni.reLaunch({ url: target })
			}
		}

	// 获取消息数量（示例路径保持老项目逻辑）
		/** 获取消息列表数量（示例使用 sourceList 固定值） */
		const getMessage = async () => {
		try {
			const res = await http.post<any>(EP.USER_MESSAGE_PAGE, { sourceList: [6,7,8,9], beRead: 0 })
			const length = res?.data?.records?.length ?? 0
			
			console.log("[user store] getMessage length", length);
			
			setMessage(length)
			try { uni.setStorageSync(KEY_DOTS, length) } catch { /* ignore */ }
		} catch (e) { /* 静默失败 */ }
	}

	// 拉取用户信息
		/** 拉取用户信息 */
			const fetchUserInfo = async () => {
		if (isLoading.value) return
		isLoading.value = true
		try {
			const res = await http.post<any>(EP.USER_INFO)
			const body = res?.data || res
			setUserInfo(body)
					// 尝试解析角色/权限
					try {
						const roles = Array.isArray(body?.roles) ? body.roles : (body?.roleList || [])
						const perms = Array.isArray(body?.permissions) ? body.permissions : (body?.permissionList || [])
						// 若有旧结构 user_roles 兼容
						if (!roles.length && Array.isArray(body?.user_roles)) {
							roles.push(...body.user_roles)
						}
						// 强制数组化
						;(userInfo.value as any).roles = roles
						;(userInfo.value as any).permissions = perms
					} catch {/* ignore parse */}
			try { uni.setStorageSync(KEY_USER_INFO, body) } catch { /* ignore */ }
		} finally { isLoading.value = false }
	}

	// 退出登录（保持原逻辑 + 清理 token）
	/** 清除本地会话并跳转登录页 */
	const logout = () => {
		setUserInfo(null)
		setToken('')
		setRefreshToken('')
		setDepartmentTree([])
		routerTree.value = []
		haveOrderManagement.value = false
		haveManagementCopy.value = false
		if (typeof sessionStorage !== 'undefined') {
			try { sessionStorage.removeItem(KEY_HAVE_ORDER) } catch { /* ignore */ }
			try { sessionStorage.removeItem(KEY_HAVE_MANAGEMENT_COPY) } catch { /* ignore */ }
		}
		const rawFetch = (key: string) => {
			let val: any;
			try { val = uni.getStorageSync(key) } catch {}
			if ((val === undefined || val === null || val === "") && typeof plus !== 'undefined' && plus?.storage) {
				try { val = plus.storage.getItem(key) } catch {}
			}
			return val;
		};
		const rawSet = (key: string, value: any) => {
			if (value === undefined || value === null) return;
			try { uni.setStorageSync(key, value) } catch {}
			if (typeof plus !== 'undefined' && plus?.storage) {
				try { plus.storage.setItem(key, String(value)) } catch {}
			}
		};
		const requestUrl = rawFetch('requestUrl') || ''
		const rememberFlag = rawFetch('rememberMe')
		const rememberedPassword = rawFetch('password')
		const lastUserName = rawFetch('lastUserName')
		const rememberPayload = rawFetch('login:remember')
		const rememberEnabled = rememberFlag === '1' || (rememberPayload && (() => {
			try {
				const parsed = typeof rememberPayload === 'string' ? JSON.parse(rememberPayload) : rememberPayload
				return parsed?.remember === '1'
			} catch {
				return false
			}
		})());
		uni.clearStorageSync()
		if (requestUrl) rawSet('requestUrl', requestUrl)
		if (rememberEnabled) {
			if (rememberFlag !== undefined && rememberFlag !== null)
				rawSet('rememberMe', rememberFlag)
			if (rememberedPassword !== undefined && rememberedPassword !== null)
				rawSet('password', rememberedPassword)
			if (lastUserName !== undefined && lastUserName !== null)
				rawSet('lastUserName', lastUserName)
			if (rememberPayload !== undefined && rememberPayload !== null)
				rawSet('login:remember', rememberPayload)
		}
		try { uni.removeStorageSync(KEY_DEPT_TREE) } catch { /* ignore */ }
		uni.reLaunch({ url: loginPage })
	}
	const logoutAction = async () => { logout() }

	return {
		userInfo,
		token,
		refreshToken,
		message,
		isLoading,
		departmentTree,
		departmentTreeLoading,
		routerTree,
		authorityLoading,
		haveOrderManagement,
		haveManagementCopy,
		setToken,
		setRefreshToken,
		setUserInfo,
		setMessage,
		setDepartmentTree,
		loginAction,
		logout,
		logoutAction,
		getMessage,
		fetchUserInfo,
		fetchDepartmentTree,
		fetchAuthority
	}
}, { unistorage: true })
