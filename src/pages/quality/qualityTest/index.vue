<template>
	<PageLayout title="质量检测" :show-back="true" :sticky-toolbar="true">
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

		<!-- 列表部分（精简版，无图片缩略/自定义旧样式） -->
		<PullList
			ref="listRef"
			class="exd-list"
			:request="request"
			:query="query"
			:page-size="pageSize"
			:auto-more="true"
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
				:class="['quality-card', getCardStatusClass(item)]"
				clickable
				:actions="makeActions(item)"
				@click="openDetail(item)"

				@action="(payload) => handleActionClick(item, payload)"
			>
				<view class="quality-card__rows">
					<view
						v-for="(row, rowIndex) in buildDetailRows(item)"
						:key="rowIndex"
						class="quality-card__row"
				>
						<text class="quality-card__label">{{ row.label }}</text>
						<text
							:class="[
								'quality-card__value',
								row.chip ? 'quality-card__value--chip' : '',
								row.tone ? `quality-card__value--${row.tone}` : '',
							]"
						>
							{{ row.value }}
						</text>
					</view>
				</view>
			</CCard>
			</template>

			<template #empty>
				<view class="exd-empty">暂无质检记录</view>
			</template>
			<template #error="{ retry }">
				<view class="exd-error" @click="retry()">加载失败，点击重试</view>
			</template>
			<template #finished>
				<view class="exd-finished">—— 已到底 ——</view>
			</template>
		</PullList>

		<sar-popout
			v-model:visible="fillPopoutVisible"
			title="检验填报"
			:before-close="beforeCloseFillPopout"
		>
			<view class="inspection-popout">
				<view class="inspection-popout__row">
					<text class="inspection-popout__label">质检单号</text>
					<text class="inspection-popout__value">
						{{ fillPopout.sheetNo }}
					</text>
				</view>
				<view class="inspection-popout__row">
					<text class="inspection-popout__label">工序名称</text>
					<text class="inspection-popout__value">
						{{ fillPopout.processName }}
					</text>
				</view>
				<view class="inspection-popout__row inspection-popout__row--radio">
					<text class="inspection-popout__label">
						<text class="inspection-popout__label-required">*</text>
						检验结果
					</text>
					<radio-group
						class="inspection-popout__radio-group"
						@change="onFillResultChange"
					>
						<label
							v-for="option in INSPECTION_RESULT_OPTIONS"
							:key="option.value"
							:class="[
								'inspection-popout__radio',
								fillPopoutSelection === option.value
									? `inspection-popout__radio--${option.tone}`
									: '',
							]"
						>
							<radio
								:value="option.value"
								:checked="fillPopoutSelection === option.value"
								color="#2563eb"
							/>
							<text
								:class="[
									'inspection-popout__radio-label',
									fillPopoutSelection === option.value
										? `inspection-popout__radio-label--${option.tone}`
										: '',
								]"
							>
								{{ option.label }}
							</text>
						</label>
					</radio-group>
				</view>
			</view>
		</sar-popout>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, nextTick, watch } from "vue";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import CTabs from "@/components/c-tabs/CTabs.vue";
import PullList from "@/components/pull-list/PullList.vue";
import CCard from "@/components/c-card/CCard.vue";
import { http } from "@/utils/request";
import { queryDictList as queryDictListBatch } from "@/api/dict";
import { postAction } from "@/network/manage";
import { confirmModal } from "@/utils/modal";
// Tabs 状态 & 映射
const statusTabs = ref<Array<{ name: string; title: string }>>([]);
const statusLabelMap = ref<Record<string, string>>({});
const ruleTypeLabelMap = ref<Record<string, string>>({});
const INSPECTION_FORM_LABELS = Object.freeze({
	"0": "合格",
	"1": "不合格",
});
const INSPECTION_RESULT_OPTIONS = Object.freeze([
	{ value: "0", label: "合格", tone: "pass" },
	{ value: "1", label: "不合格", tone: "fail" },
]);
const activeStatus = ref("0");
// 关键词搜索已移除

// 查询对象：确保引用变更触发 PullList 刷新
const query = ref({ fillStatus: "" });
const pageSize = 10;
const listHeight = "auto";

// List 引用
const listRef = ref<any>();
const fillPopoutVisible = ref(false);
const fillPopoutLoading = ref(false);
const fillPopoutItem = ref<any>(null);
const fillPopout = ref<{
	sheetNo: string;
	processName: string;
	result: string;
	tone: string;
}>({
	sheetNo: "-",
	processName: "-",
	result: "-",
	tone: "",
});
const fillPopoutSelection = ref<string>("");

