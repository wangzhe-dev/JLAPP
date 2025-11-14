/**
 * 统一的API响应处理工具库
 *
 * 替代项目中2个extractPage实现
 * 提供标准化的响应数据提取和错误处理
 *
 * @module utils/response
 */

/**
 * 分页数据提取（统一处理不同后端返回格式）
 *
 * 支持的响应格式：
 * - { records: [], total: 100 }
 * - { rows: [], total: 100 }
 * - { list: [], total: 100 }
 * - { data: { records: [], total: 100 } }
 *
 * @param response - API响应数据
 * @returns 标准化的分页数据
 *
 * @example
 * extractPage({records:[{id:1}],total:100})
 * // {list:[{id:1}],total:100,hasMore:false}
 *
 * extractPage({data:{rows:[{id:1}],count:100}})
 * // {list:[{id:1}],total:100,hasMore:false}
 */
export function extractPage<T = any>(response: any): {
	list: T[];
	total: number;
	hasMore: boolean;
} {
	if (!response || typeof response !== 'object') {
		return { list: [], total: 0, hasMore: false };
	}

	// 尝试从多个可能的位置提取数据
	const data = response.data && typeof response.data === 'object'
		? response.data
		: response;

	// 提取列表数据（支持多种字段名）
	const list = Array.isArray(data.records)
		? data.records
		: Array.isArray(data.rows)
		? data.rows
		: Array.isArray(data.list)
		? data.list
		: Array.isArray(data.data)
		? data.data
		: [];

	// 提取总数（支持多种字段名）
	const total =
		data.total !== undefined
			? Number(data.total)
			: data.count !== undefined
			? Number(data.count)
			: data.totalCount !== undefined
			? Number(data.totalCount)
			: list.length;

	// 计算是否有更多数据
	const pageSize = data.pageSize || data.size || 10;
	const currentPage = data.pageNum || data.page || data.current || 1;
	const hasMore = total > currentPage * pageSize;

	return {
		list,
		total: Number.isFinite(total) ? total : list.length,
		hasMore,
	};
}

/**
 * 提取响应数据（处理嵌套的data字段）
 *
 * @param response - API响应
 * @param defaultValue - 默认值
 * @returns 提取的数据
 *
 * @example
 * unwrapData({data:{id:1}}) // {id:1}
 * unwrapData({id:1}) // {id:1}
 * unwrapData(null, {}) // {}
 */
export function unwrapData<T = any>(response: any, defaultValue?: T): T {
	if (!response) return defaultValue as T;

	// 如果response.data存在且不为null/undefined，返回data
	if (response.data !== null && response.data !== undefined) {
		return response.data;
	}

	// 否则返回response本身
	return response;
}

/**
 * 提取列表数据（处理多种列表字段名）
 *
 * @param response - API响应
 * @returns 列表数组
 *
 * @example
 * unwrapList({records:[1,2,3]}) // [1,2,3]
 * unwrapList({list:[1,2,3]}) // [1,2,3]
 * unwrapList({data:{rows:[1,2,3]}}) // [1,2,3]
 */
export function unwrapList<T = any>(response: any): T[] {
	if (!response || typeof response !== 'object') return [];

	const data = unwrapData(response);

	return Array.isArray(data.records)
		? data.records
		: Array.isArray(data.rows)
		? data.rows
		: Array.isArray(data.list)
		? data.list
		: Array.isArray(data.data)
		? data.data
		: Array.isArray(data)
		? data
		: [];
}

/**
 * 判断响应是否成功
 *
 * @param response - API响应
 * @returns 是否成功
 *
 * @example
 * isSuccess({code:200,data:{}}) // true
 * isSuccess({code:0,data:{}}) // true
 * isSuccess({success:true,data:{}}) // true
 * isSuccess({code:500,msg:'error'}) // false
 */
