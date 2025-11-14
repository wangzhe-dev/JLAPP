/**
 * 统一的URL处理工具库
 *
 * 替代项目中3个不同的buildUrl实现
 * 提供类型安全的URL构建和解析功能
 *
 * @module utils/url
 */

/**
 * 构建查询字符串
 *
 * @param params - 参数对象
 * @param options - 构建选项
 * @returns 查询字符串（不含?前缀）
 *
 * @example
 * buildQueryString({name:'张三',age:20}) // "name=张三&age=20"
 * buildQueryString({name:'',age:null}, {skipEmpty:true}) // ""
 * buildQueryString({arr:[1,2]}) // "arr=1&arr=2"
 */
export function buildQueryString(
	params: Record<string, any>,
	options?: {
		/** 是否跳过空值（null、undefined、空字符串） */
		skipEmpty?: boolean;
		/** 是否对值进行 encodeURIComponent */
		encode?: boolean;
		/** 数组参数的处理方式：'repeat'重复键名 | 'comma'逗号分隔 */
		arrayFormat?: 'repeat' | 'comma';
	}
): string {
	const {
		skipEmpty = false,
		encode = true,
		arrayFormat = 'repeat',
	} = options || {};

	if (!params || typeof params !== 'object') return '';

	const pairs: string[] = [];

	Object.keys(params).forEach((key) => {
		const value = params[key];

		// 跳过空值
		if (skipEmpty && (value === null || value === undefined || value === '')) {
			return;
		}

		// 处理数组
		if (Array.isArray(value)) {
			if (arrayFormat === 'comma') {
				const joinedValue = value.join(',');
				const encodedValue = encode
					? encodeURIComponent(joinedValue)
					: joinedValue;
				pairs.push(`${key}=${encodedValue}`);
			} else {
				// repeat - 重复键名
				value.forEach((item) => {
					const encodedValue = encode ? encodeURIComponent(item) : item;
					pairs.push(`${key}=${encodedValue}`);
				});
			}
			return;
		}

		// 处理普通值
		const strValue = String(value);
		const encodedValue = encode ? encodeURIComponent(strValue) : strValue;
		pairs.push(`${key}=${encodedValue}`);
	});

	return pairs.join('&');
}

/**
 * 解析查询字符串
 *
 * @param queryString - 查询字符串（可含?前缀）
 * @returns 参数对象
 *
 * @example
 * parseQueryString('?name=张三&age=20') // {name:'张三',age:'20'}
 * parseQueryString('name=张三&age=20') // {name:'张三',age:'20'}
 * parseQueryString('arr=1&arr=2') // {arr:['1','2']}
 */
export function parseQueryString(queryString: string): Record<string, any> {
	const str = String(queryString || '').replace(/^\?/, '');
	if (!str) return {};

	const params: Record<string, any> = {};

	str.split('&').forEach((pair) => {
		const [key, value] = pair.split('=');
		if (!key) return;

		const decodedKey = decodeURIComponent(key);
		const decodedValue = value ? decodeURIComponent(value) : '';

		// 如果键已存在，转换为数组
		if (params[decodedKey] !== undefined) {
			if (Array.isArray(params[decodedKey])) {
				params[decodedKey].push(decodedValue);
			} else {
				params[decodedKey] = [params[decodedKey], decodedValue];
			}
		} else {
			params[decodedKey] = decodedValue;
		}
	});

	return params;
}

/**
 * 构建完整URL（路径 + 查询参数）
 *
 * @param url - 基础URL
 * @param params - 查询参数
 * @param options - 构建选项
 * @returns 完整URL
 *
 * @example
 * buildUrl('/api/users', {page:1,size:10})
 * // "/api/users?page=1&size=10"
 *
 * buildUrl('/api/users?status=active', {page:1})
 * // "/api/users?status=active&page=1"
 */
