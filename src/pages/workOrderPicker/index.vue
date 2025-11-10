<template>
	<PageLayout title="选择加工单" :showBack="true" :sticky-toolbar="true">
		<template #toolbar>
			<view class="wo-toolbar">
				<sar-search
					v-model="keyword"
					shape="square"
					placeholder="搜索任务/项目/批次"
					:clearable="true"
				/>
			</view>
		</template>
		<view class="wo-list-wrapper">
			<PullList
				ref="listRef"
				:request="request"
				:query="query"
				:page-size="pageSize"
				:auto-more="true"
				class="wo-picker-list"
			>
				<template #item="{ item }">
					<CutTaskItem
						:row="item"
						:selected="isItemSelected(item)"
						@choose="onItemTap"
					/>
				</template>
				<template #empty>
					<view class="empty">暂无工单</view>
				</template>
				<template #error="{ retry }">
					<view class="error" @tap="retry()">加载失败，点击重试</view>
				</template>
				<template #finished>
					<view class="finished">—— 已到底 ——</view>
				</template>
			</PullList>
			<!-- Skeleton 覆盖层：淡出过渡，使用 v-show 保持节点，实现 opacity 过渡 -->
			<view
				v-show="skeletonVisible"
				class="wo-skeleton-overlay"
				:class="{ leaving: !firstLoading }"
			>
				<view class="wo-skel-card" v-for="n in 5" :key="n">
					<view class="line w40" />
					<view class="line w60" />
					<view class="line w50" />
					<view class="line w70" />
				</view>
			</view>
		</view>
		<!-- 单选确认弹窗 -->
		<sar-popup
			v-if="!multiple"
			:visible="popupVisible"
			effect="slide-bottom"
			@overlay-click="onCancel"
		>
			<view class="wo-confirm">
				<view class="wo-confirm__title">确认选择该工单？</view>
				<view class="wo-confirm__code">{{
					pendingMapped?.workOrder || "—"
				}}</view>
				<view class="wo-confirm__actions">
					<sar-button size="small" theme="secondary" @click="onCancel"
						>取消</sar-button
					>
					<sar-button
						size="small"
						theme="primary"
						:loading="choosing"
						@click="onConfirmSingle"
						>确认</sar-button
					>
				</view>
			</view>
		</sar-popup>
		<!-- 多选底部操作条 -->
		<view
			v-if="multiple"
			class="wo-multi-bar"
			:class="{ show: multiCount > 0 }"
		>
			<view class="info"
				>已选 <text class="num">{{ multiCount }}</text> 条</view
			>
			<view class="ops">
				<sar-button
					size="mini"
					theme="secondary"
					@click="clearMulti"
					:disabled="multiCount === 0"
					>清空</sar-button
				>
				<sar-button
					size="mini"
					theme="primary"
					:disabled="multiCount === 0"
					:loading="choosing"
					@click="onConfirmMulti"
					>确定</sar-button
				>
			</view>
		</view>
	</PageLayout>
</template>
<script setup lang="ts">
// @ts-nocheck
import { ref, computed, watch, provide, nextTick } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import PullList from "@/components/pull-list/PullList.vue";
import { http } from "@/utils/request";
import { EP } from "@/api/endpoints";
import CutTaskItem from "./components/CutTaskItem.vue";
import { WORK_ORDER_PICK_RESULT_CACHE_KEY } from "@/utils/picker";

// 仅列表：无 Tabs
const keyword = ref("");
const kwTimer = ref<number | null>(null);
const firstLoadTimeout = ref<number | null>(null);
const firstLoading = ref(true);
const skeletonVisible = ref(true);
// 当前已选（高亮用途，来自 initial 参数）
const currentValue = ref<string | null>(null);
provide("CURRENT_WORK_ORDER_VALUE", currentValue);
provide(
	"WORK_ORDER_MULTI",
	computed(() => multiple.value)
);

const listRef = ref();
const pageSize = 10;
// 查询参数：保持引用稳定，便于 PullList 侦听
const query = ref<{ kw: string }>({ kw: "" });

function updateQuery(nextKw: string) {
	const trimmed = nextKw.trim();
	if (query.value.kw === trimmed) return;
	// 重置首屏 loading 动画
	if (firstLoadTimeout.value) clearTimeout(firstLoadTimeout.value);
	firstLoading.value = true;
	skeletonVisible.value = true;
	query.value = { kw: trimmed };
	nextTick(() => listRef.value?.reload?.());
}

type PageResp = {
	records?: any[];
	rows?: any[];
	list?: any[];
	total?: number;
	totalRows?: number;
};

