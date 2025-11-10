<template>
	<PageLayout :title="pageTitle" :show-back="true" :sticky-toolbar="true">
		<template #toolbar>
			<view class="wo-toolbar">
				<CTabs
					v-model="activeTabName"
					:tabs="tabs"
					type="line"
					:scrollable="'auto'"
					:lazy-render="true"
					:animated="true"
					:duration="0.25"
					@change="onTabChange"
				/>
				<!-- 搜索：sard 搜索组件 -->
				<sar-search
					v-model="searchValue"
					placeholder="输入工单号"
					shape="round"
					clearable
					:show-action="false"
				/>
				<!-- 二级状态 Tabs：按 source 与主类型切换对应字典 -->
				<CTabs
					v-if="statusTabs.length > 0"
					class="wo-status-tabs"
					v-model="activeStatusName"
					:tabs="statusTabs"
					type="line"
					:scrollable="true"
					:lazy-render="true"
					:animated="false"
					:duration="0.2"
					@change="onStatusChange"
				/>
				<!-- 二级状态 Tabs 使用 line 样式（不使用 card）；如需胶囊效果可后续自定义样式覆盖 -->
			</view>
		</template>

		<PullList
			ref="listRef"
			class="wo-pull-list"
			:request="request"
			:query="query"
			:page-size="pageSize"
			:auto-more="true"
			:immediate="false"
			:height="listHeight"
			@loaded="onLoaded"
			@error="onError"
		>
			<template #first-loading>
				<view class="wo-first-loading">加载工单中...</view>
			</template>
			<template #item="{ item, index }">
				<CCard
					:key="item.id || index"
					class="wo-card"
					:title="resolveCardTitle(item)"
					:extra="resolveCardExtra(item)"
					:variant="itemClosed(item) ? 'outline' : 'elevated'"
					:lines="resolveCardLines(item)"
					:line-clamp="5"
					:title-clamp="2"
					:actions="makeActions(item)"
					clickable
					@click="handleCardClick(item, $event)"
					@action="(payload) => handleActionClick(item, payload)"
				/>
			</template>
			<template #empty>
				<view class="empty-block"
					><text class="empty-text">暂无工单</text></view
				>
			</template>
			<template #error="{ retry }">
				<view class="wo-error" @click="retry()">加载失败，点击重试</view>
			</template>
			<template #finished>
				<view class="wo-finished">—— 已到底 ——</view>
			</template>
		</PullList>

		<!-- ==== 派工选择 弹层 (sard popout) ==== -->
		<CheckboxPopout
			v-model:visible="dispatchPopoutVisible"
			:before-close="beforeCloseDispatchPlan"
			:dispatchType="pendingDispatchType"
		/>

		<!-- ==== 接单 / 计划时间 选择弹层 (sard popout) ==== -->
		<DatePopout
			v-model:visible="showTime"
			title="选择计划时间"
			:before-close="beforeCloseTime"
		/>

		<!-- ==== 拒绝原因 弹层 (sard popout) 转单理由==== -->
		<TextareaPopout
			v-model:visible="showRemark"
			:reasonType="reasonType"
			:before-close="beforeCloseReject"
		/>

		<!-- ==== 审批 弹层 (sard popout) ==== -->
		<ApprovePopout
			v-model:visible="approvePopoutVisible"
			:order-id="approveContext.orderId"
			:equipment-name="approveContext.equipmentName"
			:before-close="beforeCloseApprove"
		/>
		<!-- ==== 保养 弹层 (sard popout) ==== -->
		<UpkeepPopout
			v-model:visible="upkeepPopoutVisible"
			:order-id="approveContext.orderId"
			:equipment-name="approveContext.equipmentName"
			:before-close="handleUpkeepBeforeClose"
		/>
		<!-- ==== 点检 弹层 (sard popout) ==== -->
		<InspectPopout
			v-model:visible="inspectPopoutVisible"
			:record-id="inspectContext?.id || ''"
			:mt-no="inspectContext?.mtNo || ''"
			:type="inspectContext?.type || ''"
			:equipment-name="inspectContext?.equipmentName || ''"
			:equipment-code="inspectContext?.equipmentCode || ''"
			:equipment-model="inspectContext?.equipmentModel || ''"
			:before-close="handleInspectBeforeClose"
		/>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck  初期放宽 TS
import { computed } from "vue";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import CTabs from "@/components/c-tabs/CTabs.vue";
import PullList from "@/components/pull-list/PullList.vue";
import CCard from "@/components/c-card/CCard.vue";
import CheckboxPopout from "./checkbox-popout/index.vue";
import DatePopout from "./date-popout/index.vue";
import TextareaPopout from "./textarea-popout/index.vue";
import ApprovePopout from "./approve-popout/index.vue";
import UpkeepPopout from "./upkeep-popout/index.vue";

import InspectPopout from "./inspect-popout/index.vue";
import { useOrderList } from "./hooks/useOrderList";