watch(fillPopoutVisible, (visible) => {
	if (!visible) {
		fillPopoutItem.value = null;
		fillPopoutLoading.value = false;
		fillPopout.value = {
			sheetNo: "-",
			processName: "-",
			result: "-",
			tone: "",
		};
		fillPopoutSelection.value = "";
	}
});

// 初始化：加载状态字典
(async function init() {
	try {
		const data: any = await queryDictListBatch([
			"fillin_status",
			"rule_type",
		]);
		const arr = (data?.fillin_status || []).map((d: any) => ({
			name: String(d.dictValue),
			title: d.dictLabel,
		}));
		if (!arr.some((it) => it.name === "")) {
			arr.unshift({ name: "", title: "全部" });
		}
		statusTabs.value = arr;
		statusLabelMap.value = arr.reduce((m, it) => {
			m[String(it.name)] = it.title;
			return m;
		}, {} as Record<string, string>);
		if (arr.length) {
			activeStatus.value = String(arr[0].name ?? "");
		}
		if (Array.isArray(data?.rule_type)) {
			ruleTypeLabelMap.value = data.rule_type.reduce(
				(map: Record<string, string>, item: any) => {
					const key = String(item.dictValue ?? "");
					if (key) map[key] = item.dictLabel ?? "";
					return map;
				},
				{} as Record<string, string>
			);
		}
	} catch {}
	applyQuery();
})();

function applyQuery(activeOverride?: unknown) {
	const activeToUse = resolveActiveKey(
		activeOverride !== undefined ? activeOverride : activeStatus.value
	);
	if (activeOverride !== undefined) {
		activeStatus.value = activeToUse;
	}
	const mapped = mapActiveToFillStatus(activeToUse);
	query.value = { fillStatus: mapped };
	nextTick(() => listRef.value?.reload?.());
}

function onStatusChange(newVal: unknown) {
	applyQuery(newVal);
}

/**
 * CTabs change 事件可能传入字符串或整个 tab 对象。
 * 这里统一提取可用于后端的 key。
 */
function resolveActiveKey(raw: unknown): string {
	if (raw === null || raw === undefined) return "";
	if (typeof raw === "object") {
		const obj = raw as Record<string, any>;
		const candidate =
			obj.name ?? obj.value ?? obj.dictValue ?? obj.key ?? obj.id ?? "";
		return candidate === null || candidate === undefined
			? ""
			: String(candidate);
	}
	return String(raw);
}

/**
 * 将已经解析出的 active key 映射为后端期望的 fillStatus。
 */
function mapActiveToFillStatus(key: string) {
	if (key === "" || key === "全部") return "";
	if (key === "1" || key === "待检验") return "1";
	if (key === "3" || key === "已检验") return "3";
	return key;
}

// PullList 请求适配
async function request(params: {
	page: number;
	pageSize: number;
	query: { fillStatus: string };
	signal?: AbortSignal;
}) {
	const { page, pageSize: size, query: q } = params;
	const payload: any = { pageNum: page, pageSize: size };
	const status = q?.fillStatus ?? activeStatus.value;
	if (status !== undefined && status !== null && status !== "") {
		payload.fillStatus = status;
	}
	let res: any;
	try {
		res = await http.post<any>("/quality/paintingFill/findAllList", payload);
	} catch (e: any) {
		console.error("[qualityTest] request error", e);
		throw e;
	}
	const data = res || {};
	const records = Array.isArray(data.records) ? data.records : [];
	const total = typeof data.total === "number" ? data.total : undefined;
	return { list: records, total };
}

function resolveField(
	source: Record<string, any> | null | undefined,
	candidates: string[],
	fallback: any = ""
) {
	if (!source || typeof source !== "object") return fallback;
	const keys = Array.isArray(candidates) ? candidates : [candidates];
	for (const key of keys) {
		if (!key) continue;
		const segments = String(key).split(".");
		let current: any = source;
		for (const seg of segments) {
			if (current == null) break;
			current = current[seg];
		}
		if (current !== undefined && current !== null && current !== "") {
			return current;
		}
	}
	return fallback;
}

function formatDictValue(
	value: unknown,
	dict: Record<string, string> | undefined | null,
	fallback = "-"
) {
	if (!dict) return fallback;
	const key = value !== undefined && value !== null ? String(value) : "";
	if (!key) return fallback;
	const label = dict[key];
	return label !== undefined && label !== "" ? label : fallback;
}

