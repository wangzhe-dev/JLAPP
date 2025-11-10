<template>
	<PageLayout title="异常处理" :show-back="true" :sticky-toolbar="true">
		<!-- 顶部筛选 Tabs -->
		<template #toolbar>
			<view class="exd-toolbar">
				<CTabs
					v-model="activeStatus"
					:tabs="statusTabs"
					type="line"
					:scrollable="'auto'"
					:lazy-render="true"
					:animated="true"
					:duration="0.25"
					@change="onStatusChange"
				/>
			</view>
		</template>

		<!-- 列表部分 -->
		<PullList
			ref="listRef"
			class="exd-list"
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
				<view class="exd-loading">加载中...</view>
			</template>
			<template #item="{ item, index }">
				<CCard
					:key="item.id || index"
					class="exd-card"
					:title="item.documentNumber || '-'"
					:subtitle="item.sourceName || ''"
					:extra="formatTime(item.createdTime)"
					:variant="itemClosed(item) ? 'outline' : 'elevated'"
					:lines="resolveCardLines(item)"
					:line-clamp="6"
					:title-clamp="2"
					clickable
					:actions="makeActions(item)"
					@click="handleCardClick(item, $event)"
					@action="(payload) => handleActionClick(item, payload)"
				/>
			</template>
			<template #empty>
				<view class="exd-empty">暂无异常</view>
			</template>
			<template #error="{ retry }">
				<view class="exd-error" @click="retry()">加载失败，点击重试</view>
			</template>
			<template #finished>
				<view class="exd-finished">—— 已到底 ——</view>
			</template>
		</PullList>
		<!-- 驳回原因弹窗 -->
		<TextareaPopout
			v-model:visible="rejectPopoutVisible"
			:record-id="dispatchRecordId"
			:reason-type="reasonType"
			:before-close="handleRejectBeforeClose"
		/>
		<!-- 派工弹窗 -->
		<DispatchPopout
			v-model:visible="dispatchPopoutVisible"
			:work-group-code="dispatchGroupCode"
			:work-group-name="dispatchGroupName"
			:record-id="dispatchRecordId"
			:before-close="handleDispatchBeforeClose"
		/>
		<!-- 异常升级弹窗 -->
		<EscalatePopout
			v-model:visible="escalatePopoutVisible"
			:record-id="dispatchRecordId"
			:before-close="handleEscalateBeforeClose"
		/>
		<!-- 处理完成弹窗 -->
		<CompletePopout
			v-model:visible="completePopoutVisible"
			:record-id="dispatchRecordId"
			:before-close="handleCompleteBeforeClose"
		/>
		<!-- 转派弹窗 -->
		<TransferPopout
			v-model:visible="transferPopoutVisible"
			:work-group-code="dispatchGroupCode"
			:work-group-name="dispatchGroupName"
			:record-id="dispatchRecordId"
			:before-close="handleTransferBeforeClose"
		/>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, nextTick, computed, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import CTabs from "@/components/c-tabs/CTabs.vue";
import PullList from "@/components/pull-list/PullList.vue";
import CCard from "@/components/c-card/CCard.vue";
import { http } from "@/utils/request";
import { queryDictList as queryDictListBatch } from "@/api/dict";
import { confirmModal } from "@/utils/modal";
import TextareaPopout from "@/pages/orderList/textarea-popout/index.vue";
import TransferPopout from "./components/TransferPopout.vue";
import DispatchPopout from "./components/DispatchPopout.vue";
import CompletePopout from "./components/CompletePopout.vue";
import EscalatePopout from "./components/EscalatePopout.vue";
import { formatDate } from "sard-uniapp";

import {
	dispatchException,
	receiveException,
	reassignException,
	completeException,
	escalateException,
} from "@/api/exception";
import { EXCEPTION_LIST_REFRESH_KEY } from "@/pages/exceptionManagement/constants";
import { ensurePicturePreviewUrl, stripPictureBaseUrl } from "@/utils/picture";
// Tabs 状态 & 映射
const statusTabs = ref<Array<{ name: string; title: string }>>([]);
const statusLabelMap = ref<Record<string, string>>({});
const activeStatus = ref("0");
// 关键词搜索已移除

