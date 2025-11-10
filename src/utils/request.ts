// ======= 基于 uni.request 的轻量封装（官方 API 兼容，避免 App 打包额外依赖问题） =======
import { requestUrl, loginPage, apiPrefix } from "@/config";
import { EP } from "@/api/endpoints";
import { isDevRuntime } from "@/utils/env";
import { useUserStore } from "@/stores";
import { showModalAsync } from "@/utils/modal";

// ============ 全局放开 / 调试开关 ============
// 使用方式：在本地 .env 或命令行注入：VITE_RELAX_ALL=1  (等价同时开启所有宽松模式)
// 细粒度：VITE_HTTP_RELAX=1 (放宽 code 判定)  VITE_HTTP_SKIP_AUTH=1 (不附加 token)  VITE_HTTP_DEBUG=1 (强制日志)
// 注意：严禁在生产构建开启；构建流水线可通过未配置这些变量确保安全。
// -------------------------------------------------------------------------
// 说明：为了避免 TS 类型对 import.meta.env 裸访问报错，这里使用 (import.meta as any)
// -------------------------------------------------------------------------
const RELAX_ALL = (import.meta as any).env?.VITE_RELAX_ALL === '1'
const RELAX_HTTP = RELAX_ALL || (import.meta as any).env?.VITE_HTTP_RELAX === '1'
const SKIP_AUTH = RELAX_ALL || (import.meta as any).env?.VITE_HTTP_SKIP_AUTH === '1'
const DEBUG_HTTP = RELAX_ALL || (import.meta as any).env?.VITE_HTTP_DEBUG === '1'

// 白名单（无需 token）
const whiteList = ["/auth/wxlogin", EP.AUTH_REFRESH, EP.AUTH_LOGIN];

// ============ 刷新 Token 机制 ============
let isRefreshing = false;
type PendingTask = {
	resolve: (val: any) => void;
	reject: (err: any) => void;
	options: RequestOptions;
};
const pendingQueue: PendingTask[] = [];

async function refreshTokenFlow(): Promise<string> {
	const store = useUserStore();
	if (!store.refreshToken) throw new Error("缺少 refresh_token 无法刷新");
	// 这里假设刷新接口返回 { access_token, refresh_token? }
	const data: any = await new Promise((resolve, reject) => {
		uni.request({
			url: buildBaseURL() + EP.AUTH_REFRESH,
			method: "POST",
			data: { refreshToken: store.refreshToken },
			header: { "Content-Type": "application/json;charset=UTF-8" },
			success: (res) => {
				if (res.statusCode !== 200) return reject(new Error("刷新失败"));
				const body: any = res.data || {};
				if (body.code !== 200) return reject(new Error(body.msg || "刷新失败"));
				resolve(body.data);
			},
			fail: reject,
		});
	});
	if (!data || !data.access_token)
		throw new Error("刷新失败：缺少新 access_token");
	store.setToken(data.access_token);
	if (data.refresh_token) store.setRefreshToken(data.refresh_token);
	return data.access_token;
}

function enqueuePending(
	options: RequestOptions,
	resolve: (v: any) => void,
	reject: (e: any) => void,
) {
	pendingQueue.push({ options, resolve, reject });
}

function flushQueue(err: any, token?: string) {
	while (pendingQueue.length) {
		const task = pendingQueue.shift()!;
		if (err) task.reject(err);
		else {
			// 重新发起请求，自动带上最新 token
			request(task.options).then(task.resolve).catch(task.reject);
		}
	}
}

// 防重复提交缓存（仅保留最近一次写请求）
interface LastWriteRecord {
	url: string;
	body: string;
	time: number;
}
const LAST_WRITE_KEY = "last_write_request";
const REPEAT_INTERVAL = 1000; // ms 可按需 .env 配置

// 标准响应 envelope 类型
export interface ApiEnvelope<T = any> {
	code: number;
	msg?: string;
	data?: T;
}

