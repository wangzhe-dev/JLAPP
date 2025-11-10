/**
 * 统一的数组处理工具库
 *
 * 替代项目中7个toArray实现和其他数组操作
 * 提供类型安全的数组处理函数
 *
 * @module utils/array
 */

/**
 * 将任意值转换为数组
 *
 * 修复了原代码中的bug：
 * - 原版本A会将 0、false、"" 错误判断为空值
 * - 现采用精确的 undefined/null 判断
 *
 * @param value - 任意值
 * @returns 数组
 *
 * @example
 * toArray([1, 2, 3]) // [1, 2, 3]
 * toArray(1) // [1]
 * toArray(null) // []
 * toArray(undefined) // []
 * toArray(0) // [0] ✓ 不会被错误判断为空
 * toArray("") // [""] ✓ 不会被错误判断为空
 * toArray(false) // [false] ✓ 不会被错误判断为空
 */
export function toArray<T = any>(value: any): T[] {
	if (Array.isArray(value)) return value;
	if (value === undefined || value === null) return [];
	return [value];
}

/**
 * 数组去重
 *
 * @param arr - 输入数组
 * @param key - 对象数组时用于比较的键名
 * @returns 去重后的数组
 *
 * @example
 * unique([1, 2, 2, 3]) // [1, 2, 3]
 * unique([{id:1},{id:2},{id:1}], 'id') // [{id:1},{id:2}]
 */