const query = ref({ documentStatus: "0" });
const pageSize = 10;
const listHeight = "auto";

const listRef = ref<any>();
const rejectPopoutVisible = ref(false);
const reasonType = ref<1 | 2>(1);
const rejectSubmitting = ref(false);
const dispatchPopoutVisible = ref(false);
const pendingDispatchItem = ref<any>(null);
const dispatchContext = ref<{
	id: string;
	groupCode: string;
	groupName: string;
} | null>(null);
const dispatchSubmitting = ref(false);
const dispatchGroupCode = computed(
	() => dispatchContext.value?.groupCode ?? ""
);
const dispatchGroupName = computed(
	() => dispatchContext.value?.groupName ?? ""
);
const dispatchRecordId = computed(() => dispatchContext.value?.id ?? "");
// 派工提交
const escalatePopoutVisible = ref(false);
// 异常升级提交
const escalateSubmitting = ref(false);
// 处理完成弹窗
const completePopoutVisible = ref(false);
// 处理完成提交
const completeSubmitting = ref(false);
// 转派弹窗
const receiving = ref(false);
// 转派提交
const transferPopoutVisible = ref(false);

// 初始化：加载状态字典
(async function init() {
	console.log("[exceptionDispose] init 开始执行");
	try {
		const data: any = await queryDictListBatch(["exception_handling_status"]);
		const arr = (data?.exception_handling_status || []).map((d: any) => ({
			name: String(d.dictValue),
			title: d.dictLabel,
		}));
		statusTabs.value = arr;
		statusLabelMap.value = arr.reduce((m, it) => {
			m[String(it.name)] = it.title;
			return m;
		}, {} as Record<string, string>);
		activeStatus.value = "0";
		console.log(
			"[exceptionDispose] 字典加载完成, activeStatus:",
			activeStatus.value
		);
	} catch {}
	// query 已经在声明时有正确的初始值 { documentStatus: "0" }
	// 不需要再次设置，避免触发 watch
	// 因为设置了 :immediate="false"，需要手动调用 reload
	nextTick(() => {
		console.log(
			"[exceptionDispose] nextTick 回调执行, listRef.value:",
			!!listRef.value
		);
		listRef.value?.reload?.();
	});
})();

function applyQuery() {
	console.log(
		"[exceptionDispose] applyQuery 被调用, activeStatus:",
		activeStatus.value
	);
	const status =
		activeStatus.value === undefined || activeStatus.value === null
			? ""
			: String(activeStatus.value);
	console.log(
		"[exceptionDispose] applyQuery 设置 query 前:",
		JSON.stringify(query.value)
	);
	query.value = { documentStatus: status };
	console.log(
		"[exceptionDispose] applyQuery 设置 query 后:",
		JSON.stringify(query.value)
	);
	// 不需要手动调用 reload，因为 PullList 的 watch 会自动监听 query 变化并触发 reload
}

onShow(() => {
	refreshListIfNeeded();
});

function refreshListIfNeeded() {
	let shouldRefresh = false;
	try {
		const flag = uni.getStorageSync(EXCEPTION_LIST_REFRESH_KEY);
		shouldRefresh = !!flag;
		if (flag !== undefined && flag !== null) {
			uni.removeStorageSync(EXCEPTION_LIST_REFRESH_KEY);
		}
	} catch (error) {
		console.warn("[exceptionDispose] refreshListIfNeeded failed", error);
	}
	if (shouldRefresh) {
		listRef.value?.reload?.();
	}
}

function onStatusChange(payload: { name: string }) {
	console.log("[exceptionDispose] onStatusChange 被调用, payload:", payload);
	if (payload?.name !== undefined) {
		activeStatus.value = String(payload.name ?? "");
	}
	applyQuery();
}