export function buildUrl(
	url: string,
	params?: Record<string, any>,
	options?: Parameters<typeof buildQueryString>[1]
): string {
	const baseUrl = String(url || '');
	if (!params || Object.keys(params).length === 0) {
		return baseUrl;
	}

	const queryString = buildQueryString(params, options);
	if (!queryString) return baseUrl;

	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}${queryString}`;
}

/**
 * 解析完整URL
 *
 * @param url - 完整URL
 * @returns URL组成部分
 *
 * @example
 * parseUrl('http://a.com/path?name=张三#hash')
 * // {
 * //   protocol: 'http:',
 * //   host: 'a.com',
 * //   pathname: '/path',
 * //   search: '?name=张三',
 * //   hash: '#hash',
 * //   query: {name:'张三'}
 * // }
 */
export function parseUrl(url: string): {
	protocol: string;
	host: string;
	pathname: string;
	search: string;
	hash: string;
	query: Record<string, any>;
} {
	const str = String(url || '');

	// 简单的URL解析（不依赖浏览器URL API）
	const protocolMatch = str.match(/^([a-z]+:)?\/\//i);
	const protocol = protocolMatch ? protocolMatch[1] || '' : '';

	let remaining = protocol ? str.slice(protocol.length + 2) : str;

	const hashIndex = remaining.indexOf('#');
	const hash = hashIndex >= 0 ? remaining.slice(hashIndex) : '';
	remaining = hashIndex >= 0 ? remaining.slice(0, hashIndex) : remaining;

	const searchIndex = remaining.indexOf('?');
	const search = searchIndex >= 0 ? remaining.slice(searchIndex) : '';
	remaining = searchIndex >= 0 ? remaining.slice(0, searchIndex) : remaining;

	const pathIndex = remaining.indexOf('/');
	const host = pathIndex >= 0 ? remaining.slice(0, pathIndex) : remaining;
	const pathname = pathIndex >= 0 ? remaining.slice(pathIndex) : '/';

	const query = parseQueryString(search);

	return {
		protocol,
		host,
		pathname,
		search,
		hash,
		query,
	};
}

/**
 * 添加或更新URL参数
 *
 * @param url - 原URL
 * @param params - 要添加/更新的参数
 * @returns 新URL
 *
 * @example
 * addQueryParams('/api?page=1', {size:10})
 * // "/api?page=1&size=10"
 *
 * addQueryParams('/api?page=1', {page:2})
 * // "/api?page=2"
 */
export function addQueryParams(
	url: string,
	params: Record<string, any>
): string {
	const parsed = parseUrl(url);
	const mergedQuery = { ...parsed.query, ...params };

	const baseUrl = parsed.pathname;
	const queryString = buildQueryString(mergedQuery);

	let result = baseUrl;
	if (queryString) result += `?${queryString}`;
	if (parsed.hash) result += parsed.hash;

	return result;
}

/**
 * 移除URL参数
 *
 * @param url - 原URL
 * @param keys - 要移除的参数键名数组
 * @returns 新URL
 *
 * @example
 * removeQueryParams('/api?page=1&size=10', ['size'])
 * // "/api?page=1"
 */
export function removeQueryParams(url: string, keys: string[]): string {
	const parsed = parseUrl(url);
	const filteredQuery = { ...parsed.query };

	keys.forEach((key) => {
		delete filteredQuery[key];
	});

	const baseUrl = parsed.pathname;
	const queryString = buildQueryString(filteredQuery);

	let result = baseUrl;
	if (queryString) result += `?${queryString}`;
	if (parsed.hash) result += parsed.hash;

	return result;
}

/**
 * 判断URL是否为绝对路径
 *
 * @param url - URL字符串
 * @returns 是否为绝对路径
 *
 * @example
 * isAbsoluteUrl('http://a.com') // true
 * isAbsoluteUrl('https://a.com') // true
 * isAbsoluteUrl('//a.com') // true
 * isAbsoluteUrl('/path') // false
 */
export function isAbsoluteUrl(url: string): boolean {
	return /^([a-z]+:)?\/\//i.test(String(url || ''));
}

/**
 * 拼接URL路径（自动处理斜杠）
 *
 * @param parts - 路径片段
 * @returns 拼接后的路径
 *
 * @example
 * joinPath('/api', 'users', '123') // "/api/users/123"
 * joinPath('/api/', '/users/', '/123/') // "/api/users/123"
 */
export function joinPath(...parts: string[]): string {
	if (!parts || parts.length === 0) return '';

	return parts
		.map((part, index) => {
			let str = String(part || '');

			// 移除开头的斜杠（除了第一个片段）
			if (index > 0) {
				str = str.replace(/^\/+/, '');
			}

			// 移除结尾的斜杠（除了最后一个片段）
			if (index < parts.length - 1) {
				str = str.replace(/\/+$/, '');
			}

			return str;
		})
		.filter(Boolean)
		.join('/');
}

/**
 * 获取文件名（从URL或路径中）
 *
 * @param url - URL或路径
 * @param withExtension - 是否包含扩展名，默认true
 * @returns 文件名
 *
 * @example
 * getFilename('/path/to/file.jpg') // "file.jpg"
 * getFilename('/path/to/file.jpg', false) // "file"
 * getFilename('http://a.com/file.jpg?v=1') // "file.jpg"
 */
export function getFilename(url: string, withExtension = true): string {
	const str = String(url || '');

	// 移除查询参数和hash
	const cleanUrl = str.split('?')[0].split('#')[0];

	// 提取文件名
	const parts = cleanUrl.split('/');
	const filename = parts[parts.length - 1] || '';

	if (!withExtension) {
		return filename.replace(/\.[^.]*$/, '');
	}

	return filename;
}

/**
 * 获取文件扩展名
 *
 * @param url - URL或文件名
 * @returns 扩展名（不含点号）
 *
 * @example
 * getFileExtension('file.jpg') // "jpg"
 * getFileExtension('file.tar.gz') // "gz"
 * getFileExtension('file') // ""
 */
export function getFileExtension(url: string): string {
	const filename = getFilename(url);
	const match = filename.match(/\.([^.]+)$/);
	return match ? match[1] : '';
}