class ApiError extends Error {
	code: number;
	raw: any;
	constructor(code: number, msg: string, raw: any) {
		super(msg);
		this.name = "ApiError";
		this.code = code;
		this.raw = raw;
	}
}
class AuthError extends ApiError {
	constructor(code: number, msg: string, raw: any) {
		super(code, msg, raw);
		this.name = "AuthError";
	}
}
class RepeatSubmitError extends Error {
	constructor(message = "数据正在处理，请勿重复提交") {
		super(message);
		this.name = "RepeatSubmitError";
	}
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
	url: string;
	method?: HttpMethod;
	data?: any;
	header?: Record<string, any>;
	timeout?: number;
	// 是否静默失败（不 toast），供某些轮询 / 心跳使用
	silent?: boolean;
	// 兼容老项目：附加到 URL 的 query 参数（与 data 分离）
	query?: Record<string, any>;
	// 跳过重复请求拦截（例如列表查询类 POST 接口）
	skipRepeatCheck?: boolean;
}

function buildBaseURL(): string {
	// #ifdef H5
	const base = `/${apiPrefix}`;
	if (DEBUG_HTTP || (import.meta as any)?.env?.VITE_HTTP_DEBUG === '1') {
		try { console.log('[HTTP baseURL:H5]', { base, apiPrefix }) } catch {}
	}
	return base;
	// #endif
	// #ifndef H5
	if (DEBUG_HTTP || (import.meta as any)?.env?.VITE_HTTP_DEBUG === '1') {
		try { console.log('[HTTP baseURL:APP]', { requestUrl }) } catch {}
	}
	return requestUrl;
	// #endif
}

function isWrite(method?: string) {
	return ["POST", "PUT", "DELETE"].includes((method || "GET").toUpperCase());
}

function antiRepeat(options: RequestOptions) {
	if (!isWrite(options.method)) return;
	const record: LastWriteRecord = {
		url: options.url,
		body:
			typeof options.data === "object"
				? JSON.stringify(options.data)
				: String(options.data ?? ""),
		time: Date.now(),
	};
	const stored: LastWriteRecord | null =
		uni.getStorageSync(LAST_WRITE_KEY) || null;
	if (
		stored &&
		stored.url === record.url &&
		stored.body === record.body &&
		record.time - stored.time < REPEAT_INTERVAL
	) {
		throw new RepeatSubmitError();
	}
	uni.setStorageSync(LAST_WRITE_KEY, record);
}

function attachAuthHeader(header: Record<string, any>, url: string) {
	if (SKIP_AUTH) return header; // 放开 token 校验
	if (whiteList.some((w) => w === url)) return header;
	const token = useUserStore().token;
	if (token) header.Authorization = `Bearer ${token}`;
	return header;
}

function logDev(tag: string, info: any) {
	if (isDevRuntime() || DEBUG_HTTP) console.log(`[HTTP:${tag}]`, info);
}

async function handleAuth(code: number, msg: string): Promise<never> {
	const content401 = "由于您长时间未登录平台，为保障账号安全，请您重新登录";
	const content40101 =
		"您的账号已在其他设备登录，您被强制下线。如果这不是您的操作，请及时修改密码";
	const tip = code === 401 ? content401 : content40101;
	try {
		await showModalAsync({
			title: code === 401 ? "平台安全提醒" : "账号登录提示",
			content: tip,
			confirmText: "重新登录",
			showCancel: false,
			lockKey: "auth-relogin",
		});
	} catch (err) {
		if (DEBUG_HTTP) console.warn("[HTTP] auth modal fail", err);
	}
	useUserStore().logout();
	uni.navigateTo({ url: loginPage });
	throw new AuthError(code, msg || tip, { code });
}