// PullList 请求适配：接收对象参数 { page, pageSize, query }
async function request(params: {
	page: number;
	pageSize: number;
	query: { documentStatus: string };
	signal?: AbortSignal;
}) {
	console.log("[exceptionDispose] request 被调用, params:", params);
	const { page, pageSize, query: q } = params;
	// 如果没有选中具体状态，则不传 documentStatus 让后端返回全部
	const payload: any = { pageNum: page, pageSize };
	const status =
		q?.documentStatus === undefined || q?.documentStatus === null
			? ""
			: String(q.documentStatus);
	if (status) {
		const numeric = Number(status);
		payload.documentStatus = Number.isNaN(numeric) ? status : numeric;
	} else {
		delete payload.documentStatus;
	}
	let res: any;
	try {
		res = await http.post<any>("/dispatch/exception/management/list", payload);
	} catch (e: any) {
		console.error("[exceptionDispose] request error", e);
		throw e;
	}
	// http.post 已经解包到 data 层（见 utils/request.ts），因此这里直接使用 res
	const data = res || {};
	const records = Array.isArray(data.records) ? data.records : [];
	const total = typeof data.total === "number" ? data.total : undefined;
	console.log(
		"[exceptionDispose] request 返回, records.length:",
		records.length,
		"total:",
		total
	);
	return { list: records, total };
}

function formatTime(
	v?: string | number,
	formatter = "YYYY-MM-DD HH:mm:ss"
): string {
	return v ? formatDate(new Date(v), formatter) : "-";
}
function itemClosed(item: any) {
	// 约定：40/50 等为已处理/完成，根据需要调整
	const code = Number(item?.documentStatus);
	return [40, 50, 60, 70, 80, 90].includes(code);
}
function toArray<T>(input: T | T[] | null | undefined): T[] {
	if (input === undefined || input === null) return [];
	return Array.isArray(input) ? input : [input];
}

function resolveCardLines(item: any) {
	const lines: Array<{
		label: string;
		value: string;
		state?: string;
		className?: string;
		style?: any;
	}> = [];
	const pushLine = (
		label: string,
		value: any,
		options?: { state?: string; className?: string; style?: any }
	) => {
		if (value === undefined || value === null) return;
		const str = typeof value === "string" ? value.trim() : String(value);
		if (!str) return;
		lines.push({
			label,
			value: str,
			state: options?.state,
			className: options?.className,
			style: options?.style,
		});
	};
	pushLine("异常大类", item?.typeParentName || "-");
	pushLine("异常小类", item?.typeName || "-");
	pushLine("呼叫人", item?.createdNameBy || "-");
	pushLine(
		"期望解决时间",
		formatTime(item?.expectedResolutionTime, "YYYY-MM-DD")
	);

	const pictureUrl = item?.exceptionPictureUrl;
	if (typeof pictureUrl === "string" && pictureUrl.trim()) {
		lines.push({
			label: "异常图片",
			type: "image-list",
			images: pictureUrl, // 直接传递字符串，由 CCard 内部处理
		});
	} else {
		lines.push({
			label: "异常图片",
			value: "-",
		});
	}

	pushLine("异常描述", item?.exceptionDesc || "-");
	return lines;
}
function mapStatusType(code: string) {
	// 可按真实枚举微调
	const n = Number(code);
	if ([40, 50, 60, 70, 80, 90].includes(n)) return "success";
	if ([20, 30].includes(n)) return "primary";
	if ([10].includes(n)) return "danger"; // 例：拒绝/驳回映射 10
	return "info";
}

const ACTION_PERMISSION_CONFIG: Array<{
	permission: number;
	code:
		| "dispatch"
		| "receive"
		| "transfer"
		| "reject"
		| "complete"
		| "escalate"
		| "approve"
		| "refuse";
	name: string;
	type: "primary" | "danger";
}> = [
	{ permission: 20, code: "dispatch", name: "派工", type: "primary" },
	{ permission: 30, code: "receive", name: "接收", type: "primary" },
	{ permission: 40, code: "transfer", name: "转派", type: "primary" },
	{ permission: 50, code: "reject", name: "拒绝", type: "danger" },
	{ permission: 60, code: "complete", name: "处理异常", type: "primary" },
	{ permission: 70, code: "escalate", name: "异常升级", type: "danger" },
	{ permission: 80, code: "approve", name: "通过", type: "primary" },
	{ permission: 90, code: "refuse", name: "驳回", type: "danger" },
];

// 打开派工弹层
function openDispatchDialog(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	const groupCode = item?.dispatchGroupCode || "";
	const groupName = item?.dispatchGroupName || "";
	dispatchContext.value = { id, groupCode, groupName };
	dispatchPopoutVisible.value = true;
}