async function request({ page, pageSize, query }) {
	//  
	const payload: any = { pageNum: page, pageSize };
	if (query?.kw) {
		payload.keyword = query.kw;
		payload.taskNumber = query.kw;
	}
	payload.status = ["2"];
	try {
		// http.post 已返回 data 字段，不是 envelope
		const data: PageResp = await http.post<PageResp>(EP.BC_CUT_PAGE, payload);
		const list = (
			Array.isArray(data.records)
				? data.records
				: Array.isArray((data as any).rows)
				? (data as any).rows
				: Array.isArray((data as any).list)
				? (data as any).list
				: []
		) as any[];
		const total = (data.total ?? (data as any).totalRows ?? list.length) as number;
		if (page === 1) scheduleFirstLoadingDone();
		console.log("[workOrderPicker] request result:", { list, total });
		
		return { list, total };
	} catch (e) {
		if (page === 1) forceFirstLoadingDone();
		return { list: [], total: 0 };
	}
}

function scheduleFirstLoadingDone() {
	if (firstLoadTimeout.value) clearTimeout(firstLoadTimeout.value);
	firstLoadTimeout.value = setTimeout(() => {
		firstLoading.value = false;
		setTimeout(() => (skeletonVisible.value = false), 320);
		firstLoadTimeout.value = null;
	}, 160);
}

function forceFirstLoadingDone() {
	if (firstLoadTimeout.value) clearTimeout(firstLoadTimeout.value);
	firstLoading.value = false;
	setTimeout(() => (skeletonVisible.value = false), 40);
	firstLoadTimeout.value = null;
}

watch(keyword, () => {
	if (kwTimer.value !== null) clearTimeout(kwTimer.value);
	kwTimer.value = setTimeout(() => {
		updateQuery(keyword.value);
		kwTimer.value = null;
	}, 300);
});

const choosing = ref(false);
const hasResult = ref(false);
// 弹窗显示控制 & 暂存
const popupVisible = ref(false);
const pendingRaw = ref<any>(null);
const pendingMapped = ref<any>(null);
// 当前被“待确认”选中项 key（用于临时高亮 - 单选）
const selectedKey = ref<any>(null);
const token = ref<string>("");
const initial = ref<string>("");
const multiple = ref(false);
// 多选集合（key->mapped）
const selectedMap = ref<Record<string, any>>({});
const multiCount = computed(() => Object.keys(selectedMap.value).length);

function mapItem(item: any) {
	const workOrder =
		item.taskNumber ||
		item.taskNo ||
		item.workOrderNo ||
		item.workOrderCode ||
		item.workOrder ||
		item.orderNo ||
		item.orderCode ||
		item.code ||
		item.number ||
		item.no ||
		item.id;
	const processList = (
		Array.isArray(item.processList)
			? item.processList
			: Array.isArray(item.process_list)
			? item.process_list
			: []
	) as any[];
	const currentStep =
		processList.find(
			(it: any) => it && (it.status === 2 || it.status === "2")
		) ||
		processList[0] ||
		null;
	return {
		workOrder,
		processName:
			item.processName ||
			item.process ||
			item.process_name ||
			item.stepName ||
			currentStep?.stepName ||
			currentStep?.processName,
		processCode:
			item.processCode ||
			item.process_code ||
			item.processNo ||
			item.stepCode ||
			item.process_id ||
			currentStep?.stepCode ||
			currentStep?.processCode,
		batchNumber:
			item.productBatch || item.batchNumber || item.batch_no || item.batchNo,
		materialsCode:
			item.materialsCode ||
			item.materialCode ||
			item.materials_code ||
			item.materialsNo,
		materialsName:
			item.materialsName ||
			item.materialName ||
			item.materials ||
			item.material ||
			item.materialsTitle,
		specifications:
			item.specifications ||
			item.materialSpec ||
			item.spec ||
			item.specificationsName,
		projectNumber:
			item.shipNumber ||
			item.projectNumber ||
			item.project_no ||
			item.projectNo,
		segmentNumber:
			item.block || item.segmentNumber || item.segment_no || item.segmentNo,
		equipName:
			item.equipName ||
			item.equipmentName ||
			item.deviceName ||
			currentStep?.equipName ||
			currentStep?.equipmentName,
		equipId:
			item.equipId ||
			item.equipmentId ||
			item.deviceId ||
			item.equip_code ||
			currentStep?.equipId ||
			currentStep?.equipmentId,
	};
}