function normalizeValue(val: any, fallback = "-") {
	if (val === undefined || val === null || val === "") return fallback;
	if (typeof val === "number") return String(val);
	if (typeof val === "string") return val;
	if (typeof val === "boolean") return val ? "是" : "否";
	try {
		return String(val);
	} catch {
		return fallback;
	}
}

function getFillStatusValue(item: any): string {
	const raw =
		item?.fillStatus ?? resolveField(item, ["fillStatus", "status", "fillStatusCode"], "");
	if (raw === undefined || raw === null || raw === "") return "";
	return String(raw);
}

function getFillStatusLabel(item: any): string {
	const code = getFillStatusValue(item);
	if (!code) return "--";
	const label = statusLabelMap.value[code];
	if (label) return label;
	switch (code) {
		case "1":
			return "待检验";
		case "3":
			return "已检验";
		default:
			return code;
	}
}

function getCardStatusClass(item: any): string {
	const code = getFillStatusValue(item);
	if (code === "1") return "quality-card--pending";
	if (code === "3") return "quality-card--done";
	return "quality-card--rest";
}

function getFillStatusTone(item: any): string {
	const code = getFillStatusValue(item);
	if (code === "1") return "pending";
	if (code === "3") return "done";
	return "rest";
}

function shouldUseSpecialFill(item: any): boolean {
	const raw = resolveField(item, ["inspectionForm"]);
	if (raw === undefined || raw === null || raw === "") return false;
	return String(raw).trim() === "3";
}

function resolveQualityInspectionNumber(item: any): string {
	return normalizeValue(
		resolveField(item, [
			"qualityInspectionNumber",
			"inspectionSheetNo",
			"qualitySheetNo",
			"inspectionNo",
			"sheetNo",
			"testSheetNo",
			"testNo",
		]),
		"-"
	);
}

function resolveProcessName(item: any): string {
	return normalizeValue(
		resolveField(item, [
			"processName",
			"processDesc",
			"processTitle",
			"processCodeName",
			"processCode",
		]),
		"-"
	);
}

function getInspectionResultMeta(item: any) {
	const raw = resolveField(item, ["testConclusion"]);
	const code =
		raw === undefined || raw === null ? "" : String(raw).trim();
	const label = normalizeValue(
		formatDictValue(code, INSPECTION_FORM_LABELS, code || "-")
	);
	const normalizedCode = code.replace(/\s/g, "");
	const compactLabel = label.replace(/\s/g, "");
	const upperLabel = compactLabel.toUpperCase();
	let tone = "";
	let value = "";
	if (
		normalizedCode === "0" ||
		compactLabel === "合格" ||
		upperLabel === "OK"
	) {
		tone = "pass";
		value = "0";
	} else if (
		normalizedCode === "1" ||
		compactLabel === "不合格" ||
		upperLabel === "NG"
	) {
		tone = "fail";
		value = "1";
	}
	if (!value) {
		const matched = INSPECTION_RESULT_OPTIONS.find(
			(option) =>
				option.label.replace(/\s/g, "") === compactLabel ||
				option.value === normalizedCode
		);
		if (matched) {
			value = matched.value;
			if (!tone) tone = matched.tone;
		}
	}
	return { label, tone, value };
}

function buildDetailRows(item: any) {
	const inspection = getInspectionResultMeta(item);
	return [
		{
			label: "加工单号",
			value:
				normalizeValue(
					resolveField(item, ["workOrderNum", "workOrderNo", "taskNumber"])
				),
		},
		{
			label: "状态",
			value: getFillStatusLabel(item),
			tone: getFillStatusTone(item),
			chip: true,
		},
		{
			label: "产线名称",
			value: normalizeValue(resolveField(item, ["productLineName"])),
		},
		{
			label: "工序",
			value: normalizeValue(resolveField(item, ["processCode"])),
		},
		{
			label: "船号",
			value: normalizeValue(
				resolveField(item, ["shipNo", "shipNumber", "shipName"])
			),
		},
		{
			label: "分段号",
			value: normalizeValue(resolveField(item, ["blockCode"])),
		},
		{
			label: "检验形式",
			value: normalizeValue(
				formatDictValue(
					resolveField(item, ["inspectionForm"]),
					ruleTypeLabelMap.value
				)
			),
			tone: "info",
			chip: true,
		},
		{
			label: "检验结果",
			value: inspection.label,
			tone: inspection.tone,
			chip: true,
		},
	];
}