// 异常升级弹层
function openEscalateDialog(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	const groupCode = item?.dispatchGroupCode || "";
	const groupName = item?.dispatchGroupName || "";
	dispatchContext.value = { id, groupCode, groupName };
	escalatePopoutVisible.value = true;
}
// 处理完成弹层
function openCompleteDialog(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	const groupCode = item?.dispatchGroupCode || "";
	const groupName = item?.dispatchGroupName || "";
	dispatchContext.value = { id, groupCode, groupName };
	completePopoutVisible.value = true;
}
// 通过按钮
async function runSimpleAction(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	try {
		await http.post("/dispatch/exception/management/passException", { id });
		uni.showToast({
			title: "操作成功",
			icon: "success",
		});
		listRef.value?.reload?.();
	} catch (error: any) {
		console.warn("[exceptionDispose] action failed", action, error);
		const msg = error?.msg || error?.message || "操作失败";
		uni.showToast({ title: msg, icon: "none" });
	}
}
// 驳回弹层&拒绝弹层
function openRejectDialog(code: "reject" | "refuse", item: any) {
	reasonType.value = code == "reject" ? 1 : 2;
	const id = item?.id != null ? String(item.id) : "";
	const groupCode = item?.dispatchGroupCode || "";
	const groupName = item?.dispatchGroupName || "";
	dispatchContext.value = { id, groupCode, groupName };
	rejectPopoutVisible.value = true;
}
// 驳回提交
async function handleRejectBeforeClose(
	payload?: { id: string; rejectReason: string },
	reasonTypeParam?: any
) {
	const resolvedReasonTypeRaw = reasonTypeParam ?? reasonType.value ?? 1;
	const resolvedReasonType = Number(resolvedReasonTypeRaw) === 2 ? 2 : 1;
	rejectSubmitting.value = true;
	try {
		let url =
			resolvedReasonType === 1
				? "/dispatch/exception/management/rejectException"
				: "/dispatch/exception/management/dismissException";
		await http.post(url, payload);
		uni.showToast({ title: "操作成功", icon: "success" });
		reasonType.value = 1;
		listRef.value?.reload?.();
		resetDispatchState();
		return true;
	} catch (error: any) {
		console.error("[exceptionDispose] reject failed", error);
		const msg = error?.msg || error?.message || "操作失败";
		uni.showToast({ title: msg, icon: "none" });
		return false;
	} finally {
		rejectSubmitting.value = false;
	}
}
// 异常升级提交
async function handleEscalateBeforeClose(payload?: {
	id: string;
	handleGroupCode: string;
	handleGroupName: string;
	handleP: string;
	handlePName: string;
	handleEdcCode: string;
	noticeContent: string;
	noticeType: string[];
}) {
	escalateSubmitting.value = true;
	uni.showLoading({ title: "提交中...", mask: true });

	try {
		await escalateException({
			...payload,
			noticeType: payload.noticeType.join(","),
		});
		uni.showToast({ title: "已升级", icon: "success" });
		escalatePopoutVisible.value = false;
		resetDispatchState();
		listRef.value?.reload?.();
		return true;
	} catch (error: any) {
		console.error("[exceptionDispose] escalate failed", error);
		const msg = error?.msg || error?.message || error?.raw?.msg || "升级失败";
		uni.showToast({ title: msg, icon: "none" });
		return false;
	} finally {
		escalateSubmitting.value = false;
		uni.hideLoading();
	}
}
// 按钮权限处理
function makeActions(item: any) {
	const arr: any[] = [];
	const permissions = item?.buttonPermissionList;
	for (const config of ACTION_PERMISSION_CONFIG) {
		if (showButton(permissions, config.permission)) {
			arr.push({
				name: config.name,
				code: config.code,
				type: config.type,
			});
		}
	}
	if (canEdit(item)) arr.push({ name: "修改", code: "edit", type: "primary" });
	if (canDelete(item))
		arr.push({ name: "删除", code: "delete", type: "danger" });
	canTJ(item) && arr.push({ name: "提交", code: "submit", type: "primary" });
	return arr;
}
function canEdit(item: any) {
	return showButton(item.buttonPermissionList, 0);
}
function canDelete(item: any) {
	return showButton(item.buttonPermissionList, 5);
}
function canTJ(item: any) {
	return showButton(item.buttonPermissionList, 10);
}
function showButton(arr: any, t: number) {
	const list = Array.isArray(arr) ? arr : [];
	const target = String(t);
	return list.some((item) => {
		if (item === t) return true;
		if (typeof item === "number") return item === t;
		if (typeof item === "string") {
			const trimmed = item.trim();
			if (!trimmed) return false;
			if (Number(trimmed) === t) return true;
			return trimmed === target;
		}
		return false;
	});
}