function itemKey(item: any) {
	return (
		item.id ||
		item.taskNumber ||
		item.taskNo ||
		item.workOrderNo ||
		item.workOrderCode ||
		item.workOrder ||
		item.orderNo ||
		item.orderCode ||
		item.code ||
		item.number ||
		item.no
	);
}
function isItemSelected(item: any) {
	if (multiple.value) return !!selectedMap.value[itemKey(item)];
	return selectedKey.value === itemKey(item);
}
function onItemTap(item: any) {
	if (multiple.value) {
		const k = itemKey(item);
		if (selectedMap.value[k]) {
			const { [k]: _, ...rest } = selectedMap.value;
			selectedMap.value = rest;
		} else {
			selectedMap.value = { ...selectedMap.value, [k]: mapItem(item) };
		}
	} else {
		onPreviewChoose(item);
	}
}
function onPreviewChoose(item: any) {
	pendingRaw.value = item;
	pendingMapped.value = mapItem(item);
	selectedKey.value = itemKey(item);
	popupVisible.value = true;
}

function emitCancelEvent() {
	if (!token.value) return;
	try {
		const pages = getCurrentPages();
		const curr: any = pages[pages.length - 1];
		const prev: any = pages[pages.length - 2];
		const payload = { token: token.value, cancelled: true };
		if (prev && prev.eventChannel)
			prev.eventChannel.emit("workOrderCancel", payload);
		else if (curr && curr.getOpenerEventChannel)
			curr.getOpenerEventChannel().emit("workOrderCancel", payload);
	} catch {}
}

function onCancel() {
	popupVisible.value = false;
	pendingRaw.value = null;
	pendingMapped.value = null;
	selectedKey.value = null;
	if (token.value) {
		emitCancelEvent();
	}
	hasResult.value = true;
}

function onConfirmSingle() {
	if (!pendingMapped.value || choosing.value) return;
	if (!token.value) {
		// 缺少 token 直接提示
		uni.showToast({ title: "缺少 token", icon: "none" });
		return;
	}
	choosing.value = true;
	const mapped = pendingMapped.value;
	hasResult.value = true;
	cacheLastResult(mapped, false);
	try {
		uni.setStorageSync("PICK_RESULT_" + token.value, mapped);
	} catch {}
	try {
		const pages = getCurrentPages();
		const curr: any = pages[pages.length - 1];
		const prev: any = pages[pages.length - 2];
		const payload = { token: token.value, payload: mapped };
		if (prev && prev.eventChannel)
			prev.eventChannel.emit("workOrderPicked", payload);
		else if (curr && curr.getOpenerEventChannel) {
			try {
				curr.getOpenerEventChannel().emit("workOrderPicked", payload);
			} catch {}
		}
	} catch {}
	uni.navigateBack({
		animationType: "none",
		delta: 1,
		fail() {
			uni.navigateBack({ delta: 1 });
		},
	});
	setTimeout(() => {
		choosing.value = false;
	}, 200);
}
function onConfirmMulti() {
	if (!multiCount.value || choosing.value) return;
	if (!token.value) {
		uni.showToast({ title: "缺少 token", icon: "none" });
		return;
	}
	choosing.value = true;
	const arr = Object.values(selectedMap.value);
	hasResult.value = true;
	cacheLastResult(arr, true);
	try {
		uni.setStorageSync("PICK_RESULT_" + token.value, arr);
	} catch {}
	try {
		const pages = getCurrentPages();
		const curr: any = pages[pages.length - 1];
		const prev: any = pages[pages.length - 2];
		const payload = { token: token.value, payload: arr };
		if (prev && prev.eventChannel)
			prev.eventChannel.emit("workOrderPicked", payload);
		else if (curr && curr.getOpenerEventChannel) {
			try {
				curr.getOpenerEventChannel().emit("workOrderPicked", payload);
			} catch {}
		}
	} catch {}
	uni.navigateBack({
		animationType: "none",
		delta: 1,
		fail() {
			uni.navigateBack({ delta: 1 });
		},
	});
	setTimeout(() => (choosing.value = false), 200);
}
function clearMulti() {
	selectedMap.value = {};
}

function cacheLastResult(payload: any, multiple: boolean) {
	try {
		uni.setStorageSync(WORK_ORDER_PICK_RESULT_CACHE_KEY, {
			type: "work-order",
			multiple,
			timestamp: Date.now(),
			payload,
		});
	} catch {}
}

onLoad((q: any) => {
	try {
		if (q?.token) token.value = q.token;
		if (q?.initial) {
			initial.value = decodeURIComponent(q.initial);
			currentValue.value = initial.value;
		}
		if (q?.multiple === "1" || q?.multiple === 1) multiple.value = true;
	} catch {}
	// 主动触发一次首屏加载
	setTimeout(() => {
		listRef.value?.reload?.();
	}, 30);
	// 兜底：最长 6 秒强制关闭 skeleton，避免异常永远不消失
	setTimeout(() => {
		if (firstLoading.value) forceFirstLoadingDone();
	}, 6000);
});

