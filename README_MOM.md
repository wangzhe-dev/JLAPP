# 船厂 MOM 系统优化指南

本文档专门针对船厂制造运营管理（MOM）系统的特殊需求，提供完整的优化方案和使用指南。

## 目录
- [系统概述](#系统概述)
- [核心模块](#核心模块)
- [离线能力](#离线能力)
- [扫码功能](#扫码功能)
- [工单管理](#工单管理)
- [数据统计](#数据统计)
- [图片处理](#图片处理)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)

---

## 系统概述

### 应用场景
船厂 MOM 系统用于管理船厂内部的制造运营流程，主要包含：

- **设备管理模块**：设备台账、巡检计划、保养记录
- **异常管理模块**：异常报告、故障追踪、处理记录
- **质检模块**：质量检验、不合格品处理、质量统计
- **消息模块**：工单通知、异常提醒、任务分派

### 特殊挑战
1. **网络环境不稳定**：车间内网络信号弱，需要离线能力
2. **频繁扫码操作**：设备管理、备件领用需要快速扫码
3. **大量图片上传**：异常报告、质检记录包含现场照片
4. **工单流转复杂**：维修、保养、巡检工单需要清晰的状态管理
5. **数据统计需求**：设备健康度、异常率、合格率等实时统计

---

## 核心模块

### 1. 设备管理 (eqManagement)
设备台账管理、设备状态监控、设备巡检

**主要页面**：
- `/pages/eqManagement/index.vue` - 设备列表
- `/pages/eqInspection/index.vue` - 设备巡检

**相关 API**：
```typescript
import { getEquipmentList, getEquipmentDetail } from '@/api/equipment';
```

### 2. 异常管理 (exceptionManagement)
异常报告、故障处理、异常统计

**主要页面**：
- `/pages/exceptionManagement/index.vue` - 异常列表
- `/pages/abnormalTab/index.vue` - 异常详情

**相关 API**：
```typescript
import { createException, updateException } from '@/api/exception';
```

### 3. 质检模块 (quality)
质量检验、不合格品管理、质量统计

**主要页面**：
- `/pages/quality/index.vue` - 质检列表
- `/pages/qualityControl/index.vue` - 质检控制
- `/pages/qualityControlDetail/index.vue` - 质检详情

**相关 API**：
```typescript
import { getQualityList, submitQualityReport } from '@/api/quality';
```

### 4. 工单管理 (orderList)
维修工单、保养工单、巡检工单

**主要页面**：
- `/pages/orderList/index.vue` - 工单列表
- `/pages/maintainOrder/index.vue` - 维修工单
- `/pages/upkeepOrder/index.vue` - 保养工单
- `/pages/inspectionPlan/index.vue` - 巡检计划

**相关 API**：
```typescript
import { getWorkOrderList, updateWorkOrder } from '@/api/order';
```

---

## 离线能力

### 功能说明
针对车间网络不稳定场景，提供完整的离线数据同步方案。

### 使用方法

#### 1. 添加离线数据
```typescript
import {
	submitWorkOrderOffline,
	submitExceptionOffline,
	submitQualityOffline,
	submitInspectionOffline,
} from '@/utils/offline';

// 工单离线提交
const offlineId = submitWorkOrderOffline('repair', {
	equipmentId: 'EQ001',
	description: '设备故障',
	priority: 'high',
});

// 异常报告离线提交
submitExceptionOffline({
	type: 'equipment_failure',
	equipmentId: 'EQ002',
	description: '设备异常',
	images: ['url1', 'url2'],
});

// 质检记录离线提交
submitQualityOffline({
	productId: 'P001',
	result: 'qualified',
	images: ['url1'],
});
```

#### 2. 数据同步
```typescript
import { syncOfflineData, setupAutoSync } from '@/utils/offline';

// 手动同步
const uploadFunction = async (item) => {
	// 根据数据类型调用不同的上传接口
	switch (item.type) {
		case 'workorder':
			return await createWorkOrder(item.data);
		case 'exception':
			return await createException(item.data);
		// ... 其他类型
	}
};

const result = await syncOfflineData(uploadFunction);
console.log(`同步完成：成功 ${result.success} 条，失败 ${result.failed} 条`);

// 自动同步（网络恢复时自动上传）
setupAutoSync(uploadFunction);
```

#### 3. 查看待同步数据
```typescript
import { getPendingCount, getOfflineQueue } from '@/utils/offline';

// 获取待同步数量
const count = getPendingCount();
console.log(`待同步：${count} 条`);

// 获取离线队列
const queue = getOfflineQueue();
```

---

## 扫码功能

### 功能说明
支持设备二维码、备件二维码、工单二维码的扫描和识别。

### 使用方法

#### 1. 扫描设备二维码
```typescript
import { scanEquipmentQRCode, quickSearchEquipment } from '@/utils/qrcode';

// 基础扫描
try {
	const equipment = await scanEquipmentQRCode();
	console.log('设备信息:', equipment);
	// { id: 'EQ001', name: '设备A', code: 'EQ001' }
} catch (error) {
	uni.showToast({ title: error.message, icon: 'none' });
}

// 扫码并查询（推荐）
const searchFn = async (code) => {
	return await getEquipmentByCode(code);
};

const equipment = await quickSearchEquipment(searchFn);
// 自动显示 loading，返回设备详情
```

#### 2. 扫描备件二维码
```typescript
import { scanSparePartQRCode } from '@/utils/qrcode';

const sparePart = await scanSparePartQRCode();
console.log('备件信息:', sparePart);
// { id: 'SP001', name: '备件A', code: 'SP001' }
```

#### 3. 批量扫描
```typescript
import { scanMultipleQRCodes } from '@/utils/qrcode';

// 连续扫描多个二维码
const results = await scanMultipleQRCodes(10); // 最多扫描 10 个
console.log(`已扫描 ${results.length} 个二维码`);
```

#### 4. 生成二维码数据
```typescript
import { generateQRCodeData } from '@/utils/qrcode';

// 生成设备二维码数据
const qrData = generateQRCodeData({
	type: 'equipment',
	id: 'EQ001',
	name: '设备A',
});
console.log(qrData); // "EQ:EQ001:设备A"
```

---

## 工单管理

### 工单状态流转

项目提供完整的工单状态机，支持：
- 草稿 → 待接单 → 已接单 → 进行中 → 已完成 → 已验收 → 已关闭

### 使用方法

#### 1. 获取状态显示
```typescript
import {
	WorkOrderStatus,
	getStatusDisplay,
	getPriorityDisplay,
} from '@/utils/workorder';

const status = getStatusDisplay(WorkOrderStatus.IN_PROGRESS);
console.log(status);
// { label: '进行中', color: '#0b3d91', bgColor: '#e8f4ff' }

const priority = getPriorityDisplay('high');
console.log(priority);
// { label: '高', color: '#E6A23C', level: 3 }
```

#### 2. 状态流转校验
```typescript
import { canTransitionTo, getNextStatuses } from '@/utils/workorder';

// 检查是否可以流转
const canStart = canTransitionTo(
	WorkOrderStatus.ACCEPTED,
	WorkOrderStatus.IN_PROGRESS
);
console.log(canStart); // true

// 获取可流转的下一状态
const nextStatuses = getNextStatuses(WorkOrderStatus.IN_PROGRESS);
console.log(nextStatuses);
// [WorkOrderStatus.PAUSED, WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED]
```

#### 3. 获取操作按钮
```typescript
import { getStatusActions } from '@/utils/workorder';

const actions = getStatusActions(WorkOrderStatus.IN_PROGRESS);
// [
//   { status: 'paused', label: '暂停', color: '#F56C6C' },
//   { status: 'completed', label: '完成', color: '#67C23A' },
//   { status: 'cancelled', label: '取消', color: '#909399' }
// ]
```

#### 4. 耗时计算
```typescript
import {
	calculateDuration,
	formatDuration,
	isOverdue,
	getRemainingTime,
} from '@/utils/workorder';

// 计算耗时
const minutes = calculateDuration('2024-01-01 10:00:00', '2024-01-01 11:30:00');
console.log(minutes); // 90

// 格式化耗时
const formatted = formatDuration(90);
console.log(formatted); // "1小时30分钟"

// 检查是否超时
const overdue = isOverdue('2024-01-01 10:00:00');
console.log(overdue); // true/false

// 剩余时间
const remaining = getRemainingTime('2024-01-01 18:00:00');
console.log(remaining); // 剩余分钟数
```

#### 5. 工单编号生成
```typescript
import { generateWorkOrderNo } from '@/utils/workorder';

const orderNo = generateWorkOrderNo('repair', 'WO');
console.log(orderNo); // "WOR20240101ABC123"
```

#### 6. 工单统计
```typescript
import { getWorkOrderStats, sortByPriority } from '@/utils/workorder';

const orders = [
	{ status: 'pending', priority: 'high' },
	{ status: 'in_progress', priority: 'low' },
	{ status: 'completed', priority: 'medium' },
];

// 统计
const stats = getWorkOrderStats(orders);
console.log(stats);
// {
//   total: 3,
//   pending: 1,
//   inProgress: 1,
//   completed: 1,
//   cancelled: 0,
//   byStatus: { ... }
// }

// 按优先级排序
const sorted = sortByPriority(orders);
// 高优先级在前
```

---

## 数据统计

### 使用方法

#### 1. 时间范围统计
```typescript
import { getTimeRange } from '@/utils/statistics';

// 获取本周时间范围
const { start, end } = getTimeRange('week');
console.log('本周:', start, '至', end);

// 支持: 'today', 'week', 'month', 'quarter', 'year'
```

#### 2. 设备健康度计算
```typescript
import { calculateEquipmentHealth } from '@/utils/statistics';

const health = calculateEquipmentHealth({
	totalCount: 100,
	normalCount: 85,
	warningCount: 10,
	errorCount: 5,
});

console.log(health);
// {
//   score: 90,
//   level: 'excellent',
//   color: '#67C23A'
// }
```

#### 3. 异常率 / 合格率计算
```typescript
import {
	calculateExceptionRate,
	calculateQualifiedRate,
} from '@/utils/statistics';

const exceptionRate = calculateExceptionRate(5, 100);
console.log(`异常率: ${exceptionRate}%`); // 5%

const qualifiedRate = calculateQualifiedRate(95, 100);
console.log(`合格率: ${qualifiedRate}%`); // 95%
```

#### 4. 数据分组统计
```typescript
import { groupBy, countOccurrences, topN } from '@/utils/statistics';

const data = [
	{ equipmentId: 'EQ001', status: 'normal' },
	{ equipmentId: 'EQ002', status: 'warning' },
	{ equipmentId: 'EQ001', status: 'error' },
];

// 按设备分组
const grouped = groupBy(data, 'equipmentId');
// { 'EQ001': [...], 'EQ002': [...] }

// 统计出现次数
const counts = countOccurrences(data, 'status');
// { 'normal': 1, 'warning': 1, 'error': 1 }

// 获取前 N 项
const top = topN(data, 2, (item) => item.equipmentId.length);
```

#### 5. 趋势数据生成
```typescript
import { generateTrendData, groupByDate } from '@/utils/statistics';

// 生成趋势图数据
const trendData = generateTrendData([10, 20, 15, 30], ['周一', '周二', '周三', '周四']);
// [
//   { x: '周一', y: 10 },
//   { x: '周二', y: 20 },
//   ...
// ]

// 按日期分组
const byDate = groupByDate(data, 'createdAt', 'date');
// { '2024-01-01': [...], '2024-01-02': [...] }
```

#### 6. 生成报表摘要
```typescript
import { generateSummary } from '@/utils/statistics';

const summary = generateSummary({
	total: 100,
	completed: 80,
	pending: 15,
	failed: 5,
});

// [
//   { label: '总计', value: 100, unit: '项', color: '#409EFF' },
//   { label: '已完成', value: 80, unit: '项', color: '#67C23A' },
//   { label: '进行中', value: 15, unit: '项', color: '#E6A23C' },
//   { label: '完成率', value: 80, unit: '%', color: '#0b3d91' }
// ]
```

---

## 图片处理

### 功能说明
针对异常报告、质检记录等场景，提供批量图片上传、压缩、水印功能。

### 使用方法

#### 1. 选择并上传（推荐）
```typescript
import { chooseAndUpload } from '@/utils/image';

// 一站式选择并上传
const uploadFn = async (file) => {
	// 调用你的上传接口
	const formData = new FormData();
	formData.append('file', file);
	const res = await uploadFile(formData);
	return res.url;
};

const urls = await chooseAndUpload(uploadFn, {
	count: 9, // 最多选择 9 张
	compress: true, // 自动压缩
	compressOptions: {
		quality: 0.8,
		maxWidth: 1080,
	},
	showProgress: true, // 显示进度
});

console.log('上传成功:', urls);
```

#### 2. 批量上传（高级）
```typescript
import { batchUploadImages } from '@/utils/image';

const result = await batchUploadImages(files, {
	uploadFn,
	compress: true,
	maxConcurrent: 3, // 最大并发数
	maxRetry: 2, // 失败重试次数
	onProgress: (current, total, percent) => {
		console.log(`进度: ${percent}%`);
	},
	onItemSuccess: (url, index) => {
		console.log(`第 ${index + 1} 张上传成功:`, url);
	},
	onItemError: (error, index) => {
		console.error(`第 ${index + 1} 张上传失败:`, error);
	},
});

console.log(`成功: ${result.success.length}, 失败: ${result.failed.length}`);
```

#### 3. 图片压缩
```typescript
import { compressImage } from '@/utils/image';

const compressedPath = await compressImage(originalPath, {
	quality: 0.8,
	maxWidth: 1080,
	maxHeight: 1920,
});
```

#### 4. 添加水印（可选）
```typescript
import { addWatermark } from '@/utils/image';

// 给图片添加时间水印
const watermarkedPath = await addWatermark(imagePath, {
	text: `${userName} ${new Date().toLocaleString()}`,
	position: 'bottomRight',
	fontSize: 14,
	color: '#ffffff',
	opacity: 0.8,
});
```

---

## 使用示例

### 示例 1：异常报告提交

```vue
<template>
	<view class="exception-form">
		<sar-form ref="formRef" v-model="formData">
			<sar-form-item label="异常描述" required>
				<sar-textarea v-model="formData.description" placeholder="请描述异常情况" />
			</sar-form-item>

			<sar-form-item label="现场照片">
				<view class="image-upload">
					<view v-for="(img, index) in formData.images" :key="index" class="image-item">
						<image :src="img" mode="aspectFill" />
					</view>
					<view class="upload-btn" @click="handleUpload">
						<sar-icon name="plus" />
					</view>
				</view>
			</sar-form-item>

			<sar-button block theme="primary" @click="handleSubmit">
				提交异常报告
			</sar-button>
		</sar-form>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { chooseAndUpload } from '@/utils/image';
import { submitExceptionOffline, isOnline, syncOfflineData } from '@/utils/offline';
import { uploadFile } from '@/api/upload';

const formData = ref({
	description: '',
	images: [],
});

// 图片上传
async function handleUpload() {
	try {
		const urls = await chooseAndUpload(
			(file) => uploadFile(file),
			{
				count: 9,
				compress: true,
				compressOptions: { quality: 0.8, maxWidth: 1080 },
			}
		);
		formData.value.images.push(...urls);
	} catch (error) {
		console.error('上传失败', error);
	}
}

// 提交异常报告
async function handleSubmit() {
	// 检查网络状态
	const online = await isOnline();

	if (online) {
		// 在线提交
		try {
			uni.showLoading({ title: '提交中...' });
			await createException(formData.value);
			uni.hideLoading();
			uni.showToast({ title: '提交成功', icon: 'success' });
			uni.navigateBack();
		} catch (error) {
			uni.hideLoading();
			uni.showToast({ title: '提交失败', icon: 'none' });
		}
	} else {
		// 离线提交
		submitExceptionOffline(formData.value);
		uni.showToast({ title: '已保存到离线队列', icon: 'success' });
		uni.navigateBack();
	}
}
</script>
```

### 示例 2：设备扫码查询

```vue
<template>
	<view class="equipment-scan">
		<sar-button block theme="primary" @click="handleScan">
			扫描设备二维码
		</sar-button>

		<view v-if="equipment" class="equipment-info">
			<CCard :lines="equipmentLines" />
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { quickSearchEquipment } from '@/utils/qrcode';
import { getEquipmentByCode } from '@/api/equipment';

const equipment = ref(null);

const equipmentLines = computed(() => [
	{ label: '设备编号', value: equipment.value?.code },
	{ label: '设备名称', value: equipment.value?.name },
	{ label: '设备状态', value: equipment.value?.status },
	{ label: '所属车间', value: equipment.value?.workshop },
]);

async function handleScan() {
	try {
		equipment.value = await quickSearchEquipment(async (code) => {
			return await getEquipmentByCode(code);
		});
	} catch (error) {
		uni.showToast({ title: error.message, icon: 'none' });
	}
}
</script>
```

### 示例 3：工单状态流转

```vue
<template>
	<view class="workorder-actions">
		<sar-button
			v-for="action in statusActions"
			:key="action.status"
			:theme="getButtonTheme(action)"
			@click="handleStatusChange(action.status)"
		>
			{{ action.label }}
		</sar-button>
	</view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { WorkOrderStatus, getStatusActions, canTransitionTo } from '@/utils/workorder';

const props = defineProps<{
	workOrder: any;
}>();

const statusActions = computed(() => {
	return getStatusActions(props.workOrder.status);
});

function getButtonTheme(action: any) {
	if (action.status === WorkOrderStatus.COMPLETED) return 'primary';
	if (action.status === WorkOrderStatus.CANCELLED) return 'default';
	return 'default';
}

async function handleStatusChange(targetStatus: WorkOrderStatus) {
	// 校验状态流转
	if (!canTransitionTo(props.workOrder.status, targetStatus)) {
		uni.showToast({ title: '状态流转不合法', icon: 'none' });
		return;
	}

	// 更新工单状态
	try {
		uni.showLoading({ title: '处理中...' });
		await updateWorkOrderStatus(props.workOrder.id, targetStatus);
		uni.hideLoading();
		uni.showToast({ title: '操作成功', icon: 'success' });
		// 刷新工单数据
	} catch (error) {
		uni.hideLoading();
		uni.showToast({ title: '操作失败', icon: 'none' });
	}
}
</script>
```

---

## 最佳实践

### 1. 离线优先策略

```typescript
// 优先尝试在线提交，失败则离线保存
async function submitData(data: any) {
	const online = await isOnline();

	if (online) {
		try {
			await uploadData(data);
			return { success: true, offline: false };
		} catch (error) {
			// 在线提交失败，转为离线
			submitWorkOrderOffline('repair', data);
			return { success: true, offline: true };
		}
	} else {
		// 直接离线保存
		submitWorkOrderOffline('repair', data);
		return { success: true, offline: true };
	}
}
```

### 2. 应用启动时同步

```typescript
// App.vue
import { setupAutoSync, syncOfflineData } from '@/utils/offline';

onLaunch(() => {
	// 设置自动同步
	setupAutoSync(async (item) => {
		// 根据类型调用不同接口
		switch (item.type) {
			case 'workorder':
				return await createWorkOrder(item.data);
			case 'exception':
				return await createException(item.data);
			// ...
		}
	});

	// 手动触发一次同步
	syncOfflineData(uploadFunction);
});
```

### 3. 工单列表页面优化

```typescript
import { getWorkOrderStats, filterByStatus, sortByPriority } from '@/utils/workorder';

const orders = ref([]);

// 统计信息
const stats = computed(() => getWorkOrderStats(orders.value));

// 筛选进行中的工单
const inProgressOrders = computed(() =>
	filterByStatus(orders.value, [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.PAUSED])
);

// 按优先级排序
const sortedOrders = computed(() => sortByPriority(orders.value));
```

### 4. 数据统计面板

```typescript
import { calculateEquipmentHealth, generateSummary } from '@/utils/statistics';

// 设备健康度统计
const equipmentStats = computed(() => {
	const equipment = equipmentList.value;
	return calculateEquipmentHealth({
		totalCount: equipment.length,
		normalCount: equipment.filter((e) => e.status === 'normal').length,
		warningCount: equipment.filter((e) => e.status === 'warning').length,
		errorCount: equipment.filter((e) => e.status === 'error').length,
	});
});

// 工单完成度统计
const workOrderSummary = computed(() => {
	const orders = workOrderList.value;
	return generateSummary({
		total: orders.length,
		completed: orders.filter((o) => o.status === 'completed').length,
		pending: orders.filter((o) => o.status === 'pending').length,
	});
});
```

---

## 性能优化建议

### 1. 图片优化
- 异常报告、质检记录的图片建议压缩到 0.8 质量
- 最大宽度限制为 1080px
- 使用批量上传时，并发数控制在 3 以内

### 2. 数据缓存
- 设备列表、备件列表等不常变化的数据使用缓存
- 缓存时间建议 5-10 分钟

```typescript
import { cached } from '@/utils/cache';

const getEquipmentList = cached(
	async () => {
		return await http.get('/equipment/list');
	},
	{ ttl: 10 * 60 * 1000 } // 10 分钟
);
```

### 3. 列表分页加载
- 工单列表、异常列表使用分页加载
- 每页建议 20 条数据

### 4. 扫码性能
- 批量扫码时，建议每次最多扫描 20 个
- 扫码后立即缓存结果，避免重复扫描

---

## 技术支持

如有问题，请参考：
- [多端打包指南](./README_BUILD.md)
- [性能优化指南](./PERFORMANCE.md)
- [主 README](./README.md)

或联系技术团队获取支持。
