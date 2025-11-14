/**
 * 统一的日期时间处理工具库
 *
 * 替代项目中10+个不同的formatDateTime实现
 * 统一空值处理、格式化逻辑和错误处理
 *
 * @module utils/date
 */

/**
 * 数字补零
 * @private
 */
const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/**
 * 将任意值转换为Date对象
 * @private
 */
function toDate(value: any): Date | null {
	if (value instanceof Date) return value;

	if (value === undefined || value === null || value === '') {
		return null;
	}

	// 处理时间戳（数字或纯数字字符串）
	if (typeof value === 'number' || /^\d+$/.test(String(value))) {
		return new Date(Number(value));
	}

	// 处理字符串日期，替换 - 为 / 以兼容Safari
	const dateStr = String(value).replace(/-/g, '/');
	const date = new Date(dateStr);

	return isNaN(date.getTime()) ? null : date;
}

/**
 * 格式化日期时间
 *
 * @param value - 日期值（Date对象、时间戳、日期字符串）
 * @param options - 格式化选项
 * @returns 格式化后的字符串
 *
 * @example
 * formatDateTime(1699000000000) // "2023-11-03 12:13:20"
 * formatDateTime('2023-11-03') // "2023-11-03 00:00:00"
 * formatDateTime(null, { emptyValue: '暂无' }) // "暂无"
 * formatDateTime(new Date(), { includeTime: false }) // "2023-11-03"
 */
export function formatDateTime(
	value: any,
	options?: {
		/** 空值时的返回值，默认 '-' */
		emptyValue?: string;
		/** 是否包含时间部分，默认 true */
		includeTime?: boolean;
	}
): string {
	const { emptyValue = '-', includeTime = true } = options || {};

	const date = toDate(value);
	if (!date) return emptyValue;

	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const datePart = `${year}-${month}-${day}`;

	if (!includeTime) return datePart;

	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());
	const timePart = `${hours}:${minutes}:${seconds}`;

	return `${datePart} ${timePart}`;
}

/**
 * 格式化为年月日（不含时间）
 *
 * @param value - 日期值
 * @param emptyValue - 空值时的返回值，默认 '-'
 * @returns YYYY-MM-DD 格式
 *
 * @example
 * formatDateYMD(new Date()) // "2023-11-03"
 * formatDateYMD(null) // "-"
 */
export function formatDateYMD(value: any, emptyValue = '-'): string {
	return formatDateTime(value, { emptyValue, includeTime: false });
}

/**
 * 格式化为时分秒（不含日期）
 *
 * @param value - 日期值
 * @param emptyValue - 空值时的返回值，默认 '-'
 * @returns HH:mm:ss 格式
 *
 * @example
 * formatTime(new Date()) // "12:13:20"
 * formatTime(null) // "-"
 */
export function formatTime(value: any, emptyValue = '-'): string {
	const date = toDate(value);
	if (!date) return emptyValue;

	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());

	return `${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化为年月（不含日和时间）
 *
 * @param value - 日期值
 * @param emptyValue - 空值时的返回值，默认 '-'
 * @returns YYYY-MM 格式
 *
 * @example
 * formatDateYM(new Date()) // "2023-11"
 */
export function formatDateYM(value: any, emptyValue = '-'): string {
	const date = toDate(value);
	if (!date) return emptyValue;

	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);

	return `${year}-${month}`;
}

/**
 * 解析日期字符串为Date对象
 *
 * @param value - 日期字符串或时间戳
 * @returns Date对象，解析失败返回null
 *
 * @example
 * parseDate('2023-11-03') // Date对象
 * parseDate('invalid') // null
 */
export function parseDate(value: any): Date | null {
	return toDate(value);
}

/**
 * 获取日期范围文本
 *
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @param separator - 分隔符，默认 ' ~ '
 * @returns 日期范围字符串
 *
 * @example
 * getDateRange(start, end) // "2023-11-01 ~ 2023-11-30"
 * getDateRange(start, null) // "2023-11-01 起"
 */
export function getDateRange(
	startDate: any,
	endDate: any,
	separator = ' ~ '
): string {
	const start = formatDateYMD(startDate, '');
	const end = formatDateYMD(endDate, '');

	if (!start && !end) return '-';
	if (!start) return `至 ${end}`;
	if (!end) return `${start} 起`;

	return `${start}${separator}${end}`;
}

/**
 * 计算两个日期之间的天数差
 *
 * @param date1 - 第一个日期
 * @param date2 - 第二个日期
 * @returns 天数差（date2 - date1），解析失败返回null
 *
 * @example
 * getDaysDiff('2023-11-01', '2023-11-03') // 2
 */
export function getDaysDiff(date1: any, date2: any): number | null {
	const d1 = toDate(date1);
	const d2 = toDate(date2);

	if (!d1 || !d2) return null;

	const diffMs = d2.getTime() - d1.getTime();
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 判断是否为今天
 *
 * @param value - 日期值
 * @returns 是否为今天
 *
 * @example
 * isToday(new Date()) // true
 * isToday('2023-01-01') // false
 */
export function isToday(value: any): boolean {
	const date = toDate(value);
	if (!date) return false;

	const today = new Date();
	return (
		date.getFullYear() === today.getFullYear() &&
		date.getMonth() === today.getMonth() &&
		date.getDate() === today.getDate()
	);
}

/**
 * 获取相对时间文本（如：刚刚、5分钟前、3天前）
 *
 * @param value - 日期值
 * @returns 相对时间文本
 *
 * @example
 * getRelativeTime(Date.now() - 30000) // "刚刚"
 * getRelativeTime(Date.now() - 300000) // "5分钟前"
 */
export function getRelativeTime(value: any): string {
	const date = toDate(value);
	if (!date) return '-';

	const now = Date.now();
	const diff = now - date.getTime();

	if (diff < 60000) return '刚刚';
	if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
	if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;

	return formatDateYMD(date);
}