// 通过 hooks 抽离页面逻辑，保持当前组件专注于模板渲染
const {
	tabs,
	APPROVAL_RESULT_OPTIONS,
	source,
	activeTabName,
	activeStatusName,
	statusTabs,
	searchValue,
	query,
	listRef,
	listHeight,
	pageSize,
	request,
	onTabChange,
	onStatusChange,
	onLoaded,
	onError,
	resolveCardTitle,
	resolveCardExtra,
	resolveCardLines,
	itemClosed,
	makeActions,
	handleActionClick,
	handleCardClick,
	// dispatchSelected,
	dispatchPopoutVisible,
	dispatchOptions,
	// handleDispatchSelectionChange,
	// dispatchPlanDate,
	// dispatchPlanVisible,
	beforeCloseDispatchPlan,
	onDispatchPlanChange,
	tempPlanDate,
	showTime,
	beforeCloseTime,
	onPlanDateChange,
	remark,
	showRemark,
	beforeCloseReject,
	causeDetails,
	showCauseDetails,
	// beforeCloseTransfer,
	approvePopoutVisible,
	approveContext,
	beforeCloseApprove, // 维修
	upkeepPopoutVisible, // 维保
	handleUpkeepBeforeClose,
	inspectPopoutVisible,
	inspectContext,
	handleInspectBeforeClose,
	pendingDispatchType,
	reasonType, // ⭐ 添加 reasonType
} = useOrderList();

const pageTitle = computed(() =>
	source.value === "2" ? "我的工单" : "工单列表"
);
</script>

<style scoped lang="scss">
/* ===== 通用弹层样式（基于简易自实现遮罩） ===== */
.wo-popup-overlay {
	position: fixed;
	left: 0;
	top: 0;
	width: 100vw;
	height: 100vh;
	background: rgba(0, 0, 0, 0.45);
	display: flex;
	align-items: flex-end;
	justify-content: center;
	z-index: 1000;
}
.wo-popup {
	width: 100%;
	background: #fff;
	border-top-left-radius: 16px;
	border-top-right-radius: 16px;
	padding: 12px 16px 20px;
	max-height: 70vh;
	display: flex;
	flex-direction: column;
}
.wo-popup.small {
	max-height: 40vh;
}
.wo-popup-header {
	font-size: 15px;
	font-weight: 600;
	margin-bottom: 8px;
}
.wo-field-wrapper {
	flex: 1;
}
.wo-textarea {
	width: 100%;
	min-height: 140px;
	background: #f6f8fa;
	border-radius: 8px;
	padding: 10px 12px;
	font-size: 14px;
	box-sizing: border-box;
	line-height: 1.5;
}
.wo-popup-actions {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	margin-top: 12px;
}

:deep(.btn-primary) {
	--sar-button-bg: var(--app-primary, #0b3d91);
	--sar-button-color: #fff;
}

.wo-error,
.wo-finished {
	text-align: center;
	font-size: 12px;
	padding: 16px 0;
	color: #999;
}
.wo-error {
	color: #d93026;
}

:deep(.wo-popout-body) {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 12px 16px 20px;
}

:deep(.wo-textarea) {
	width: 100%;
	min-height: 140px;
	background: #f6f8fa;
	border-radius: 8px;
	padding: 10px 12px;
	font-size: 14px;
	box-sizing: border-box;
	line-height: 1.5;
	color: #1f2937;
}

:deep(.approval-popout) {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 12px 4px 4px;
}

:deep(.approval-popout__row) {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

:deep(.approval-popout__row--radio) {
	gap: 12px;
}

:deep(.approval-popout__row--textarea textarea) {
	min-height: 120px;
}

:deep(.approval-popout__label) {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 14px;
	font-weight: 600;
	color: #1f2937;
}

:deep(.approval-popout__label-required) {
	color: #ef4444;
	font-size: 16px;
}

:deep(.approval-popout__value) {
	font-size: 14px;
	color: #374151;
	word-break: break-all;
}

:deep(.approval-popout__radio-group) {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

:deep(.approval-popout__radio) {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border-radius: 10px;
	background: #f3f4f6;
}

:deep(.approval-popout__radio--success) {
	background: rgba(16, 185, 129, 0.12);
}

:deep(.approval-popout__radio--danger) {
	background: rgba(239, 68, 68, 0.12);
}

:deep(.approval-popout__radio-label) {
	font-size: 14px;
	color: #1f2937;
}

:deep(.approval-popout__radio-label--success) {
	color: #047857;
}

:deep(.approval-popout__radio-label--danger) {
	color: #b91c1c;
}

:deep(.approval-popout__textarea) {
	width: 100%;
	min-height: 120px;
	padding: 10px 12px;
	border-radius: 10px;
	background: #f9fafb;
	font-size: 14px;
	box-sizing: border-box;
	color: #1f2937;
}
</style>