function request<T = any>(options: RequestOptions): Promise<T> {
	const baseURL = buildBaseURL();
	const method: HttpMethod = (
		options.method || "GET"
	).toUpperCase() as HttpMethod;
	// 兼容 query 拼接
	let finalUrl = options.url;
	if (options.query && Object.keys(options.query).length) {
		finalUrl = buildQuery(finalUrl, options.query);
	}
	// 针对 login 等可能仅使用 query 的 POST ，若无 data 且是 POST 可省略 JSON 头，减少预检 / 某些网关拦截
	const baseHeader: Record<string, any> =
		method === "POST" && !options.data
			? {}
			: { "Content-Type": "application/json;charset=UTF-8" };
	const header: Record<string, any> = attachAuthHeader(
		{ ...baseHeader, ...(options.header || {}) },
		options.url,
	);

	const shouldCheckRepeat =
		!RELAX_HTTP && options.skipRepeatCheck !== true;
	try {
		if (shouldCheckRepeat) {
			antiRepeat({ ...options, method });
		}
	} catch (e) {
		return Promise.reject(e);
	}

	return new Promise<T>((resolve, reject) => {
		uni.request({
			url: baseURL + finalUrl,
			method,
			data: options.data,
			header,
			timeout: options.timeout || 20000,
			success: (res: UniApp.RequestSuccessCallbackResult) => {
				logDev("RESP", {
					url: options.url,
					status: res.statusCode,
					data: res.data,
				});
				// HTTP 层错误
				if (res.statusCode !== 200 || !res.data) {
					if (RELAX_HTTP && res.data) {
						// 宽松模式：直接放行返回体（可能不是标准 envelope）
						logDev('RELAX_HTTP', { url: options.url, status: res.statusCode });
						return resolve(res.data as any as T);
					}
					const rawMsg =
						(res.data as any)?.msg || (res.data as any)?.error || "系统错误";
					if (!options.silent) uni.showToast({ title: rawMsg, icon: "none" });
					return reject(new ApiError(res.statusCode, rawMsg, res));
				}
				const body = res.data as ApiEnvelope<T>;
				const code = body.code;
				// 兼容部分后端使用 code=0 表示成功
				if (code === 200 || code === 0) {
					const payload = (body as any).data;
					return resolve((payload === undefined ? (body as any) : payload) as T);
				}
				// 若无 code 字段：尝试直接判断是否是纯数据结构（例如直接返回 token）
				if (code === undefined) {
					const maybe: any = body as any;
					if (
						maybe &&
						(maybe.access_token ||
							maybe.token ||
							maybe.data?.access_token ||
							maybe.data?.token)
					) {
						return resolve((maybe.data ? maybe.data : maybe) as T);
					}
				}
				if (!RELAX_HTTP && (code === 401 || code === 40101)) {
					// 若是刷新接口自身失败或登录接口失败，直接走原有 handleAuth
					if (
						options.url === EP.AUTH_REFRESH ||
						options.url === EP.AUTH_LOGIN
					) {
						handleAuth(code, body.msg || "")
							.then(() => {
								/* unreachable */
							})
							.catch(reject);
						return;
					}
					const store = useUserStore();
					if (!store.refreshToken) {
						// 无刷新 token 直接重新登录
						handleAuth(code, body.msg || "")
							.then(() => {})
							.catch(reject);
						return;
					}
					// 有刷新 token：队列 + 刷新
					enqueuePending(options, resolve, reject);
					if (!isRefreshing) {
						isRefreshing = true;
						refreshTokenFlow()
							.then(() => {
								flushQueue(null, store.token);
							})
							.catch((err) => {
								flushQueue(err);
							})
							.finally(() => {
								isRefreshing = false;
							});
					}
					return;
				}
				if (RELAX_HTTP) {
					logDev('RELAX_HTTP_CODE', { url: options.url, code, body });
					// 宽松模式：无论 code，直接返回 data / body
					return resolve((body as any).data ?? (body as any));
				}
				const msg = body.msg || "系统错误";
				if (!options.silent) uni.showToast({ title: msg, icon: "none" });
				reject(new ApiError(code, msg, body));
			},
			fail: (err: UniApp.GeneralCallbackResult) => {
				if (RELAX_HTTP) {
					logDev('FAIL_RELAX', { url: options.url, err });
					// 放开模式：仍尝试返回一个错误对象（不抛异常，方便页面继续流程）
					return resolve((err as any) as T);
				}
				if (!options.silent)
					uni.showToast({ title: err.errMsg || "网络异常", icon: "none" });
				reject(err);
			},
		});
	});
}

