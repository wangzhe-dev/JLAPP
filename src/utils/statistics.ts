/**
 * 数据统计和报表工具
 * 用于设备健康度、异常统计、质检分析等
 */

// 时间范围类型
export type TimeRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

// 统计数据项
export interface StatItem {
	label: string;
	value: number;
	unit?: string;
	trend?: 'up' | 'down' | 'stable';
	trendValue?: number;
	color?: string;
}

// 图表数据点
export interface ChartDataPoint {
	x: string | number;
	y: number;
	label?: string;
}

/**
 * 获取时间范围
 */
export function getTimeRange(range: TimeRange): { start: Date; end: Date } {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	switch (range) {
		case 'today':
			return {
				start: today,
				end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
			};

		case 'week': {
			const dayOfWeek = today.getDay();
			const start = new Date(today);
			start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
			const end = new Date(start);
			end.setDate(start.getDate() + 6);
			end.setHours(23, 59, 59, 999);
			return { start, end };
		}

		case 'month':
			return {
				start: new Date(now.getFullYear(), now.getMonth(), 1),
				end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
			};

		case 'quarter': {
			const quarter = Math.floor(now.getMonth() / 3);
			return {
				start: new Date(now.getFullYear(), quarter * 3, 1),
				end: new Date(
					now.getFullYear(),
					quarter * 3 + 3,
					0,
					23,
					59,
					59,
					999
				),
			};
		}

		case 'year':
			return {
				start: new Date(now.getFullYear(), 0, 1),
				end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
			};

		default:
			return { start: today, end: now };
	}
}

/**
 * 计算增长率
 */
export function calculateGrowthRate(current: number, previous: number): number {
	if (previous === 0) return current > 0 ? 100 : 0;
	return ((current - previous) / previous) * 100;
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals: number = 1): string {
	return `${value.toFixed(decimals)}%`;
}

/**
 * 格式化大数字
 */
export function formatNumber(value: number): string {
	if (value >= 10000) {
		return `${(value / 10000).toFixed(1)}万`;
	}
	if (value >= 1000) {
		return `${(value / 1000).toFixed(1)}千`;
	}
	return String(value);
}

/**
 * 数组求和
 */
export function sum(arr: number[]): number {
	return arr.reduce((acc, val) => acc + val, 0);
}

/**
 * 数组平均值
 */
export function average(arr: number[]): number {
	if (arr.length === 0) return 0;
	return sum(arr) / arr.length;
}

/**
 * 数组中位数
 */