export function unique<T>(arr: T[], key?: keyof T): T[] {
	if (!Array.isArray(arr)) return [];

	if (!key) {
		return Array.from(new Set(arr));
	}

	const seen = new Set();
	return arr.filter((item) => {
		const k = item[key];
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

/**
 * 数组分块
 *
 * @param arr - 输入数组
 * @param size - 每块大小
 * @returns 分块后的二维数组
 *
 * @example
 * chunk([1,2,3,4,5], 2) // [[1,2],[3,4],[5]]
 */
export function chunk<T>(arr: T[], size: number): T[][] {
	if (!Array.isArray(arr) || size <= 0) return [];

	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
}

/**
 * 数组扁平化（深度扁平）
 *
 * @param arr - 嵌套数组
 * @param depth - 扁平化深度，默认Infinity
 * @returns 扁平化后的数组
 *
 * @example
 * flatten([1,[2,[3,[4]]]]) // [1,2,3,4]
 * flatten([1,[2,[3,[4]]]], 2) // [1,2,3,[4]]
 */
export function flatten<T>(arr: any[], depth = Infinity): T[] {
	if (!Array.isArray(arr)) return [];
	if (depth <= 0) return arr.slice();

	return arr.reduce((acc, val) => {
		if (Array.isArray(val)) {
			acc.push(...flatten(val, depth - 1));
		} else {
			acc.push(val);
		}
		return acc;
	}, []);
}

/**
 * 按指定键对数组分组
 *
 * @param arr - 输入数组
 * @param key - 分组键名或提取函数
 * @returns 分组后的对象
 *
 * @example
 * const data = [{type:'A',val:1},{type:'B',val:2},{type:'A',val:3}]
 * groupBy(data, 'type') // {A:[{type:'A',val:1},{type:'A',val:3}], B:[{type:'B',val:2}]}
 * groupBy(data, item => item.val > 1) // {true:[...], false:[...]}
 */
export function groupBy<T>(
	arr: T[],
	key: keyof T | ((item: T) => string | number | boolean)
): Record<string, T[]> {
	if (!Array.isArray(arr)) return {};

	return arr.reduce((acc, item) => {
		const groupKey =
			typeof key === 'function'
				? String(key(item))
				: String(item[key as keyof T]);

		if (!acc[groupKey]) {
			acc[groupKey] = [];
		}
		acc[groupKey].push(item);
		return acc;
	}, {} as Record<string, T[]>);
}

/**
 * 数组求和
 *
 * @param arr - 数字数组
 * @param key - 对象数组时用于求和的键名或提取函数
 * @returns 总和
 *
 * @example
 * sum([1, 2, 3]) // 6
 * sum([{val:1},{val:2}], 'val') // 3
 * sum([{val:1},{val:2}], item => item.val * 2) // 6
 */
export function sum<T>(
	arr: T[],
	key?: keyof T | ((item: T) => number)
): number {
	if (!Array.isArray(arr) || arr.length === 0) return 0;

	if (!key) {
		return arr.reduce((acc, val) => acc + Number(val || 0), 0);
	}

	if (typeof key === 'function') {
		return arr.reduce((acc, item) => acc + (key(item) || 0), 0);
	}

	return arr.reduce((acc, item) => acc + Number(item[key] || 0), 0);
}

/**
 * 数组排序（不修改原数组）
 *
 * @param arr - 输入数组
 * @param key - 排序键名或比较函数
 * @param order - 排序顺序：'asc' 升序 | 'desc' 降序
 * @returns 排序后的新数组
 *
 * @example
 * sortBy([3,1,2]) // [1,2,3]
 * sortBy([{age:20},{age:18}], 'age') // [{age:18},{age:20}]
 * sortBy([{age:20},{age:18}], 'age', 'desc') // [{age:20},{age:18}]
 */
export function sortBy<T>(
	arr: T[],
	key?: keyof T | ((a: T, b: T) => number),
	order: 'asc' | 'desc' = 'asc'
): T[] {
	if (!Array.isArray(arr)) return [];

	const result = arr.slice();

	if (!key) {
		return result.sort((a, b) => {
			if (order === 'asc') {
				return a > b ? 1 : a < b ? -1 : 0;
			}
			return a < b ? 1 : a > b ? -1 : 0;
		});
	}

	if (typeof key === 'function') {
		return result.sort(order === 'asc' ? key : (a, b) => key(b, a));
	}

	return result.sort((a, b) => {
		const aVal = a[key];
		const bVal = b[key];
		if (order === 'asc') {
			return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
		}
		return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
	});
}

/**
 * 数组差集（arr1中有但arr2中没有的元素）
 *
 * @param arr1 - 第一个数组
 * @param arr2 - 第二个数组
 * @param key - 对象数组时用于比较的键名
 * @returns 差集数组
 *
 * @example
 * difference([1,2,3], [2,3,4]) // [1]
 * difference([{id:1},{id:2}], [{id:2}], 'id') // [{id:1}]
 */
export function difference<T>(arr1: T[], arr2: T[], key?: keyof T): T[] {
	if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];

	if (!key) {
		const set2 = new Set(arr2);
		return arr1.filter((item) => !set2.has(item));
	}

	const set2 = new Set(arr2.map((item) => item[key]));
	return arr1.filter((item) => !set2.has(item[key]));
}

/**
 * 数组交集（arr1和arr2共有的元素）
 *
 * @param arr1 - 第一个数组
 * @param arr2 - 第二个数组
 * @param key - 对象数组时用于比较的键名
 * @returns 交集数组
 *
 * @example
 * intersection([1,2,3], [2,3,4]) // [2,3]
 */
export function intersection<T>(arr1: T[], arr2: T[], key?: keyof T): T[] {
	if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];

	if (!key) {
		const set2 = new Set(arr2);
		return arr1.filter((item) => set2.has(item));
	}

	const set2 = new Set(arr2.map((item) => item[key]));
	return arr1.filter((item) => set2.has(item[key]));
}

/**
 * 判断数组是否为空
 *
 * @param arr - 输入数组
 * @returns 是否为空
 *
 * @example
 * isEmpty([]) // true
 * isEmpty(null) // true
 * isEmpty([1]) // false
 */
export function isEmpty(arr: any): boolean {
	return !Array.isArray(arr) || arr.length === 0;
}

/**
 * 从数组中随机抽取n个元素
 *
 * @param arr - 输入数组
 * @param count - 抽取数量，默认1
 * @returns 随机抽取的元素数组
 *
 * @example
 * sample([1,2,3,4,5], 2) // [3,1] (随机)
 */
export function sample<T>(arr: T[], count = 1): T[] {
	if (!Array.isArray(arr) || arr.length === 0) return [];

	const result: T[] = [];
	const used = new Set<number>();
	const maxCount = Math.min(count, arr.length);

	while (result.length < maxCount) {
		const index = Math.floor(Math.random() * arr.length);
		if (!used.has(index)) {
			used.add(index);
			result.push(arr[index]);
		}
	}

	return result;
}
