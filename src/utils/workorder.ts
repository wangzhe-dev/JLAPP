/**
 * 工单流程管理工具
 * 统一管理维修、保养、巡检等工单的状态流转
 */

// 工单类型
export type WorkOrderType = 'repair' | 'maintain' | 'inspection' | 'exception';

// 工单状态（通用状态机）
export enum WorkOrderStatus {
	DRAFT = 'draft', // 草稿
	PENDING = 'pending', // 待接单
	ACCEPTED = 'accepted', // 已接单
	IN_PROGRESS = 'in_progress', // 进行中
	PAUSED = 'paused', // 已暂停
	COMPLETED = 'completed', // 已完成
	VERIFIED = 'verified', // 已验收
	CLOSED = 'closed', // 已关闭
	CANCELLED = 'cancelled', // 已取消
	REJECTED = 'rejected', // 已拒绝
}

// 工单优先级
export enum WorkOrderPriority {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	URGENT = 'urgent',
}

// 状态显示配置
export const STATUS_CONFIG: Record<
	WorkOrderStatus,
	{
		label: string;
		color: string;
		icon?: string;
		bgColor?: string;
	}
> = {
	[WorkOrderStatus.DRAFT]: {
		label: '草稿',
		color: '#909399',
		bgColor: '#f4f4f5',
	},
	[WorkOrderStatus.PENDING]: {
		label: '待接单',
		color: '#E6A23C',
		bgColor: '#fdf6ec',
	},
	[WorkOrderStatus.ACCEPTED]: {
		label: '已接单',
		color: '#409EFF',
		bgColor: '#ecf5ff',
	},
	[WorkOrderStatus.IN_PROGRESS]: {
		label: '进行中',
		color: '#0b3d91',
		bgColor: '#e8f4ff',
	},
	[WorkOrderStatus.PAUSED]: {
		label: '已暂停',
		color: '#F56C6C',
		bgColor: '#fef0f0',
	},
	[WorkOrderStatus.COMPLETED]: {
		label: '已完成',
		color: '#67C23A',
		bgColor: '#f0f9ff',
	},
	[WorkOrderStatus.VERIFIED]: {
		label: '已验收',
		color: '#67C23A',
		bgColor: '#f0f9ff',
	},
	[WorkOrderStatus.CLOSED]: {
		label: '已关闭',
		color: '#909399',
		bgColor: '#f4f4f5',
	},
	[WorkOrderStatus.CANCELLED]: {
		label: '已取消',
		color: '#909399',
		bgColor: '#f4f4f5',
	},
	[WorkOrderStatus.REJECTED]: {
		label: '已拒绝',
		color: '#F56C6C',
		bgColor: '#fef0f0',
	},
};

// 优先级配置
export const PRIORITY_CONFIG: Record<
	WorkOrderPriority,
	{
		label: string;
		color: string;
		level: number;
	}
> = {
	[WorkOrderPriority.LOW]: {
		label: '低',
		color: '#909399',
		level: 1,
	},
	[WorkOrderPriority.MEDIUM]: {
		label: '中',
		color: '#409EFF',
		level: 2,
	},
	[WorkOrderPriority.HIGH]: {
		label: '高',
		color: '#E6A23C',
		level: 3,
	},
	[WorkOrderPriority.URGENT]: {
		label: '紧急',
		color: '#F56C6C',
		level: 4,
	},
};

/**
 * 获取状态显示信息
 */
export function getStatusDisplay(status: WorkOrderStatus) {
	return STATUS_CONFIG[status] || STATUS_CONFIG[WorkOrderStatus.DRAFT];
}

/**
 * 获取优先级显示信息
 */
export function getPriorityDisplay(priority: WorkOrderPriority) {
	return (
		PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[WorkOrderPriority.MEDIUM]
	);
}

/**
 * 状态流转规则（状态机）
 */
const STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
	[WorkOrderStatus.DRAFT]: [
		WorkOrderStatus.PENDING,
		WorkOrderStatus.CANCELLED,
	],
	[WorkOrderStatus.PENDING]: [
		WorkOrderStatus.ACCEPTED,
		WorkOrderStatus.REJECTED,
		WorkOrderStatus.CANCELLED,
	],
	[WorkOrderStatus.ACCEPTED]: [
		WorkOrderStatus.IN_PROGRESS,
		WorkOrderStatus.CANCELLED,
	],
	[WorkOrderStatus.IN_PROGRESS]: [
		WorkOrderStatus.PAUSED,
		WorkOrderStatus.COMPLETED,
		WorkOrderStatus.CANCELLED,
	],
	[WorkOrderStatus.PAUSED]: [
		WorkOrderStatus.IN_PROGRESS,
		WorkOrderStatus.CANCELLED,
	],
	[WorkOrderStatus.COMPLETED]: [
		WorkOrderStatus.VERIFIED,
		WorkOrderStatus.IN_PROGRESS, // 返工
	],
	[WorkOrderStatus.VERIFIED]: [WorkOrderStatus.CLOSED],
	[WorkOrderStatus.CLOSED]: [],
	[WorkOrderStatus.CANCELLED]: [],
	[WorkOrderStatus.REJECTED]: [],
};

/**
 * 检查状态流转是否合法
 */
export function canTransitionTo(
	currentStatus: WorkOrderStatus,
	targetStatus: WorkOrderStatus
): boolean {
	const allowedStatuses = STATUS_TRANSITIONS[currentStatus] || [];
	return allowedStatuses.includes(targetStatus);
}

/**
 * 获取可流转的下一状态列表
 */