export function isSuccess(response: any): boolean {
	if (!response || typeof response !== 'object') return false;

	// 检查 success 字段
	if (response.success === true) return true;
	if (response.success === false) return false;

	// 检查 code 字段（200 或 0 表示成功）
	const code = Number(response.code);
	if (code === 200 || code === 0) return true;

	// 检查 status 字段
	const status = Number(response.status);
	if (status === 200 || status === 0) return true;

	// 默认认为成功（如果没有明确的失败标识）
	return !response.error && !response.msg && !response.message;
}

/**
 * 提取错误信息
 *
 * @param error - 错误对象或响应
 * @param defaultMessage - 默认错误消息
 * @returns 错误消息
 *
 * @example
 * getErrorMessage({msg:'操作失败'}) // "操作失败"
 * getErrorMessage({message:'error'}) // "error"
 * getErrorMessage(new Error('err')) // "err"
 * getErrorMessage(null, '未知错误') // "未知错误"
 */
export function getErrorMessage(error: any, defaultMessage = '操作失败'): string {
	if (!error) return defaultMessage;

	// 字符串错误
	if (typeof error === 'string') return error;

	// 标准Error对象
	if (error instanceof Error) return error.message || defaultMessage;

	// 响应对象中的错误信息（支持多种字段名）
	if (typeof error === 'object') {
		return (
			error.msg ||
			error.message ||
			error.error ||
			error.errMsg ||
			error.errorMsg ||
			defaultMessage
		);
	}

	return defaultMessage;
}

/**
 * 标准化API响应（转换为统一格式）
 *
 * @param response - 原始响应
 * @returns 标准化响应
 *
 * @example
 * normalizeResponse({records:[],total:0})
 * // {success:true,code:200,data:{records:[],total:0},msg:''}
 */
export function normalizeResponse<T = any>(response: any): {
	success: boolean;
	code: number;
	data: T | null;
	msg: string;
} {
	const success = isSuccess(response);
	const code = Number(response?.code) || (success ? 200 : 500);
	const data = unwrapData(response, null);
	const msg = success ? '' : getErrorMessage(response, '');

	return {
		success,
		code,
		data,
		msg,
	};
}

/**
 * 创建分页参数对象
 *
 * @param page - 页码（从1开始）
 * @param pageSize - 每页数量
 * @param extraParams - 额外参数
 * @returns 分页参数对象
 *
 * @example
 * createPageParams(1, 10, {status:'active'})
 * // {pageNum:1,pageSize:10,status:'active'}
 */
export function createPageParams(
	page: number,
	pageSize: number,
	extraParams?: Record<string, any>
): Record<string, any> {
	return {
		pageNum: page,
		pageSize: pageSize,
		...extraParams,
	};
}

/**
 * 格式化分页信息文本
 *
 * @param current - 当前页码
 * @param pageSize - 每页数量
 * @param total - 总数
 * @returns 分页信息文本
 *
 * @example
 * formatPageInfo(1, 10, 100) // "第1-10条，共100条"
 * formatPageInfo(2, 10, 15) // "第11-15条，共15条"
 */
export function formatPageInfo(
	current: number,
	pageSize: number,
	total: number
): string {
	if (total === 0) return '共0条';

	const start = (current - 1) * pageSize + 1;
	const end = Math.min(current * pageSize, total);

	return `第${start}-${end}条，共${total}条`;
}

/**
 * 计算总页数
 *
 * @param total - 总数
 * @param pageSize - 每页数量
 * @returns 总页数
 *
 * @example
 * getTotalPages(100, 10) // 10
 * getTotalPages(95, 10) // 10
 * getTotalPages(0, 10) // 0
 */
export function getTotalPages(total: number, pageSize: number): number {
	if (total <= 0 || pageSize <= 0) return 0;
	return Math.ceil(total / pageSize);
}

/**
 * 判断是否有下一页
 *
 * @param current - 当前页码
 * @param total - 总数
 * @param pageSize - 每页数量
 * @returns 是否有下一页
 */
export function hasNextPage(
	current: number,
	total: number,
	pageSize: number
): boolean {
	return current * pageSize < total;
}

/**
 * 判断是否有上一页
 *
 * @param current - 当前页码
 * @returns 是否有上一页
 */
export function hasPrevPage(current: number): boolean {
	return current > 1;
}