export const http = {
	get<T>(
		url: string,
		params?: Record<string, any>,
		config?: Omit<RequestOptions, "url" | "method" | "data">,
	) {
		return request<T>({
			url: buildQuery(url, params),
			method: "GET",
			...(config || {}),
		});
	},
	post<T>(
		url: string,
		data?: any,
		config?: Omit<RequestOptions, "url" | "method" | "data">,
	) {
		return request<T>({ url, method: "POST", data, ...(config || {}) });
	},
	// application/x-www-form-urlencoded 提交
	postForm<T>(
		url: string,
		data?: Record<string, any>,
		config?: Omit<RequestOptions, "url" | "method" | "data">,
	) {
		const formBody = data
			? Object.keys(data)
					.filter((k) => data[k] !== undefined && data[k] !== null)
					.map(
						(k) =>
							encodeURIComponent(k) + "=" + encodeURIComponent(String(data[k])),
					)
					.join("&")
			: "";
		return request<T>({
			url,
			method: "POST",
			data: formBody,
			header: {
				"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
			},
			...(config || {}),
		});
	},
	put<T>(
		url: string,
		data?: any,
		config?: Omit<RequestOptions, "url" | "method" | "data">,
	) {
		return request<T>({ url, method: "PUT", data, ...(config || {}) });
	},
	delete<T>(
		url: string,
		data?: any,
		config?: Omit<RequestOptions, "url" | "method" | "data">,
	) {
		return request<T>({ url, method: "DELETE", data, ...(config || {}) });
	},
	// 兼容老项目：POST 且参数以 query 形式拼接
	postQuery<T>(
		url: string,
		params?: Record<string, any>,
		config?: (Omit<RequestOptions, "url" | "method" | "data" | "query"> & { extraData?: any })
	) {
		const { extraData, ...rest } = config || {};
		return request<T>({
			url,
			method: "POST",
			query: params,
			data: extraData,
			...rest,
		});
	},
	// 兼容老项目：POST + tansParams（深度序列化后拼接 query）
	postParams<T>(
		url: string,
		params?: any,
		config?: Omit<RequestOptions, "url" | "method" | "data" | "query">,
	) { 
		const queryStr = params ? tansParams(params) : "";
		const finalUrl =
			queryStr.length > 0
				? url + (url.includes("?") ? "&" : "?") + queryStr.replace(/&$/, "")
				: url;

		return request<T>({
			url: finalUrl,
			method: "POST",
			...(config || {}),
		});
	},
};

function buildQuery(url: string, params?: Record<string, any>) {
	if (!params || Object.keys(params).length === 0) return url;
	const esc = encodeURIComponent;
	const query = Object.keys(params)
		.filter((k) => params[k] !== undefined && params[k] !== null)
		.map((k) => `${esc(k)}=${esc(String(params[k]))}`)
		.join("&");
	return url + (url.includes("?") ? "&" : "?") + query;
}

function tansParams(params: Record<string, any> = {}): string {
  let result = "";
  Object.keys(params).forEach((propName) => {
    const value = params[propName];
    if (value === null || value === "" || typeof value === "undefined") return;
    const part = encodeURIComponent(propName) + "=";
    if (typeof value === "object" && !(value instanceof Date)) {
      Object.keys(value).forEach((key) => {
        const val = value[key];
        if (val === null || val === "" || typeof val === "undefined") return;
        const paramKey = `${propName}[${key}]`;
        result +=
          encodeURIComponent(paramKey) +
          "=" +
          encodeURIComponent(formatLegacyVal(val)) +
          "&";
      });
    } else {
      result += part + encodeURIComponent(formatLegacyVal(value)) + "&";
    }
  });
  return result;
}

function formatLegacyVal(v: any) {
	if (v instanceof Date) return v.getTime();
	return v;
}

// ======= End 官方 API 封装 =======
export default http;
