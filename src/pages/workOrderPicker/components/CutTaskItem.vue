<template>
	<!-- 使用 @tap.stop.prevent 避免冒泡和默认行为，减少因父级滚动/点击监听导致的重新布局 -->
	<view
		class="woi"
		hover-class="none"
		@tap.stop.prevent="onClick"
		:data-id="rowId"
		:class="{ 'woi--current': isCurrent }"
	>
		<CCard class="woi-card" :class="{ selected }">
			<view v-for="(it, idx) in rowsToShow" :key="idx" class="card-row">
				<view class="label">{{ it.label }}</view>
				<view class="value">{{ it.value }}</view>
			</view>
			<view v-if="hasMore" class="more" @click.stop="toggleMore">{{
				showMore ? "收起" : "显示更多"
			}}</view>
		</CCard>
		<!-- 单选角标 -->
		<view class="corner" v-if="selected && !isMulti">
			<sar-icon name="check-square-fill" color="#0B3D91" />
		</view>
		<!-- 多选复选框 -->
		<view class="corner-multi" v-if="isMulti">
			<view class="chk" :class="{ on: selected }">
				<view class="inner" v-if="selected">
					<sar-icon name="check" color="#fff" size="16" />
				</view>
			</view>
		</view>
	</view>
</template>
<script setup lang="ts">
// @ts-nocheck
import { computed, ref, inject } from "vue";
import CCard from "@/components/c-card/CCard.vue";

const props = defineProps<{ row: any; selected?: boolean }>();
// 从父级注入当前选中值（不触发整列表 diff）
const injectedCurrent = inject("CURRENT_WORK_ORDER_VALUE", ref(null)) as any;
const isMulti = inject("WORK_ORDER_MULTI", ref(false)) as any;
// 缓存主键，避免每次点击触发多余计算
const rowId = computed(
	() =>
		props.row?.id ||
		props.row?.taskNumber ||
		props.row?.workOrderNo ||
		props.row?.orderNo,
);
const isCurrent = computed(
	() =>
		injectedCurrent?.value &&
		(injectedCurrent.value === props.row?.taskNumber ||
			injectedCurrent.value === props.row?.workOrderNo ||
			injectedCurrent.value === props.row?.workOrder),
);
const emit = defineEmits<{ (e: "choose", row: any): void }>();

function onClick() {
	emit("choose", props.row);
}

function mapStatus(s: any) {
	if (s === 2 || s === "2") return "生产中";
	if (s === 1 || s === "1") return "未开始";
	if (s === 3 || s === "3") return "已完成";
	return "生产中";
}

const showMore = ref(false);
const COLLAPSE_COUNT = 4;
// 为减少点击后整卡重算带来的闪烁，拆分最易变更( showMore ) 与 rows 静态部分：
const baseRows = computed(() => [
	{
		label: "切割任务号",
		value:
			props.row.taskNumber ||
			props.row.workOrderNo ||
			props.row.workOrder ||
			props.row.orderNo ||
			props.row.shipNumber ||
			"-",
	},
	{ label: "项目号", value: props.row.shipNumber || "--" },
	{
		label: "批次号",
		value: props.row.productBatch || props.row.batchNumber || "--",
	},
	{
		label: "分段号",
		value: props.row.block || props.row.segmentNumber || "--",
	},
	{ label: "状态", value: mapStatus(props.row.status) },
	{ label: "钢板唯一码", value: props.row.pn || "--" },
	{ label: "物资编码", value: props.row.materialsCode || "--" },
	{ label: "物资名称", value: props.row.materialsName || "--" },
	{
		label: "规格型号",
		value: props.row.specifications || props.row.materialSpec || "--",
	},
]);
const totalCount = computed(() => baseRows.value.length);
const rowsToShow = computed(() =>
	showMore.value ? baseRows.value : baseRows.value.slice(0, COLLAPSE_COUNT),
);
const hasMore = computed(() => totalCount.value > COLLAPSE_COUNT);
function toggleMore() {
	showMore.value = !showMore.value;
}
</script>
<style scoped lang="scss">
.woi {
	position: relative;
}
.woi-card {
	border: 2px solid transparent;
	background: #fff;
	position: relative;
	overflow: hidden;
	transition: all 0.2s cubic-bezier(0.4, 0.1, 0.2, 1);
}
.woi-card::after {
	content: "";
	position: absolute;
	left: 0;
	top: 0;
	height: 3px;
	width: 100%;
	background: linear-gradient(
		90deg,
		var(--app-primary, #0b3d91),
		rgba(11, 61, 145, 0.35)
	);
	opacity: 0;
	transition: opacity 0.25s;
}
.woi-card.selected {
	border-color: var(--app-primary, #0b3d91);
	box-shadow:
		0 4px 14px -2px rgba(11, 61, 145, 0.25),
		0 2px 6px rgba(11, 61, 145, 0.15);
	background: linear-gradient(135deg, #fff 0%, #f5f9ff 100%);
}
.woi-card.selected::after {
	opacity: 1;
}
.woi--current .woi-card {
	border-color: rgba(11, 61, 145, 0.35);
}
.card-row {
	display: flex;
	align-items: center;
	padding: 6px 0;
	font-size: 13px;
}
.card-row + .card-row {
	border-top: 1px dashed #ebedf0;
}
.label {
	width: 88px;
	color: #303133;
	font-weight: 500;
}
.value {
	flex: 1;
	color: #1f2326;
	font-size: 13px;
	line-height: 1.4;
	word-break: break-all;
}
.more {
	margin-top: 4px;
	text-align: right;
	color: var(--app-primary, #0b3d91);
	font-size: 12px;
}
.corner {
	position: absolute;
	right: 8px;
	top: 8px;
	width: 22px;
	height: 22px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(11, 61, 145, 0.08);
	border-radius: 6px;
	backdrop-filter: saturate(180%) blur(4px);
	box-shadow: 0 0 0 1px rgba(11, 61, 145, 0.12);
}
.corner::before {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: 6px;
	background: linear-gradient(
		135deg,
		rgba(11, 61, 145, 0.35),
		rgba(11, 61, 145, 0.05)
	);
	opacity: 0.7;
}
.corner-icon {
	color: var(--app-primary, #0b3d91);
}
.corner-multi {
	position: absolute;
	right: 8px;
	top: 8px;
}
.corner-multi .chk {
	width: 30rpx;
	height: 30rpx;
	border: 2rpx solid rgba(11, 61, 145, 0.4);
	border-radius: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #fff;
	transition: all 0.2s;
}
.corner-multi .chk.on {
	background: var(--app-primary, #0b3d91);
	border-color: var(--app-primary, #0b3d91);
	box-shadow: 0 0 0 1px rgba(11, 61, 145, 0.4);
}
.corner-multi .chk .inner {
	display: flex;
}
</style>
