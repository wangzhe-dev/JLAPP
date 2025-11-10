<!--
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-09-20 15:16:10
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-11-03 10:19:34
 * @FilePath: /NEWAPP/src/pages/workOrderDetail/index.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<template>
	<PageLayout title="维修工单详情" :show-back="true">
		<view class="wod-container">
			<view v-if="detailLoaded" class="wod-body">
				<view class="wod-status-bar">
					<text class="wod-status__label">工单状态</text>
					<text :class="['wod-status__chip', statusStateClass]">{{
						statusText || "-"
					}}</text>
				</view>

				<CForm v-model="form" :schema="schemaRef">
					<template v-if="dispatchRecords.length" #dispatchRecords>
						<div class="wod-slot-cards">
							<CCard
								v-for="(record, index) in dispatchRecords"
								:key="record.id || record.dispatchId || index"
								variant="outline"
								:title="record.isPass"
								:extra="record.createdTime"
								:lines="resolveDispatchLines(record)"
							/>
						</div>
					</template>
					<template v-if="repairRecords.length" #repairRecords>
						<div class="wod-slot-cards">
							<CCard
								v-for="(record, index) in repairRecords"
								:key="record.id || record.repairId || index"
								variant="outline"
								:title="record.equipmentName"
								:extra="formatRecordTime(record.createdTime)"
								:lines="resolveRepairLines(record)"
							/>
						</div>
					</template>
					<template v-if="auditRecords.length" #auditRecords>
						<div class="wod-slot-cards">
							<CCard
								v-for="(record, index) in auditRecords"
								:key="record.id || record.auditId || index"
								variant="outline"
								:lines="resolveAuditLines(record)"
							/>
						</div>
					</template>
				</CForm>
			</view>

			<view v-else class="wod-loading">详情加载中...</view>
		</view>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, reactive, ref } from "vue";