function makeActions(item: any) {
	const actions: Array<{ name: string; code: string; type: string }> = [];
	if (getFillStatusValue(item) !== "3") {
		actions.push({ name: "填 报", code: "edit", type: "primary" });
	}
	actions.push({ name: "删 除", code: "delete", type: "danger" });
	return actions;
}

function openFillPopout(item: any) {
	fillPopoutItem.value = item;
	fillPopoutLoading.value = false;
	const meta = getInspectionResultMeta(item);
	fillPopout.value = {
		sheetNo: resolveQualityInspectionNumber(item),
		processName: resolveProcessName(item),
		result: meta.label,
		tone: meta.tone || "",
	};
	applyFillResult(meta.value || "");
	fillPopoutVisible.value = true;
}

function applyFillResult(rawValue: string) {
	const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);
	fillPopoutSelection.value = value;
	const option = INSPECTION_RESULT_OPTIONS.find((opt) => opt.value === value);
	const next = {
		...fillPopout.value,
	};
	if (option) {
		next.result = option.label;
		next.tone = option.tone;
	} else {
		next.tone = "";
		if (!next.result || next.result === "-") {
			next.result = "-";
		}
	}
	fillPopout.value = next;
}

function onFillResultChange(event: any) {
	const detailValue =
		event?.detail?.value !== undefined && event?.detail?.value !== null
			? String(event.detail.value)
			: "";
	applyFillResult(detailValue);
}

function onCardAction(cardItem: any, { code }: any) {
	if (code === "edit") {
		editItem(cardItem);
	} else if (code === "delete") {
		deleteItem(cardItem);
	}
}

function handleActionClick(cardItem: any, payload: any) {
	if (payload?.ev) {
		try {
			if (typeof payload.ev.stopPropagation === "function")
				payload.ev.stopPropagation();
			if (typeof payload.ev.preventDefault === "function")
				payload.ev.preventDefault();
			if (
				payload.ev.detail &&
				typeof payload.ev.detail.stopPropagation === "function"
			)
				payload.ev.detail.stopPropagation();
			if (payload.ev.mp && typeof payload.ev.mp.stopPropagation === "function")
				payload.ev.mp.stopPropagation();
		} catch {}
	}
	onCardAction(cardItem, payload || {});
}

function editItem(item: any) {
	if (shouldUseSpecialFill(item)) {
		openFillPopout(item);
		return;
	}else{
  uni.navigateTo({
		url: `/pages/quality/qualityFill`,
		// url: `/pages/quality/qualityFill/index?mode=edit&id=${encodeURIComponent(item.id)}`,
	});

  }
	try {
		sessionStorage?.setItem?.("exceptionEdit", "true");
	} catch {}
	const id = item?.id != null ? String(item.id) : "";
	if (!id) return;
	// 跟随 /exceptionManagement/exceptionReport/index.vue 约定：携带 mode=edit 与 id
	uni.navigateTo({
		url: `/pages/quality/qualityFill?mode=edit&id=${encodeURIComponent(id)}`,
	});
}

async function beforeCloseFillPopout(type: "confirm" | "cancel" | "close") {
	if (type !== "confirm") {
		if (fillPopoutLoading.value) return false;
		return true;
	}
	const item = fillPopoutItem.value;
	if (!item) return true;
	const id = item?.id;
	if (id === undefined || id === null || id === "") {
		uni.showToast({ title: "缺少关联数据", icon: "none" });
		return false;
	}
	const selectedResult = fillPopoutSelection.value;
	if (!selectedResult) {
		uni.showToast({ title: "请选择检验结果", icon: "none" });
		return false;
	}
	const qualityInspectionNumber = resolveField(
		item,
		[
			"qualityInspectionNumber",
			"inspectionSheetNo",
			"qualitySheetNo",
			"inspectionNo",
			"sheetNo",
			"testSheetNo",
			"testNo",
		],
		""
	);
	const processNameRaw = resolveField(
		item,
		[
			"processName",
			"processDesc",
			"processTitle",
			"processCodeName",
			"processCode",
		],
		""
	);
	const payload: Record<string, any> = {
		id,
		qualityInspectionNumber,
		processName: processNameRaw,
		testConclusion: selectedResult,
	};
	fillPopoutLoading.value = true;
	try {
		await postAction("/quality/paintingFill/edit", payload);
		uni.showToast({ title: "保存成功", icon: "success" });
		fillPopoutItem.value = null;
		nextTick(() => listRef.value?.reload?.());
		return true;
	} catch (error) {
		console.error("[qualityTest] save fill error", error);
		uni.showToast({ title: "保存失败", icon: "none" });
		return false;
	} finally {
		fillPopoutLoading.value = false;
	}
}
async function deleteItem(item: any) {
	const id = item?.id;
	if (id === undefined || id === null) return;
	const confirmed = await confirmModal({
		content: "是否确认删除该数据?",
		lockKey: "quality-paint-delete",
	});
	if (!confirmed) return;
	postAction("/quality/paintingFill/delById", { id })
		.then(() => applyQuery())
		.catch((error: unknown) => {
			console.error("[qualityTest] 删除失败", error);
		});
}
function openDetail(item: any) {
	const id = item?.id != null ? String(item.id) : "";
	if (!id) return;
	uni.navigateTo({
		url: `/pages/quality/qualityFill?mode=view&id=${encodeURIComponent(id)}`,
	});
}