export function median(arr: number[]): number {
	if (arr.length === 0) return 0;
	const sorted = [...arr].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

/**
 * 数组标准差
 */
export function standardDeviation(arr: number[]): number {
	if (arr.length === 0) return 0;
	const avg = average(arr);
	const squareDiffs = arr.map((value) => Math.pow(value - avg, 2));
	return Math.sqrt(average(squareDiffs));
}

/**
 * 按字段分组
 */
export function groupBy<T>(
	arr: T[],
	key: keyof T | ((item: T) => string | number)
): Record<string, T[]> {
	return arr.reduce((groups, item) => {
		const groupKey =
			typeof key === 'function' ? String(key(item)) : String(item[key]);
		if (!groups[groupKey]) {
			groups[groupKey] = [];
		}
		groups[groupKey].push(item);
		return groups;
	}, {} as Record<string, T[]>);
}

/**
 * 统计出现次数
 */
export function countOccurrences<T>(
	arr: T[],
	key?: keyof T | ((item: T) => string | number)
): Record<string, number> {
	return arr.reduce((counts, item) => {
		const countKey = key
			? typeof key === 'function'
				? String(key(item))
				: String(item[key])
			: String(item);

		counts[countKey] = (counts[countKey] || 0) + 1;
		return counts;
	}, {} as Record<string, number>);
}

/**
 * 获取排名前 N 项
 */
export function topN<T>(
	arr: T[],
	n: number,
	key: keyof T | ((item: T) => number)
): T[] {
	const sorted = [...arr].sort((a, b) => {
		const valueA = typeof key === 'function' ? key(a) : (a[key] as number);
		const valueB = typeof key === 'function' ? key(b) : (b[key] as number);
		return valueB - valueA;
	});
	return sorted.slice(0, n);
}

/**
 * 计算设备健康度
 */
export function calculateEquipmentHealth(data: {
	totalCount: number;
	normalCount: number;
	warningCount: number;
	errorCount: number;
}): {
	score: number;
	level: 'excellent' | 'good' | 'warning' | 'critical';
	color: string;
} {
	const { totalCount, normalCount, warningCount, errorCount } = data;

	if (totalCount === 0) {
		return { score: 0, level: 'critical', color: '#909399' };
	}

	// 计算健康度得分（0-100）
	const normalWeight = 1.0;
	const warningWeight = 0.5;
	const errorWeight = 0.0;

	const score =
		((normalCount * normalWeight +
			warningCount * warningWeight +
			errorCount * errorWeight) /
			totalCount) *
		100;

	// 确定健康等级
	let level: 'excellent' | 'good' | 'warning' | 'critical';
	let color: string;

	if (score >= 90) {
		level = 'excellent';
		color = '#67C23A';
	} else if (score >= 70) {
		level = 'good';
		color = '#409EFF';
	} else if (score >= 50) {
		level = 'warning';
		color = '#E6A23C';
	} else {
		level = 'critical';
		color = '#F56C6C';
	}

	return { score: Math.round(score), level, color };
}

/**
 * 计算异常率
 */
export function calculateExceptionRate(
	exceptionCount: number,
	totalCount: number
): number {
	if (totalCount === 0) return 0;
	return (exceptionCount / totalCount) * 100;
}

/**
 * 计算合格率
 */
export function calculateQualifiedRate(
	qualifiedCount: number,
	totalCount: number
): number {
	if (totalCount === 0) return 0;
	return (qualifiedCount / totalCount) * 100;
}

/**
 * 生成趋势数据
 */
export function generateTrendData(
	data: number[],
	labels?: string[]
): ChartDataPoint[] {
	return data.map((value, index) => ({
		x: labels?.[index] || String(index + 1),
		y: value,
	}));
}

/**
 * 按日期分组统计
 */
export function groupByDate<T>(
	arr: T[],
	dateKey: keyof T | ((item: T) => string | Date),
	format: 'date' | 'month' | 'week' = 'date'
): Record<string, T[]> {
	return groupBy(arr, (item) => {
		const date =
			typeof dateKey === 'function'
				? new Date(dateKey(item))
				: new Date(item[dateKey] as any);

		switch (format) {
			case 'date':
				return date.toISOString().split('T')[0];
			case 'month':
				return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			case 'week': {
				const weekStart = new Date(date);
				const day = weekStart.getDay();
				weekStart.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
				return weekStart.toISOString().split('T')[0];
			}
		}
	});
}

/**
 * 计算环比增长
 */
export function calculateSequentialGrowth(
	current: number,
	previous: number
): {
	rate: number;
	trend: 'up' | 'down' | 'stable';
} {
	const rate = calculateGrowthRate(current, previous);
	let trend: 'up' | 'down' | 'stable';

	if (Math.abs(rate) < 0.1) {
		trend = 'stable';
	} else if (rate > 0) {
		trend = 'up';
	} else {
		trend = 'down';
	}

	return { rate, trend };
}

/**
 * 生成报表摘要
 */
export function generateSummary(data: {
	total: number;
	completed: number;
	pending: number;
	failed?: number;
}): StatItem[] {
	const { total, completed, pending, failed = 0 } = data;

	const completionRate =
		total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

	return [
		{
			label: '总计',
			value: total,
			unit: '项',
			color: '#409EFF',
		},
		{
			label: '已完成',
			value: completed,
			unit: '项',
			color: '#67C23A',
		},
		{
			label: '进行中',
			value: pending,
			unit: '项',
			color: '#E6A23C',
		},
		{
			label: '完成率',
			value: parseFloat(completionRate),
			unit: '%',
			color: '#0b3d91',
		},
	];
}

/**
 * 导出 CSV 格式数据
 */
export function exportToCSV(
	data: any[],
	columns: { key: string; label: string }[],
	filename: string = 'export.csv'
): string {
	// CSV 头部
	const headers = columns.map((col) => col.label).join(',');

	// CSV 内容
	const rows = data.map((row) =>
		columns
			.map((col) => {
				const value = row[col.key] ?? '';
				// 处理包含逗号的值
				return typeof value === 'string' && value.includes(',')
					? `"${value}"`
					: value;
			})
			.join(',')
	);

	return [headers, ...rows].join('\n');
}
