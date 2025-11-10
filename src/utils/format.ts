/**
 * 统一的格式化工具库
 *
 * 替代项目中16个pad函数重复实现
 * 提供数字、金额、文件大小等格式化功能
 *
 * @module utils/format
 */

/**
 * 数字补零（最常用）
 *
 * @param num - 数字
 * @param length - 目标长度，默认2
 * @returns 补零后的字符串
 *
 * @example
 * pad(5) // "05"
 * pad(12) // "12"
 * pad(5, 3) // "005"
 */
export function pad(num: number, length = 2): string {
	const str = String(num);
	return str.padStart(length, '0');
}

/**
 * 格式化数字（千分位）
 *
 * @param num - 数字
 * @param decimals - 小数位数，默认2
 * @returns 格式化后的字符串
 *
 * @example
 * formatNumber(1234567.89) // "1,234,567.89"
 * formatNumber(1234567.89, 0) // "1,234,568"
 * formatNumber(null) // "-"
 */
export function formatNumber(
	num: any,
	decimals = 2,
	emptyValue = '-'
): string {
	const n = Number(num);
	if (!Number.isFinite(n)) return emptyValue;

	const fixed = n.toFixed(decimals);
	const [intPart, decPart] = fixed.split('.');

	// 千分位分隔
	const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

	return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

/**
 * 格式化金额（带货币符号）
 *
 * @param amount - 金额
 * @param options - 格式化选项
 * @returns 格式化后的金额字符串
 *
 * @example
 * formatMoney(1234.5) // "¥1,234.50"
 * formatMoney(1234.5, { symbol: '$' }) // "$1,234.50"
 * formatMoney(1234.5, { decimals: 0 }) // "¥1,235"
 */
export function formatMoney(
	amount: any,
	options?: {
		symbol?: string;
		decimals?: number;
		emptyValue?: string;
	}
): string {
	const {
		symbol = '¥',
		decimals = 2,
		emptyValue = '-',
	} = options || {};

	const formatted = formatNumber(amount, decimals, emptyValue);
	if (formatted === emptyValue) return emptyValue;

	return `${symbol}${formatted}`;
}

/**
 * 格式化文件大小
 *
 * @param bytes - 字节数
 * @param decimals - 小数位数，默认2
 * @returns 格式化后的文件大小
 *
 * @example
 * formatFileSize(1024) // "1.00 KB"
 * formatFileSize(1048576) // "1.00 MB"
 * formatFileSize(1073741824) // "1.00 GB"
 */
export function formatFileSize(bytes: number, decimals = 2): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

/**
 * 格式化百分比
 *
 * @param value - 数值（0-1 或 0-100）
 * @param options - 格式化选项
 * @returns 格式化后的百分比
 *
 * @example
 * formatPercent(0.1234) // "12.34%"
 * formatPercent(12.34, { isPercent: true }) // "12.34%"
 * formatPercent(0.1234, { decimals: 0 }) // "12%"
 */
export function formatPercent(
	value: any,
	options?: {
		decimals?: number;
		isPercent?: boolean; // value是否已经是百分比（0-100）
		emptyValue?: string;
	}
): string {
	const { decimals = 2, isPercent = false, emptyValue = '-' } = options || {};

	const num = Number(value);
	if (!Number.isFinite(num)) return emptyValue;

	const percent = isPercent ? num : num * 100;
	return `${percent.toFixed(decimals)}%`;
}

/**
 * 格式化手机号（隐藏中间4位）
 *
 * @param phone - 手机号
 * @returns 格式化后的手机号
 *
 * @example
 * formatPhone('13812345678') // "138****5678"
 * formatPhone('invalid') // "invalid"
 */
export function formatPhone(phone: string): string {
	const str = String(phone || '');
	if (!/^1\d{10}$/.test(str)) return str;

	return str.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * 格式化身份证号（隐藏中间部分）
 *
 * @param idCard - 身份证号
 * @returns 格式化后的身份证号
 *
 * @example
 * formatIdCard('110101199001011234') // "110101********1234"
 */
export function formatIdCard(idCard: string): string {
	const str = String(idCard || '');
	if (!/^\d{15}$|^\d{17}[\dXx]$/.test(str)) return str;

	return str.replace(/(\d{6})\d+(\d{4})/, '$1********$2');
}

/**
 * 格式化银行卡号（每4位空格分隔）
 *
 * @param cardNo - 银行卡号
 * @returns 格式化后的银行卡号
 *
 * @example
 * formatBankCard('6222021234567890') // "6222 0212 3456 7890"
 */
export function formatBankCard(cardNo: string): string {
	const str = String(cardNo || '').replace(/\s/g, '');
	return str.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * 格式化车牌号
 *
 * @param plateNo - 车牌号
 * @returns 格式化后的车牌号（统一大写）
 *
 * @example
 * formatPlateNo('京a12345') // "京A12345"
 */
export function formatPlateNo(plateNo: string): string {
	return String(plateNo || '').toUpperCase().trim();
}

/**
 * 格式化序号（数字 → 中文）
 *
 * @param num - 数字序号
 * @returns 中文序号
 *
 * @example
 * formatOrdinal(1) // "一"
 * formatOrdinal(10) // "十"
 * formatOrdinal(99) // "九十九"
 */
export function formatOrdinal(num: number): string {
	if (!Number.isInteger(num) || num < 1 || num > 9999) {
		return String(num);
	}

	const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
	const units = ['', '十', '百', '千'];
	const numStr = String(num);
	let result = '';

	for (let i = 0; i < numStr.length; i++) {
		const digit = parseInt(numStr[i]);
		const unit = units[numStr.length - 1 - i];

		if (digit === 0) {
			if (result && result[result.length - 1] !== '零') {
				result += '零';
			}
		} else {
			result += digits[digit] + unit;
		}
	}

	// 处理"一十"简化为"十"
	if (result.startsWith('一十')) {
		result = result.slice(1);
	}

	// 移除末尾的"零"
	return result.replace(/零+$/, '');
}

/**
 * 截断长文本
 *
 * @param text - 原文本
 * @param maxLength - 最大长度
 * @param ellipsis - 省略符号，默认'...'
 * @returns 截断后的文本
 *
 * @example
 * truncate('这是一段很长的文本', 5) // "这是一段很..."
 * truncate('短文本', 10) // "短文本"
 */
export function truncate(text: string, maxLength: number, ellipsis = '...'): string {
	const str = String(text || '');
	if (str.length <= maxLength) return str;

	return str.slice(0, maxLength) + ellipsis;
}

/**
 * 高亮关键词（HTML）
 *
 * @param text - 原文本
 * @param keyword - 关键词
 * @param className - 高亮class名，默认'highlight'
 * @returns 带高亮标签的HTML字符串
 *
 * @example
 * highlight('Hello World', 'World')
 * // "Hello <span class="highlight">World</span>"
 */
export function highlight(
	text: string,
	keyword: string,
	className = 'highlight'
): string {
	if (!keyword) return text;

	const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(escapedKeyword, 'gi');

	return String(text || '').replace(
		regex,
		(match) => `<span class="${className}">${match}</span>`
	);
}

/**
 * 移除HTML标签
 *
 * @param html - HTML字符串
 * @returns 纯文本
 *
 * @example
 * stripHtml('<p>Hello <b>World</b></p>') // "Hello World"
 */
export function stripHtml(html: string): string {
	return String(html || '')
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}