// 已去除图片处理逻辑

// PullList 事件透传（按需扩展埋点等）
function onLoaded() {}
function onError() {}
</script>

<style scoped lang="scss">
.exd-toolbar {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 12px 20rpx 0;
}
.exd-loading {
	text-align: center;
	color: #64748b;
	font-size: 14px;
	letter-spacing: 0.5px;
}
.exd-list {
	padding: 0 24rpx 32rpx;
	// background: linear-gradient(180deg, #f7faff 0%, #ffffff 42%, #f9fbff 100%);
}
.exd-list :deep(.pl-list) {
	gap: 24rpx;
	padding: 16rpx 0 36rpx;
}
.quality-card {
	position: relative;
}
.quality-card :deep(.c-card) {
	position: relative;
	border: 2rpx solid transparent;
	background: #ffffff;
	box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, 0.08);
	border-radius: 18rpx;
	overflow: hidden;
	transition:
		box-shadow 0.2s cubic-bezier(0.4, 0.1, 0.2, 1),
		transform 0.18s cubic-bezier(0.4, 0.1, 0.2, 1);
}
.quality-card :deep(.c-card)::before {
	content: "";
	position: absolute;
	inset: 4rpx;
	border-radius: 14rpx;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	pointer-events: none;
}
.quality-card :deep(.c-card)::after {
	content: "";
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 6rpx;
	background: linear-gradient(
		90deg,
		rgba(148, 163, 184, 0.65),
		rgba(148, 163, 184, 0.25)
	);
	opacity: 0;
	transition: opacity 0.25s ease;
}
.quality-card :deep(.c-card__body) {
	padding: 28rpx 32rpx;
}
.quality-card :deep(.c-card:hover) {
	box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.16);
	transform: translateY(-2rpx);
}
.quality-card--pending :deep(.c-card) {
	border-color: rgba(31, 135, 242, 0.4);
	box-shadow: 0 8rpx 22rpx rgba(31, 135, 242, 0.16);
	background: linear-gradient(135deg, #ffffff 0%, rgba(238, 248, 255, 0.94) 100%);
}
.quality-card--pending :deep(.c-card)::after {
	background: linear-gradient(90deg, rgba(31, 135, 242, 0.85), rgba(31, 135, 242, 0.35));
	opacity: 1;
}
.quality-card--pending :deep(.c-card)::before {
	border-color: rgba(31, 135, 242, 0.22);
}
.quality-card--done :deep(.c-card) {
	border-color: rgba(34, 197, 94, 0.38);
	box-shadow: 0 8rpx 22rpx rgba(34, 197, 94, 0.18);
	background: linear-gradient(135deg, #ffffff 0%, rgba(240, 253, 244, 0.94) 100%);
}
.quality-card--done :deep(.c-card)::after {
	background: linear-gradient(90deg, rgba(34, 197, 94, 0.85), rgba(34, 197, 94, 0.35));
	opacity: 1;
}
.quality-card--done :deep(.c-card)::before {
	border-color: rgba(34, 197, 94, 0.24);
}
.quality-card--rest :deep(.c-card) {
	border-color: rgba(226, 232, 240, 0.9);
	box-shadow: 0 6rpx 16rpx rgba(100, 116, 139, 0.14);
}
.quality-card--rest :deep(.c-card)::before {
	border-color: rgba(148, 163, 184, 0.26);
}
.quality-card__rows {
	display: flex;
	flex-direction: column;
	gap: 0;
}
.quality-card__row {
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
	padding: 18rpx 0;
	font-size: 26rpx;
}
.quality-card__row + .quality-card__row {
	border-top: 1rpx dashed #ebedf0;
}
.quality-card__label {
	width: 180rpx;
	color: #303133;
	font-weight: 600;
	white-space: nowrap;
}
.quality-card__value {
	// flex: 1;
	color: #1f2326;
	line-height: 1.5;
	font-weight: 500;
	word-break: break-all;
}
.quality-card__value--chip {
	display: inline-flex;
	align-items: center;
	gap: 6rpx;
	padding: 6rpx 22rpx;
	border-radius: 999rpx;
	background: rgba(148, 163, 184, 0.14);
	border: 1rpx solid rgba(148, 163, 184, 0.28);
	color: #475569;
	line-height: 1.3;
	font-weight: 600;
	letter-spacing: 1rpx;
	box-sizing: border-box;
}
.quality-card__value--pending {
	color: #1f87f2;
	font-weight: 600;
}
.quality-card__value--done {
	color: #15803d;
	font-weight: 600;
}
.quality-card__value--info {
	color: #1f2937;
	font-weight: 600;
}
.quality-card__value--rest {
	color: #475569;
	font-weight: 600;
}
.quality-card__value--pass {
	color: #15803d;
	font-weight: 600;
}
.quality-card__value--fail {
	color: #dc2626;
	font-weight: 600;
}
.quality-card__value--chip.quality-card__value--pending {
	color: #0f62b6;
	background: rgba(31, 135, 242, 0.15);
	border-color: rgba(31, 135, 242, 0.32);
}
.quality-card__value--chip.quality-card__value--done {
	color: #166534;
	background: rgba(34, 197, 94, 0.18);
	border-color: rgba(34, 197, 94, 0.45);
}
.quality-card__value--chip.quality-card__value--rest {
	color: #475569;
	background: rgba(148, 163, 184, 0.18);
	border-color: rgba(148, 163, 184, 0.35);
}
.quality-card__value--chip.quality-card__value--pass {
	color: #166534;
	background: rgba(34, 197, 94, 0.18);
	border-color: rgba(34, 197, 94, 0.45);
}
.quality-card__value--chip.quality-card__value--fail {
	color: #b91c1c;
	background: rgba(248, 113, 113, 0.16);
	border-color: rgba(220, 38, 38, 0.42);
}
.quality-card__value--chip.quality-card__value--info {
	color: #0f172a;
	background: rgba(99, 102, 241, 0.12);
	border-color: rgba(99, 102, 241, 0.28);
}
.inspection-popout {
	padding: 32rpx 36rpx 40rpx;
	display: flex;
	flex-direction: column;
	gap: 28rpx;
}
.inspection-popout__row {
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
	font-size: 28rpx;
}
.inspection-popout__row--radio {
	align-items: center;
	gap: 16rpx;
}
.inspection-popout__label {
	width: 200rpx;
	color: #475569;
	font-weight: 600;
	white-space: nowrap;
}
.inspection-popout__label-required {
	display: inline-block;
	color: #dc2626;
	margin-right: 8rpx;
}
.inspection-popout__value {
	flex: 1;
	color: #1f2937;
	font-weight: 500;
	line-height: 1.5;
	word-break: break-all;
}
.inspection-popout__value--pass {
	color: #15803d;
	font-weight: 600;
}
.inspection-popout__value--fail {
	color: #dc2626;
	font-weight: 600;
}
.inspection-popout__radio-group {
	display: flex;
	flex: 1;
	flex-wrap: wrap;
	gap: 24rpx;
	align-items: center;
	padding-top: 0;
}
.inspection-popout__radio {
	display: inline-flex;
	align-items: center;
	gap: 12rpx;
	padding: 8rpx 16rpx;
	border-radius: 16rpx;
	background: #f8fafc;
}
.inspection-popout__radio--pass {
	background: rgba(34, 197, 94, 0.12);
}
.inspection-popout__radio--fail {
	background: rgba(220, 38, 38, 0.12);
}
.inspection-popout__radio-label {
	color: #1f2937;
	font-weight: 500;
}
.inspection-popout__radio-label--pass {
	color: #15803d;
	font-weight: 600;
}
.inspection-popout__radio-label--fail {
	color: #dc2626;
	font-weight: 600;
}
.exd-empty,
.exd-error,
.exd-finished {
	text-align: center;
	color: #94a3b8;
	font-size: 24rpx;
	padding: 20px 0;
	letter-spacing: 1rpx;
}
</style>
