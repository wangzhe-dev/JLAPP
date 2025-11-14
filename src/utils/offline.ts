/**
 * 离线数据同步工具
 * 适用于船厂车间网络不稳定场景
 */

export interface OfflineData {
	id: string;
	type: 'workorder' | 'inspection' | 'exception' | 'quality';
	action: 'create' | 'update' | 'delete';
	data: any;
	timestamp: number;
	retryCount: number;
	status: 'pending' | 'syncing' | 'success' | 'failed';
	error?: string;
}

const STORAGE_KEY = 'offline_queue';
const MAX_RETRY = 3;
const RETRY_INTERVAL = 5000; // 5秒

/**
 * 添加离线数据到队列
 */
export function addOfflineData(
	type: OfflineData['type'],
	action: OfflineData['action'],
	data: any
): string {
	const id = generateId();
	const offlineData: OfflineData = {
		id,
		type,
		action,
		data,
		timestamp: Date.now(),
		retryCount: 0,
		status: 'pending',
	};

	const queue = getOfflineQueue();
	queue.push(offlineData);
	saveOfflineQueue(queue);

	console.log('[Offline] 数据已添加到离线队列', { type, action, id });
	return id;
}

/**
 * 获取离线队列
 */
export function getOfflineQueue(): OfflineData[] {
	try {
		const data = uni.getStorageSync(STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch (error) {
		console.warn('[Offline] 读取离线队列失败', error);
		return [];
	}
}

/**
 * 保存离线队列
 */
function saveOfflineQueue(queue: OfflineData[]): void {
	try {
		uni.setStorageSync(STORAGE_KEY, JSON.stringify(queue));
	} catch (error) {
		console.error('[Offline] 保存离线队列失败', error);
	}
}

/**
 * 检查网络状态
 */
export function isOnline(): Promise<boolean> {
	return new Promise((resolve) => {
		uni.getNetworkType({
			success: (res) => {
				resolve(res.networkType !== 'none');
			},
			fail: () => {
				resolve(false);
			},
		});
	});
}

/**
 * 同步离线数据
 */
export async function syncOfflineData(
	uploadFn: (item: OfflineData) => Promise<void>
): Promise<{ success: number; failed: number }> {
	const online = await isOnline();
	if (!online) {
		console.log('[Offline] 网络不可用，跳过同步');
		return { success: 0, failed: 0 };
	}

	const queue = getOfflineQueue();
	const pendingItems = queue.filter(
		(item) => item.status === 'pending' || item.status === 'failed'
	);

	if (pendingItems.length === 0) {
		console.log('[Offline] 没有待同步的数据');
		return { success: 0, failed: 0 };
	}

	console.log(`[Offline] 开始同步 ${pendingItems.length} 条数据`);

	let success = 0;
	let failed = 0;

	for (const item of pendingItems) {
		// 跳过重试次数过多的项
		if (item.retryCount >= MAX_RETRY) {
			failed++;
			continue;
		}

		// 更新状态为同步中
		item.status = 'syncing';
		saveOfflineQueue(queue);

		try {
			await uploadFn(item);

			// 同步成功，标记为成功
			item.status = 'success';
			success++;

			console.log(`[Offline] 数据同步成功`, { id: item.id, type: item.type });
		} catch (error) {
			// 同步失败，增加重试次数
			item.retryCount++;
			item.status = 'failed';
			item.error = String(error);
			failed++;

			console.error(`[Offline] 数据同步失败 (${item.retryCount}/${MAX_RETRY})`, {
				id: item.id,
				error,
			});
		}

		saveOfflineQueue(queue);
	}

	// 清理已成功的数据（保留最近7天）
	const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	const cleanedQueue = queue.filter(
		(item) =>
			item.status !== 'success' ||
			(item.status === 'success' && item.timestamp > sevenDaysAgo)
	);

	if (cleanedQueue.length !== queue.length) {
		saveOfflineQueue(cleanedQueue);
		console.log(`[Offline] 清理了 ${queue.length - cleanedQueue.length} 条历史数据`);
	}

	return { success, failed };
}

/**
 * 获取待同步数据数量
 */
export function getPendingCount(): number {
	const queue = getOfflineQueue();
	return queue.filter((item) => item.status === 'pending' || item.status === 'failed')
		.length;
}

/**
 * 清空离线队列
 */
export function clearOfflineQueue(): void {
	uni.removeStorageSync(STORAGE_KEY);
	console.log('[Offline] 离线队列已清空');
}

/**
 * 删除指定离线数据
 */
export function removeOfflineData(id: string): void {
	const queue = getOfflineQueue();
	const filtered = queue.filter((item) => item.id !== id);
	saveOfflineQueue(filtered);
	console.log('[Offline] 删除离线数据', { id });
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
	return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 监听网络状态变化，自动同步
 */
export function setupAutoSync(uploadFn: (item: OfflineData) => Promise<void>): void {
	uni.onNetworkStatusChange((res) => {
		if (res.isConnected && !res.networkType.includes('none')) {
			console.log('[Offline] 网络已连接，开始自动同步');
			syncOfflineData(uploadFn).then((result) => {
				if (result.success > 0 || result.failed > 0) {
					uni.showToast({
						title: `同步完成：成功 ${result.success} 条，失败 ${result.failed} 条`,
						icon: 'none',
					});
				}
			});
		}
	});
}

/**
 * 工单离线提交（便捷方法）
 */
export function submitWorkOrderOffline(type: string, data: any): string {
	return addOfflineData('workorder', 'create', { type, ...data });
}

/**
 * 异常报告离线提交（便捷方法）
 */
export function submitExceptionOffline(data: any): string {
	return addOfflineData('exception', 'create', data);
}

/**
 * 质检记录离线提交（便捷方法）
 */
export function submitQualityOffline(data: any): string {
	return addOfflineData('quality', 'create', data);
}

/**
 * 巡检记录离线提交（便捷方法）
 */
export function submitInspectionOffline(data: any): string {
	return addOfflineData('inspection', 'create', data);
}