import { onLoad, onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import type { CFormSchema, CFormSchemaField } from "@/components/c-form/types";
import CCard from "@/components/c-card/CCard.vue";
import { orderListDetail, getRepairMessage } from "@/api/order";
import { queryDictList } from "@/api/dict";
import { ensurePicturePreviewUrl } from "@/utils/picture";
import { resolveStatusState } from "@/utils/status";
import { http } from "@/utils/request";
import { formatDateTime } from "@/utils/date";
import { pad } from "@/utils/format";
function toArray<T>(input: T | T[] | null | undefined): T[] {
	if (!input) return [];
	return Array.isArray(input) ? input : [input];
}

const form = ref<Record<string, any>>({
	orderCode: "",
	faultTypeCode: "",
	faultTypeDesc: "",
});

const id = ref<string>("");
const source = ref<string>("1");
const detailLoaded = ref<boolean>(false);
const statusDict = ref<Array<{ dictValue: string; dictLabel: string }>>([]);
const dispatchRecords = ref<any[]>([]);
const repairRecords = ref<any[]>([]);
const auditRecords = ref<any[]>([]);
const faultTypeList = ref<any[]>([]);

const faultTypeLookup = computed<Record<string, string>>(() => {
	const map: Record<string, string> = Object.create(null);
	faultTypeList.value.forEach((item: any) => {
		const code = item?.faultTypeCode;
		const label = item?.faultTypeDesc;
		const key = code === undefined || code === null ? "" : String(code).trim();
		if (!key) return;
		const text =
			label === undefined || label === null ? "" : String(label).trim();
		map[key] = text || key;
	});
	return map;
});

const statusText = computed(() => {
	const code = String(form.value.orderStatus ?? form.value.status ?? "");
	if (!code) return form.value.statusName ?? "";
	const hit = statusDict.value.find((item) => item.dictValue === code);
	return hit?.dictLabel ?? form.value.statusName ?? "";
});

const statusState = computed(() =>
	statusText.value
		? resolveStatusState(
				statusText.value,
				form.value.orderStatus ?? form.value.status
		  )
		: ""
);

const statusStateClass = computed(() =>
	statusState.value ? `is-${statusState.value}` : ""
);

const baseFields: CFormSchemaField[] = reactive([
	{ groupTitle: "报修信息" },
	{
		label: "工单编号",
		prop: "orderCode",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-", copyable: true },
	},
	{
		label: "设备编号",
		prop: "equipmentCode",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
	},
	{
		label: "设备名称",
		prop: "equipmentName",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
	},
	{
		label: "维修人",
		prop: "repairName",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
	},
	{
		label: "设备位置",
		prop: "factoryName",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
	},
	{
		label: "故障类型",
		prop: "faultTypeDesc",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
	},
	{
		prop: "faultDesc",
		label: "报修部门/车间",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
	},
	{
		label: "损坏时间",
		prop: "expectRepairTime",
		component: "Normal",
		readonly: true,
		componentProps: {
			emptyText: "-",
			format: (val: any) => formatDateTime(val),
		},
	},
	{ groupTitle: "故障详情" },
	{
		label: "问题描述",
		prop: "problemDetail",
		component: "Textarea",
		readonly: true,
		placeholder: "-",
	},
	{
		label: "故障图片",
		prop: "imageList",
		component: "Uploader",
		readonly: true,
		componentProps: {
			limit: 6,
			showUpload: false,
			disabled: true,
		},
	},
]);

const schemaRef = computed<CFormSchema>(() => {
	const fields: CFormSchemaField[] = [...baseFields];
	if (dispatchRecords.value.length > 0) {
		fields.push({
			component: "GroupTitle",
			groupTitle: "派工记录",
			prop: "_group_dispatch",
		});
		fields.push({
			component: "Slot",
			slotName: "dispatchRecords",
		});
	}

	if (repairRecords.value.length > 0) {
		fields.push({
			component: "GroupTitle",
			groupTitle: "维修记录",
			prop: "_group_repair",
		});
		fields.push({
			component: "Slot",
			slotName: "repairRecords",
		});
	}

	if (auditRecords.value.length > 0) {
		fields.push({
			component: "GroupTitle",
			groupTitle: "审批记录",
			prop: "_group_audit",
		});
		fields.push({
			component: "Slot",
			slotName: "auditRecords",
		});
	}
	return {
		layout: "vertical",
		labelWidth: "240rpx",
		showActions: false,
		readonly: false,
		fields,
	};
});


function formatRecordTime(value: any) {
	if (!value) return "-";
	const formatted = formatDateTime(value);
	return formatted === "-" ? String(value ?? "-") : formatted;
}

function normalizePictureList(raw: any) {
	if (!raw) return [];
	if (Array.isArray(raw)) {
		return raw.map((item) => ensurePicturePreviewUrl(item)).filter(Boolean);
	}
	if (typeof raw === "string") {
		return raw
			.split(/[;,]/)
			.map((item) => ensurePicturePreviewUrl(item.trim()))
			.filter(Boolean);
	}
	return [ensurePicturePreviewUrl(raw)].filter(Boolean);
}

function ensureParams(options: Record<string, any>) {
	const src = options?.source;
	if (src === "1" || src === "2") source.value = src;
	const rid = options?.id || options?.orderId || options?.workOrderId;
	if (rid) id.value = String(rid);
}

function mapStatusDictionary(list: any[]) {
	if (!Array.isArray(list)) return [];
	return list.map((item) => ({
		dictValue: String(item.dictValue ?? item.dictCode ?? ""),
		dictLabel: item.dictLabel ?? item.dictName ?? "",
	}));
}

async function loadStatusDict() {
	try {
		const mapping = await queryDictList(["repair_order_status_type"]);
		statusDict.value = mapStatusDictionary(
			mapping?.repair_order_status_type || []
		);
	} catch (error) {
		console.warn("[WorkOrderDetail] loadStatusDict fail", error);
	}
}

function resolveFaultTypeText(code: any, fallback?: any) {
	const key = code === undefined || code === null ? "" : String(code).trim();
	if (key && faultTypeLookup.value[key]) {
		return faultTypeLookup.value[key];
	}
	const fallbackText =
		fallback === undefined || fallback === null ? "" : String(fallback).trim();
	return fallbackText || key || "";
}

function applyFaultTypeDesc(target?: Record<string, any>) {
	const scope = target ?? form.value;
	if (!scope) return;
	const rawCode =
		scope.faultTypeCode ??
		scope.faultType ??
		scope.faultTypeId ??
		scope.faultTypeValue ??
		"";
	const fallback =
		scope.faultTypeDesc ??
		scope.faultTypeName ??
		scope.faultTypeLabel ??
		scope.faultTypeText ??
		"";
	const resolved = resolveFaultTypeText(rawCode, fallback);
	scope.faultTypeDesc = resolved || fallback || "";
}

async function loadFaultTypes() {
	try {
		const resp: any = await http.post(
			"/equipment/faultType/select-ftpmFaultType",
			{}
		);
		const list = unwrapRecordList(resp);
		faultTypeList.value = list;
		applyFaultTypeDesc();
	} catch (error) {
		console.warn("[WorkOrderDetail] loadFaultTypes fail", error);
	}
}

async function fetchDetail(showToast = true) {
	if (!id.value) return;
	try {
		const payload = await orderListDetail({ id: id.value });
		const data = payload?.data ?? payload ?? {};
		let info: any =
			data?.detail ??
			data?.equipmentRepaircommit ??
			payload?.detail ??
			payload?.equipmentRepaircommit ??
			data;
		if (Array.isArray(info)) info = info[0] ?? {};

		const faultTypeCode =
			info?.faultType ??
			info?.faultTypeCode ??
			info?.faultTypeId ??
			info?.faultTypeValue ??
			info?.faultTypeDictValue ??
			"";
		const faultTypeRawText =
			info?.faultTypeDesc ??
			info?.faultTypeName ??
			info?.faultTypeLabel ??
			info?.faultTypeText ??
			"";

		const next: Record<string, any> = {
			id: info?.id ?? data?.id ?? payload?.id ?? id.value,
			orderCode:
				info?.orderCode ??
				info?.orderNo ??
				info?.repairOrderNo ??
				info?.workOrderNo ??
				info?.workorderId ??
				data?.orderCode ??
				payload?.orderCode ??
				String(id.value),
			equipmentCode: info?.equipmentCode ?? "",
			equipmentName: info?.equipmentName ?? "",
			repairName: info?.repairName ?? info?.maintainUserName ?? "",
			factoryName: info?.factoryName ?? info?.equipmentFactoryName ?? "",
			faultTypeCode: faultTypeCode ? String(faultTypeCode) : "",
			faultTypeDesc: resolveFaultTypeText(faultTypeCode, faultTypeRawText),
			expectRepairTime:
				info?.expectRepairTime ??
				info?.faultHappenTime ??
				data?.expectRepairTime ??
				"",
			faultDesc:
				info?.faultDesc ??
				info?.faultDepartment ??
				info?.faultDeptName ??
				info?.reportDeptName ??
				info?.factoryName ??
				"",
			problemDetail: info?.problemDetail ?? info?.faultDesc ?? "",
			imageList: normalizePictureList(
				info?.imagePath ?? info?.faultPic ?? info?.pictures
			),
			orderStatus:
				info?.orderStatus ??
				data?.orderStatus ??
				payload?.orderStatus ??
				form.value.orderStatus,
			statusName:
				info?.orderStatusName ??
				info?.statusName ??
				data?.statusName ??
				payload?.statusName ??
				form.value.statusName,
		};

		Object.assign(form.value, next);
		applyFaultTypeDesc();
		// 派工记录
		dispatchRecords.value = toArray(data?.equipmentRepairdispatches || []);
		// 审批记录
		auditRecords.value = toArray(data?.equipmentRepairauditings || []);
	} catch (error) {
		console.warn("[WorkOrderDetail] fetchDetail fail", error);
		if (showToast) uni.showToast({ title: "加载失败", icon: "none" });
	} finally {
		detailLoaded.value = true;
	}
}

async function fetchRepairRecords(showToast = false) {
	if (!id.value) return;
	try {
		const resp = await getRepairMessage({ id: id.value });
		const list = toArray(resp?.data ?? resp ?? []);
		repairRecords.value = list;
	} catch (error) {
		console.warn("[WorkOrderDetail] fetchRepairRecords fail", error);
		if (showToast) {
			uni.showToast({ title: "维修记录加载失败", icon: "none" });
		}
	}
}

function unwrapRecordList(raw: any): any[] {
	if (!raw) return [];
	if (Array.isArray(raw)) return raw;
	const candidates = [
		raw.records,
		raw.rows,
		raw.list,
		raw.items,
		raw.faultTypeList,
		raw.data,
		Array.isArray(raw.data) ? raw.data : undefined,
		raw?.data?.records,
		raw?.data?.rows,
		raw?.data?.list,
		raw?.data?.faultTypeList,
	];
	for (const item of candidates) {
		if (Array.isArray(item)) return item;
	}
	return [];
}

function resolveDispatchLines(record: any) {
	const lines: Array<{ label: string; value: string }> = [];

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
	pushLine("派工人", record.leaderName);
	pushLine("接收人", record.repairName);
	pushLine("预计维修日期", record.expectRepairTime || "-");
	return lines;
}

function resolveRepairLines(record: any) {
	const primaryLineCount = 3;
	const lines: any[] = [];

	const faultReason = record.faultReasonDesc;
	pushLine(lines, "故障原因", faultReason ?? "-");

	const changePartsText = formatChangeParts(record);
	lines.push({
		label: "更换部件",
		value: changePartsText || "-",
	});

	const repairProcess = record.repairProcess;
	pushLine(lines, "维修过程", repairProcess ?? "-");

	lines.push({
		label: "开始时间",
		value: formatRecordTime(record.repairStartTime),
	});

	lines.push({
		label: "结束时间",
		value: formatRecordTime(record.repairEndTime),
	});

	const duration = record.maintenanceTime;
	pushLine(lines, "维修净时(min)", duration ?? "-");

	const resultText = record.repairReason;
	pushLine(lines, "维修结果", resultText ?? "暂无");

	const suggestion = record.reason;
	pushLine(lines, "原因或建议", suggestion ?? "-");

	const pictures = normalizePictureList(
		record.imagePath ?? record.repairImagePath ?? record.images
	);
	if (pictures.length) {
		lines.push({
			label: "维修图片",
			value: `${pictures.length}张`,
			type: "image-list",
			images: pictures.map((src: string, idx: number) => ({
				src,
				id: `${record?.id ?? record?.repairId ?? "repair"}-${idx}`,
			})),
		});
	} else {
		lines.push({
			label: "维修图片",
			value: "-",
		});
	}

	lines.forEach((line, idx) => {
		if (idx >= primaryLineCount) {
			line.collapsible = true;
		}
	});

	return lines;
}

function formatChangeParts(record: any) {
	const rawList = record?.changeParts;
	if (!Array.isArray(rawList) || !rawList.length) return "";

	const chunks = rawList
		.map((item: any) => {
			const name = item?.spareName ?? "";
			const qty = item?.spareNum;
			const unit = item?.unit ?? "个";
			if (!name) return "";
			if (qty === undefined || qty === null || qty === "") return name;
			return `${name}:${qty}${unit}`;
		})
		.filter(Boolean);

	return chunks.join("；");
}

function resolveAuditLines(record: any) {
	const lines: Array<{ label: string; value: string }> = [];

	const pushLineA = (
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
	let auditResult = resolveAuditResult(record);

	pushLineA("审批人", record.auditingName);

	pushLineA("审批结果", auditResult, {
		state: auditResult == "通过" ? "success" : "fail",
	});
	pushLineA("审批时间", record.createdTime);
	pushLineA("审批建议", record.auditingSuggest || "-");

	return lines;
}

function pushLine(
	list: Array<{ label: string; value: string }>,
	label: string,
	raw: any
) {
	if (raw === undefined || raw === null || raw === "") return;
	const text = typeof raw === "string" ? raw.trim() : String(raw);
	if (!text) return;
	list.push({ label, value: text });
}

function resolveAuditResult(record: any) {
	const raw = record?.orderStatus;
	if (raw === undefined || raw === null || raw === "") return raw;
	if (typeof raw === "number") {
		if (raw === 5) return "通过";
		if (raw === 2) return "不通过";
	}
	if (typeof raw === "string") {
		const text = raw.trim();
		if (text === "5") return "通过";
		if (text === "2") return "不通过";
		return text;
	}
	return String(raw);
}

onLoad((options) => {
	ensureParams(options || {});
	if (!id.value) {
		uni.showToast({ title: "缺少工单ID", icon: "none" });
		return;
	}
	detailLoaded.value = false;
	loadStatusDict();
	loadFaultTypes();
	fetchDetail().then(() => fetchRepairRecords());
});

onShow(() => {
	if (!id.value || !detailLoaded.value) return;
	fetchDetail(false).then(() => fetchRepairRecords(false));
});

onPullDownRefresh(async () => {
	await fetchDetail(false);
	await fetchRepairRecords(false);
	uni.stopPullDownRefresh();
});
</script>

<style scoped lang="scss">
.wod-container {
	min-height: 100vh;
	background: var(--app-page-bg, #f5f6f8);
	box-sizing: border-box;
}

.wod-body {
	display: flex;
	flex-direction: column;
	gap: 18px;
}

.wod-status-bar {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	border-radius: 12px;
	background: #fff;
	margin: 12px 8px 0 8px;
	box-shadow: 0 2px 8px rgba(162, 166, 177, 0.08);
}

.wod-status__label {
	font-size: 14px;
	color: #6b7280;
}

.wod-status__chip {
	padding: 4px 12px;
	border-radius: 999px;
	font-size: 13px;
	font-weight: 600;
	color: #1f2937;
	background: #e5e7eb;
}

.wod-status__chip.is-processing {
	color: #1f2937;
	background: rgba(37, 99, 235, 0.12);
}

.wod-status__chip.is-pending {
	color: #92400e;
	background: rgba(245, 158, 11, 0.18);
}

.wod-status__chip.is-done,
.wod-status__chip.is-success {
	color: #065f46;
	background: rgba(16, 185, 129, 0.16);
}

.wod-status__chip.is-warning {
	color: #92400e;
	background: rgba(249, 115, 22, 0.16);
}

.wod-status__chip.is-fail {
	color: #991b1b;
	background: rgba(248, 113, 113, 0.18);
}

.wod-status__chip.is-cancel {
	color: #4b5563;
	background: rgba(156, 163, 175, 0.18);
}

.wod-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.wod-section__title {
	font-size: 15px;
	font-weight: 600;
	color: #1f2937;
	padding-left: 6px;
}

.wod-slot-cards {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.wod-loading {
	padding: 48px 16px;
	text-align: center;
	color: #9ca3af;
	font-size: 14px;
}
</style>
