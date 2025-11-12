/**
 * 请求缓存工具
 * 减少重复 API 请求，提升性能
 */

export interface CacheOptions {
	/** 缓存时长（毫秒），默认 5 分钟 */
	ttl?: number;
	/** 是否持久化到 storage（默认仅内存） */
	persist?: boolean;
	/** 缓存 key 前缀 */
	prefix?: string;
}

interface CacheEntry<T = any> {
	data: T;
	timestamp: number;
	ttl: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟
const STORAGE_PREFIX = 'req_cache_';

/**
 * 获取缓存
 */
export function getCache<T = any>(
	key: string,
	options: CacheOptions = {}
): T | null {
	const { persist = false, prefix = '' } = options;
	const fullKey = prefix + key;

	// 1. 尝试从内存缓存读取
	const memEntry = MEMORY_CACHE.get(fullKey);
	if (memEntry && Date.now() - memEntry.timestamp < memEntry.ttl) {
		return memEntry.data as T;
	}

	// 2. 如果启用持久化，尝试从 storage 读取
	if (persist) {
		try {
			const storageKey = STORAGE_PREFIX + fullKey;
			const cached = uni.getStorageSync(storageKey);
			if (cached) {
				const entry: CacheEntry<T> = JSON.parse(cached);
				if (Date.now() - entry.timestamp < entry.ttl) {
					// 恢复到内存缓存
					MEMORY_CACHE.set(fullKey, entry);
					return entry.data;
				}
				// 过期则清除
				uni.removeStorageSync(storageKey);
			}
		} catch (error) {
			console.warn('[Cache] 读取持久化缓存失败', error);
		}
	}

	return null;
}

/**
 * 设置缓存
 */
export function setCache<T = any>(
	key: string,
	data: T,
	options: CacheOptions = {}
): void {
	const { ttl = DEFAULT_TTL, persist = false, prefix = '' } = options;
	const fullKey = prefix + key;

	const entry: CacheEntry<T> = {
		data,
		timestamp: Date.now(),
		ttl,
	};

	// 1. 写入内存缓存
	MEMORY_CACHE.set(fullKey, entry);

	// 2. 如果启用持久化，写入 storage
	if (persist) {
		try {
			const storageKey = STORAGE_PREFIX + fullKey;
			uni.setStorageSync(storageKey, JSON.stringify(entry));
		} catch (error) {
			console.warn('[Cache] 写入持久化缓存失败', error);
		}
	}
}

/**
 * 清除指定缓存
 */
export function removeCache(key: string, options: CacheOptions = {}): void {
	const { persist = false, prefix = '' } = options;
	const fullKey = prefix + key;

	MEMORY_CACHE.delete(fullKey);

	if (persist) {
		try {
			uni.removeStorageSync(STORAGE_PREFIX + fullKey);
		} catch (error) {
			console.warn('[Cache] 清除持久化缓存失败', error);
		}
	}
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
	// 清除内存缓存
	MEMORY_CACHE.clear();

	// 清除所有持久化缓存
	try {
		const storage = uni.getStorageInfoSync();
		storage.keys.forEach((key) => {
			if (key.startsWith(STORAGE_PREFIX)) {
				uni.removeStorageSync(key);
			}
		});
	} catch (error) {
		console.warn('[Cache] 清除所有缓存失败', error);
	}
}

/**
 * 缓存装饰器（用于包装异步函数）
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	options: CacheOptions & {
		/** 生成缓存 key 的函数 */
		keyGenerator?: (...args: Parameters<T>) => string;
	} = {}
): T {
	const { keyGenerator, ...cacheOptions } = options;

	return (async (...args: Parameters<T>) => {
		// 生成缓存 key
		const key = keyGenerator
			? keyGenerator(...args)
			: `${fn.name}_${JSON.stringify(args)}`;

		// 尝试从缓存读取
		const cached = getCache(key, cacheOptions);
		if (cached !== null) {
			return cached;
		}

		// 执行原函数
		const result = await fn(...args);

		// 缓存结果
		setCache(key, result, cacheOptions);

		return result;
	}) as T;
}

/**
 * 请求去重（防止相同请求并发执行）
 */
const PENDING_REQUESTS = new Map<string, Promise<any>>();

export function dedupe<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	keyGenerator?: (...args: Parameters<T>) => string
): T {
	return (async (...args: Parameters<T>) => {
		const key = keyGenerator
			? keyGenerator(...args)
			: `${fn.name}_${JSON.stringify(args)}`;

		// 如果已有相同请求正在执行，返回该请求的 Promise
		if (PENDING_REQUESTS.has(key)) {
			return PENDING_REQUESTS.get(key);
		}

		// 执行新请求
		const promise = fn(...args).finally(() => {
			PENDING_REQUESTS.delete(key);
		});

		PENDING_REQUESTS.set(key, promise);
		return promise;
	}) as T;
}