export function getNextStatuses(
	currentStatus: WorkOrderStatus
): WorkOrderStatus[] {
	return STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * 获取状态操作按钮配置
 */
export function getStatusActions(currentStatus: WorkOrderStatus) {
	const nextStatuses = getNextStatuses(currentStatus);
	return nextStatuses.map((status) => {
		const config = getStatusDisplay(status);
		return {
			status,
			label: getActionLabel(currentStatus, status),
			color: config.color,
		};
	});
}

/**
 * 获取操作按钮文本
 */
function getActionLabel(
	currentStatus: WorkOrderStatus,
	targetStatus: WorkOrderStatus
): string {
	const actionMap: Record<string, string> = {
		[`${WorkOrderStatus.DRAFT}-${WorkOrderStatus.PENDING}`]: '提交工单',
		[`${WorkOrderStatus.PENDING}-${WorkOrderStatus.ACCEPTED}`]: '接单',
		[`${WorkOrderStatus.PENDING}-${WorkOrderStatus.REJECTED}`]: '拒绝',
		[`${WorkOrderStatus.ACCEPTED}-${WorkOrderStatus.IN_PROGRESS}`]: '开始处理',
		[`${WorkOrderStatus.IN_PROGRESS}-${WorkOrderStatus.PAUSED}`]: '暂停',
		[`${WorkOrderStatus.IN_PROGRESS}-${WorkOrderStatus.COMPLETED}`]: '完成',
		[`${WorkOrderStatus.PAUSED}-${WorkOrderStatus.IN_PROGRESS}`]: '继续',
		[`${WorkOrderStatus.COMPLETED}-${WorkOrderStatus.VERIFIED}`]: '验收',
		[`${WorkOrderStatus.COMPLETED}-${WorkOrderStatus.IN_PROGRESS}`]: '返工',
		[`${WorkOrderStatus.VERIFIED}-${WorkOrderStatus.CLOSED}`]: '关闭',
	};

	const key = `${currentStatus}-${targetStatus}`;
	return actionMap[key] || '操作';
}

/**
 * 计算工单耗时（分钟）
 */
export function calculateDuration(
	startTime?: string | number,
	endTime?: string | number
): number {
	if (!startTime || !endTime) return 0;

	const start =
		typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
	const end =
		typeof endTime === 'string' ? new Date(endTime).getTime() : endTime;

	return Math.floor((end - start) / 60000);
}

/**
 * 格式化耗时显示
 */
export function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes}分钟`;

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;

	if (hours < 24) {
		return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
	}

	const days = Math.floor(hours / 24);
	const remainHours = hours % 24;

	if (remainHours > 0) {
		return `${days}天${remainHours}小时`;
	}

	return `${days}天`;
}

/**
 * 检查工单是否超时
 */
export function isOverdue(
	dueTime?: string | number,
	currentTime: number = Date.now()
): boolean {
	if (!dueTime) return false;

	const due =
		typeof dueTime === 'string' ? new Date(dueTime).getTime() : dueTime;
	return currentTime > due;
}

/**
 * 计算剩余时间
 */
export function getRemainingTime(
	dueTime?: string | number,
	currentTime: number = Date.now()
): number {
	if (!dueTime) return 0;

	const due =
		typeof dueTime === 'string' ? new Date(dueTime).getTime() : dueTime;
	return Math.max(0, Math.floor((due - currentTime) / 60000));
}

/**
 * 工单编号生成器
 */
export function generateWorkOrderNo(
	type: WorkOrderType,
	prefix: string = 'WO'
): string {
	const typeMap = {
		repair: 'R',
		maintain: 'M',
		inspection: 'I',
		exception: 'E',
	};

	const typeCode = typeMap[type] || 'W';
	const date = new Date();
	const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
	const random = Math.random().toString(36).substr(2, 6).toUpperCase();

	return `${prefix}${typeCode}${dateStr}${random}`;
}

/**
 * 根据优先级排序工单
 */
export function sortByPriority<T extends { priority?: WorkOrderPriority }>(
	orders: T[]
): T[] {
	return [...orders].sort((a, b) => {
		const priorityA =
			PRIORITY_CONFIG[a.priority || WorkOrderPriority.MEDIUM].level;
		const priorityB =
			PRIORITY_CONFIG[b.priority || WorkOrderPriority.MEDIUM].level;
		return priorityB - priorityA; // 降序：高优先级在前
	});
}

/**
 * 筛选特定状态的工单
 */
export function filterByStatus<T extends { status?: WorkOrderStatus }>(
	orders: T[],
	statuses: WorkOrderStatus[]
): T[] {
	return orders.filter((order) =>
		statuses.includes(order.status || WorkOrderStatus.DRAFT)
	);
}

/**
 * 获取工单统计信息
 */
export function getWorkOrderStats<T extends { status?: WorkOrderStatus }>(
	orders: T[]
) {
	const stats = {
		total: orders.length,
		pending: 0,
		inProgress: 0,
		completed: 0,
		cancelled: 0,
		byStatus: {} as Record<WorkOrderStatus, number>,
	};

	orders.forEach((order) => {
		const status = order.status || WorkOrderStatus.DRAFT;

		// 累计状态统计
		stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

		// 快速统计
		if (
			status === WorkOrderStatus.PENDING ||
			status === WorkOrderStatus.ACCEPTED
		) {
			stats.pending++;
		} else if (
			status === WorkOrderStatus.IN_PROGRESS ||
			status === WorkOrderStatus.PAUSED
		) {
			stats.inProgress++;
		} else if (
			status === WorkOrderStatus.COMPLETED ||
			status === WorkOrderStatus.VERIFIED ||
			status === WorkOrderStatus.CLOSED
		) {
			stats.completed++;
		} else if (
			status === WorkOrderStatus.CANCELLED ||
			status === WorkOrderStatus.REJECTED
		) {
			stats.cancelled++;
		}
	});

	return stats;
}