async function handleActionClick(cardItem: any, payload: any) {
	const actionCode =
		payload?.code === undefined || payload?.code === null
			? ""
			: String(payload.code);
	switch (actionCode) {
		case "edit":
			editItem(cardItem);
			break;
		case "delete":
			deleteItem(cardItem);
			break;
		case "submit":
			// 提交
			submitFn(cardItem);
			break;
		case "dispatch":
			openDispatchDialog(cardItem);
			break;
		case "transfer":
			openTransferDialog(cardItem);
			break;
		case "complete":
			openCompleteDialog(cardItem);
			break;
		case "escalate":
			openEscalateDialog(cardItem);
			break;
		case "approve": {
			const typeName = cardItem?.typeName
				? String(cardItem.typeName).trim()
				: "";
			const confirmText = typeName
				? `${typeName}，已处理完成，是否关闭？`
				: "该异常已处理完成，是否关闭？";
			const confirmed = await confirmModal({
				content: confirmText,
				lockKey: "exception-approve",
			});
			if (!confirmed) break;
			await runSimpleAction(cardItem);
			break;
		}
		case "receive":
			await confirmReceive(cardItem);
			break;
		case "reject":
		case "refuse":
			openRejectDialog(actionCode, cardItem);
			break;
		default:
			uni.showToast({ title: "暂不支持该操作", icon: "none" });
	}
}

function handleCardClick(item: any) {
	openDetail(item);
}

function editItem(item: any) {
	try {
		sessionStorage?.setItem?.("exceptionEdit", "true");
	} catch {}
	const id = item?.id != null ? String(item.id) : "";
	if (!id) return;
	// 跟随 /exceptionManagement/exceptionReport/index.vue 约定：携带 mode=edit 与 id
	uni.navigateTo({
		url: `/pages/exceptionManagement/exceptionReport/index?mode=edit&id=${encodeURIComponent(
			id
		)}`,
	});
}
// 提交函数
async function submitFn(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	if (!id) {
		uni.showToast({ title: "缺少记录标识", icon: "none" });
		return;
	}
	const confirmed = await confirmModal({
		content: "是否确认提交该数据?",
		lockKey: "exception-submit",
	});
	if (!confirmed) return;
	// 提交逻辑
	try {
		await http.post("/dispatch/exception/management/submit", { id });
		uni.showToast({ title: "已提交", icon: "success" });
		listRef.value?.reload?.();
	} catch (err) {
		console.error("[exceptionDispose] submit failed", err);
		uni.showToast({ title: "提交失败", icon: "none" });
	}
}
async function deleteItem(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	if (!id) {
		uni.showToast({ title: "缺少记录标识", icon: "none" });
		return;
	}
	const confirmed = await confirmModal({
		content: "是否确认删除该数据?",
		lockKey: "exception-delete",
	});
	if (!confirmed) return;
	try {
		await http.post("/dispatch/exception/management/delete", { id });
		uni.showToast({ title: "已删除", icon: "success" });
		applyQuery();
	} catch (err) {
		console.error("[exceptionDispose] delete failed", err);
		uni.showToast({ title: "删除失败", icon: "none" });
	}
}
function openDetail(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	if (!id) return;
	uni.navigateTo({
		url: `/pages/exceptionManagement/exceptionReportDetail/index?id=${encodeURIComponent(
			id
		)}`,
	});
}

function openTransferDialog(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	const groupCode = item?.dispatchGroupCode || "";
	const groupName = item?.dispatchGroupName || "";
	dispatchContext.value = { id, groupCode, groupName };
	transferPopoutVisible.value = true;
}