onUnload(() => {
	if (kwTimer.value !== null) clearTimeout(kwTimer.value);
	if (firstLoadTimeout.value !== null) clearTimeout(firstLoadTimeout.value);
	if (!hasResult.value && token.value) {
		emitCancelEvent();
		try {
			uni.setStorageSync("PICK_RESULT_" + token.value, { __cancel__: true });
		} catch {}
	}
});
</script>
<style scoped>

.wo-toolbar {
	padding: 24rpx 28rpx;
	background: #fff;
	border-bottom: 1px solid #f0f2f5;
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.wo-toolbar :deep(.sar-search) {
	flex: 1;
	width: auto;
}

.wo-toolbar :deep(.sar-search__body) {
	border-radius: 30rpx;
	background: #f7f8fa;
	padding: 0 24rpx;
	min-height: 70rpx;
}

.wo-toolbar :deep(.sar-search__input) {
	font-size: 28rpx;
	color: #333;
}

.wo-toolbar :deep(.sar-search__prefix-icon),
.wo-toolbar :deep(.sar-search__suffix-icon) {
	color: #8a9ab0;
}

.wo-toolbar :deep(.sar-search__placeholder) {
	color: #9aa4b1;
}

.wo-picker-list {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.wo-picker-list :deep(.pl-container) {
	flex: 1;
	display: flex;
	flex-direction: column;
	height: 100%;
}

.wo-picker-list :deep(.pl-scroll) {
	height: 100%;
}

.wo-picker-list :deep(.pl-list) {
	min-height: 100%;
}

.wo-list-wrapper {
	position: relative;
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	min-height: 400rpx;
	/* 保证 overlay 定位区域 */
}

.wo-skeleton-overlay {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	padding: 16rpx 12rpx 40rpx;
	background: #f5f6f7;
	z-index: 10;
	opacity: 1;
	transition: opacity 0.25s;
}

.wo-skeleton-overlay.leaving {
	opacity: 0;
	pointer-events: none;
}

/* 列表卡片样式由 CutTaskItem 内部维护 */
.empty,
.error,
.finished {
	text-align: center;
	padding: 40rpx 0;
	color: #999;
	font-size: 26rpx;
}

.error {
	color: #d03050;
}

.wo-confirm {
	background: #fff;
	padding: 40rpx 48rpx 54rpx;
	border-radius: 28rpx;
	min-width: 540rpx;
	box-shadow: 0 8rpx 28rpx -4rpx rgba(0, 0, 0, 0.12);
}

.wo-confirm__title {
	font-size: 30rpx;
	font-weight: 600;
	color: #333;
	line-height: 1;
	margin-bottom: 28rpx;
	text-align: center;
}

.wo-confirm__code {
	font-size: 34rpx;
	font-weight: 700;
	color: var(--app-primary, #2979ff);
	text-align: center;
	letter-spacing: 1rpx;
	margin-bottom: 40rpx;
	word-break: break-all;
}

.wo-confirm__actions {
	display: flex;
	gap: 24rpx;
	justify-content: center;
}

.wo-confirm__actions .sar-button {
	min-width: 180rpx;
}

.wo-skeleton-wrapper {
	padding: 16rpx 12rpx;
}

.wo-skel-card {
	background: #fff;
	border-radius: 20rpx;
	padding: 24rpx 28rpx;
	margin: 12rpx 0;
	overflow: hidden;
	position: relative;
}

.wo-skel-card .line {
	height: 26rpx;
	background: linear-gradient(90deg, #f2f4f7, #e9edf1, #f2f4f7);
	background-size: 400% 100%;
	animation: skel 1.2s infinite;
	border-radius: 6rpx;
	margin: 10rpx 0;
}

.wo-skel-card .line.w40 {
	width: 40%;
}

.wo-skel-card .line.w50 {
	width: 50%;
}

.wo-skel-card .line.w60 {
	width: 60%;
}

.wo-skel-card .line.w70 {
	width: 70%;
}

@keyframes skel {
	0% {
		background-position: 0 0;
	}

	100% {
		background-position: 200% 0;
	}
}

.wo-multi-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 20rpx 28rpx;
	background: #fff;
	box-shadow: 0 -6rpx 18rpx -4rpx rgba(0, 0, 0, 0.08);
	display: flex;
	justify-content: space-between;
	align-items: center;
	transform: translateY(100%);
	transition: transform 0.25s;
	z-index: 50;
}

.wo-multi-bar.show {
	transform: translateY(0);
}

.wo-multi-bar .info {
	font-size: 26rpx;
	color: #333;
}

.wo-multi-bar .info .num {
	color: var(--app-primary, #2979ff);
	font-weight: 600;
	padding: 0 6rpx;
}

.wo-multi-bar .ops {
	display: flex;
	gap: 24rpx;
}
</style>