async function confirmReceive(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	if (receiving.value) return;
	receiving.value = true;
	try {
		await receiveException({ id });
		uni.showToast({ title: "已接收", icon: "success" });
		listRef.value?.reload?.();
	} catch (error: any) {
		console.error("[exceptionDispose] receive failed", error);
		const msg = error?.msg || error?.message || error?.raw?.msg || "接收失败";
		uni.showToast({ title: msg, icon: "none" });
	} finally {
		receiving.value = false;
	}
}

async function handleTransferBeforeClose(payload?: {
	id: string;
	handleGroupCode: string;
	handleGroupName: string;
	handleP: string;
	handlePName: string;
	handleEdcCode: string;
}) {
	const id = payload?.id ? String(payload.id).trim() : "";
	uni.showLoading({ title: "提交中...", mask: true });
	try {
		await reassignException({
			...payload,
			noticeType: payload.noticeType.join(","),
		});
		uni.showToast({ title: "已转派", icon: "success" });
		transferPopoutVisible.value = false;
		resetDispatchState();
		listRef.value?.reload?.();
		return true;
	} catch (error: any) {
		console.error("[exceptionDispose] transfer failed", error);
		const msg = error?.msg || "转派失败";
		uni.showToast({ title: msg, icon: "none" });
		return false;
	} finally {
		uni.hideLoading();
	}
}

async function handleDispatchBeforeClose(payload?: {
	id: string;
	handleGroupCode: string;
	handleGroupName: string;
	handleP: string;
	handlePName: string;
	handleEdcCode: string;
}) {
	if (dispatchSubmitting.value) return false;
	if (!payload) return false;
	dispatchSubmitting.value = true;
	uni.showLoading({ title: "提交中...", mask: true });
	try {
		await dispatchException(payload);
		uni.showToast({ title: "派工成功", icon: "success" });
		dispatchPopoutVisible.value = false;
		resetDispatchState();
		listRef.value?.reload?.();
		return true;
	} catch (error: any) {
		const msg = error?.msg || error?.message || error?.raw?.msg || "派工失败";
		uni.showToast({ title: msg, icon: "none" });
		return false;
	} finally {
		dispatchSubmitting.value = false;
		uni.hideLoading();
	}
}

function resetDispatchState() {
	pendingDispatchItem.value = null;
	dispatchContext.value = null;
	dispatchSubmitting.value = false;
}

async function handleCompleteBeforeClose(payload?: {
	id: string;
	solution: string;
	scenePictureUrl: any[];
}) {
	if (completeSubmitting.value) return false;
	if (!payload) return false;
	const id = payload.id ? String(payload.id).trim() : "";
	const solution = payload.solution ? String(payload.solution).trim() : "";
	const sceneUrls = extractUploadUrls(payload.scenePictureUrl || []);
	completeSubmitting.value = true;
	uni.showLoading({ title: "提交中...", mask: true });
	try {
		await completeException({
			id,
			solution,
			scenePictureUrl: sceneUrls.join(","),
		});
		uni.showToast({ title: "已处理完成", icon: "success" });
		completePopoutVisible.value = false;
		listRef.value?.reload?.();
		return true;
	} catch (error: any) {
		console.error("[exceptionDispose] complete failed", error);
		const msg = error?.msg || error?.message || error?.raw?.msg || "处理失败";
		uni.showToast({ title: msg, icon: "none" });
		return false;
	} finally {
		completeSubmitting.value = false;
		uni.hideLoading();
	}
}

// 提取上传图片的 URL 列表
function extractUploadUrls(list: any[]): string[] {
	if (!Array.isArray(list)) return [];
	return list
		.map((item) => {
			if (!item) return "";
			const raw =
				typeof item === "string"
					? item
					: item?.url || item?.resultUrl || item?.originUrl || item?.value || "";
			return stripPictureBaseUrl(raw);
		})
		.map((item) => String(item).trim())
		.filter((item) => !!item);
}
</script>

<style scoped lang="scss">
.exd-toolbar {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-bottom: 4px;
}
.exd-loading {
	text-align: center;
	color: #666;
	font-size: 14px;
}
.exd-card :deep(.c-card__title) {
	font-weight: 600;
}
.exd-empty,
.exd-error,
.exd-finished {
	text-align: center;
	color: #999;
	font-size: 12px;
	padding: 16px 0;
}
</style>
