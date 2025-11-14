<template>
	<PageLayout title="异常上报" :show-back="true">
		<view class="er-page">
			<CForm
				ref="formRef"
				v-model="form"
				:schema="schemaRef"
				@submit="handleSubmit"
				@change="onFieldChange"
			>
				<template v-if="!isViewMode" #actions>
					<sar-row :gap="30">
						<sar-col :span="6">
							<sar-button round theme="warning" @tap="submit({ isSubmit: 0 })"
								>保存</sar-button
							>
						</sar-col>
						<sar-col :span="6">
							<sar-button round theme="primary" @tap="submit({ isSubmit: 1 })"
								>保存并提交</sar-button
							>
						</sar-col>
					</sar-row>
				</template>
			</CForm>
			<view v-if="isViewMode && managementRecords.length" class="er-records">
				<view class="er-records__header">执行记录</view>
				<CCard
					v-for="(record, index) in managementRecords"
					:key="record.id || record.code || index"
					class="er-record-card"
					variant="outline"
					:title="record.documentNumber"
					:extra="formatRecordTime(record)"
				>
					<view class="er-record-body">
						<view
							v-if="record.executeRecord"
							class="er-record-row er-record-row--remark"
						>
							<text class="er-record-label">备注:</text>
							<text class="er-record-value">{{ record.executeRecord }}</text>
						</view>
						<view v-if="record.createdNameBy" class="er-record-row">
							<text class="er-record-label">操作人</text>
							<text class="er-record-value">{{
								record.createdNameBy || "-"
							}}</text>
						</view>
					</view>
				</CCard>
			</view>
		</view>
	</PageLayout>
</template>
<script setup lang="ts">
// @ts-nocheck  先放宽类型
import { ref, computed, nextTick, watch } from "vue";
// uni-app 生命周期 onLoad 用于解析路由参数
// @ts-ignore
import { onLoad, onShow } from "@dcloudio/uni-app";
import { http } from "@/utils/request";
import { requestUrl, minioBaseUrl, imgUrl } from "@/config";
import { EXCEPTION_LIST_REFRESH_KEY } from "@/pages/exceptionManagement/constants";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import CCard from "@/components/c-card/CCard.vue";
import type { CFormSchema, CFormExpose } from "@/components/c-form/types";
import { WORK_ORDER_PICK_RESULT_CACHE_KEY } from "@/utils/picker";
import { formatDateTime } from "@/utils/date";
import { normalizePictureList, ensurePicturePreviewUrl, stripPictureBaseUrl } from "@/utils/picture";

// ====== 表单基础状态 ======
// form 内部约定：_mode: 'create' | 'edit' | 'view'; _locks: Record<string,1>
// 允许外部页面通过路由参数预置：mode, id, prefill(json/base64), locks(逗号分隔字段)
const form = ref<any>({ _mode: "create", _locks: {} });
const formRef = ref<CFormExpose | null>(null);
const isViewMode = computed(() => form.value._mode === "view");
const managementRecords = computed(() => {
	const list = form.value?.managementRecordList;
	if (!Array.isArray(list)) return [];
	return list.filter((item) => !!item && typeof item === "object");
});

function deriveRecordTitle(record: any, index: number) {
	if (!record || typeof record !== "object") return `记录 ${index + 1}`;
	return (
		record.executeRecord ||
		record.handleNodeName ||
		record.nodeName ||
		record.handleNode ||
		record.statusName ||
		record.status ||
		`记录 ${index + 1}`
	);
}

function deriveRecordSubtitle(record: any) {
	if (!record || typeof record !== "object") return "";
	const doc = record.documentNumber;
	const dept = record.department;
	const post = record.postName;
	const subtitleParts: string[] = [];
	if (doc) subtitleParts.push(`单号：${doc}`);
	if (dept || post)
		subtitleParts.push(
			`岗位：${dept && post ? `${dept} · ${post}` : dept || post}`
		);
	return subtitleParts.join(" ｜ ");
}

function formatRecordTime(record: any) {
	if (!record || typeof record !== "object") return "-";
	const raw =
		record.createdTime ??
		record.handleTime ??
		record.createTime ??
		record.updateTime ??
		record.finishTime ??
		record.time;
	if (raw === undefined || raw === null || raw === "") return "-";
	const formatted = normalizeDateTime(raw);
	return formatted || String(raw);
}

const MANAGEMENT_OPERATION_LABELS: Record<string | number, string> = {
	0: "创建",
	5: "提交",
	10: "修改",
	15: "审核",
	20: "处理",
	30: "驳回",
	40: "关闭",
};

function formatRecordStatus(record: any) {
	if (!record || typeof record !== "object") return "-";
	const statusName =
		record.documentStatusName || record.statusName || record.statusText;
	const operationLabel =
		MANAGEMENT_OPERATION_LABELS[record.managementOperation];
	const documentStatus = record.documentStatus;
	const parts: string[] = [];
	if (statusName) parts.push(statusName);
	if (operationLabel) parts.push(operationLabel);
	return parts.length ? parts.join(" / ") : "-";
}

// 加载中与详情已加载标记
const loadingDetail = ref(false);
const detailLoaded = ref(false);

// sessionStorage 相关 key 约定
const EDIT_FLAG_KEY = "exceptionEdit";
const FORM_CACHE_KEY = "formData";

// 工单字段列表：用于针对性覆盖
const WORK_ORDER_FIELDS = [
	"workOrder",
	"processCode",
	"processName",
	"batchNumber",
	"materialsCode",
	"materialsName",
	"projectNumber",
	"segmentNumber",
	"specifications",
	"equipId",
	"equipName",
];

const WORK_ORDER_VALUE_KEYS = [
	"workOrder",
	"workOrderNo",
	"workOrderCode",
	"taskNumber",
	"orderNo",
	"number",
	"code",
	"id",
];
const WORK_ORDER_PICK_SOURCE_KEY = "WORK_ORDER_PICK_SOURCE";
const WORK_ORDER_SOURCE_TTL = 60 * 1000;

function normalizeWorkOrderValueFromSelection(record: any): string {
	if (!record || typeof record !== "object") return "";
	for (const key of WORK_ORDER_VALUE_KEYS) {
		const val = record[key];
		if (val !== undefined && val !== null && val !== "") return String(val);
	}
	return "";
}

function isRecentWorkOrderSourceFlag(flag: any): boolean {
	if (!flag || typeof flag !== "object") return false;
	const ts = Number(flag?.ts ?? flag?.timestamp);
	if (!Number.isFinite(ts)) return false;
	return Date.now() - ts <= WORK_ORDER_SOURCE_TTL;
}

function applyWorkOrderSelection(selection: any): boolean {
	if (!selection) return false;
	const target = Array.isArray(selection) ? selection[0] : selection;
	if (!target || typeof target !== "object") return false;
	let changed = false;
	const workOrderValue = normalizeWorkOrderValueFromSelection(target);
	if (workOrderValue) {
		if (form.value.workOrder !== workOrderValue) {
			setFormField("workOrder", workOrderValue);
			changed = true;
		}
	} else if (form.value.workOrder) {
		setFormField("workOrder", "");
		changed = true;
	}
	const hasOwn = Object.prototype.hasOwnProperty;
	WORK_ORDER_FIELDS.forEach((field) => {
		if (field === "workOrder") return;
		if (hasOwn.call(target, field)) {
			const next = target[field] ?? "";
			if (form.value[field] !== next) {
				setFormField(field, next);
				changed = true;
			}
		} else if (form.value[field]) {
			setFormField(field, "");
			changed = true;
		}
	});
	if (Array.isArray(selection)) {
		setFormField("workOrderList", selection);
		changed = true;
	} else if (selection && typeof selection === "object") {
		setFormField("workOrderList", [selection]);
		changed = true;
	}
	return changed;
}

function consumeWorkOrderCache() {
	let cached: any = null;
	try {
		cached = uni.getStorageSync(WORK_ORDER_PICK_RESULT_CACHE_KEY);
	} catch {}
	let sourceFlag: any = null;
	try {
		sourceFlag = uni.getStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
	} catch {}
	const hasValidSource = isRecentWorkOrderSourceFlag(sourceFlag);
	if (!cached) {
		if (sourceFlag) {
			try {
				uni.removeStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
			} catch {}
		}
		return;
	}
	if (!hasValidSource) {
		try {
			uni.removeStorageSync(WORK_ORDER_PICK_RESULT_CACHE_KEY);
		} catch {}
		if (sourceFlag) {
			try {
				uni.removeStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
			} catch {}
		}
		return;
	}
	if (cached?.type && cached.type !== "work-order") {
		try {
			uni.removeStorageSync(WORK_ORDER_PICK_RESULT_CACHE_KEY);
		} catch {}
		if (sourceFlag) {
			try {
				uni.removeStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
			} catch {}
		}
		return;
	}
	const ts = Number(cached?.timestamp);
	if (!Number.isFinite(ts) || Date.now() - ts > WORK_ORDER_SOURCE_TTL) {
		try {
			uni.removeStorageSync(WORK_ORDER_PICK_RESULT_CACHE_KEY);
		} catch {}
		if (sourceFlag) {
			try {
				uni.removeStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
			} catch {}
		}
		return;
	}
	const payload = cached?.payload ?? cached;
	applyWorkOrderSelection(payload);
	try {
		uni.removeStorageSync(WORK_ORDER_PICK_RESULT_CACHE_KEY);
	} catch {}
	try {
		uni.removeStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
	} catch {}
}

const schemaFieldProps = new Set<string>();

const pendingFieldSync = new Set<string>();
let fieldSyncScheduled = false;

function joinWithSlash(base: string | undefined, suffix: string): string {
	if (!base) return suffix;
	const normalizedBase = base.replace(/\/+$/, "");
	const normalizedSuffix = suffix.replace(/^\/+/, "");
	return `${normalizedBase}/${normalizedSuffix}`;
}

const FILE_UPLOAD_URL = joinWithSlash(requestUrl, "/file/upload");
const FILE_PREVIEW_BASE_SOURCE = minioBaseUrl || requestUrl || "";
const FILE_PREVIEW_BASE = FILE_PREVIEW_BASE_SOURCE.replace(/\/+$/, "");
function queueFieldSync() {
	if (fieldSyncScheduled) return;
	fieldSyncScheduled = true;
	nextTick().then(() => {
		fieldSyncScheduled = false;
		if (!formRef.value?.setValue) return;
		const toSync = Array.from(pendingFieldSync);
		pendingFieldSync.clear();
		toSync.forEach((prop) => {
			try {
				formRef.value.setValue(prop, form.value[prop]);
			} catch (e) {
				// ignore individual field sync errors
			}
		});
	});
}

watch(
	() => formRef.value,
	(val) => {
		if (val && pendingFieldSync.size) queueFieldSync();
	}
);

function setFormField(prop: string, value: any) {
	form.value[prop] = value;
	if (schemaFieldProps.has(prop)) {
		pendingFieldSync.add(prop);
		queueFieldSync();
	}
}

function clearWorkOrderFields() {
	setFormField("workOrder", "");
	setFormField("workOrderList", []);
	WORK_ORDER_FIELDS.forEach((field) => {
		if (field === "workOrder") return;
		setFormField(field, "");
	});
}

function safeSessionGet(key: string) {
	try {
		return sessionStorage?.getItem?.(key);
	} catch {
		return null;
	}
}

function safeSessionRemove(key: string) {
	try {
		sessionStorage?.removeItem?.(key);
	} catch {}
}

function readSessionJSON<T = any>(key: string): T | null {
	const raw = safeSessionGet(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function decodeRouteParam(value: any) {
	if (typeof value !== "string") return value;
	try {
		const normalized = value.includes("+")
			? value.replace(/\+/g, "%20")
			: value;
		return decodeURIComponent(normalized);
	} catch {
		return value;
	}
}

function normalizeRouteParams(raw: Record<string, any> | undefined | null) {
	if (!raw) return {} as Record<string, any>;
	const out: Record<string, any> = {};
	Object.keys(raw).forEach((key) => {
		const val = (raw as any)[key];
		if (Array.isArray(val)) {
			out[key] = val.map((item) => decodeRouteParam(item));
		} else {
			out[key] = decodeRouteParam(val);
		}
	});
	return out;
}

/**
 * 标准化日期时间格式
 * 使用统一的 formatDateTime 工具，但保留空值
 */
function normalizeDateTime(value: any) {
	if (value == null || value === "") return value;
	return formatDateTime(value, { emptyValue: value });
}

async function applyStoredFormData(afterDetail = false) {
	const stored = readSessionJSON<Record<string, any>>(FORM_CACHE_KEY);
	if (!stored) return;
	const hasWorkOrder = stored.workOrder != null;
	const baseWorkOrder = form.value.workOrder;
	const returningFromWorkOrder =
		afterDetail && hasWorkOrder && stored.workOrder !== baseWorkOrder;

	if (returningFromWorkOrder) {
		WORK_ORDER_FIELDS.forEach((field) => {
			if (stored[field] !== undefined) {
				setFormField(field, stored[field]);
			}
		});
	} else {
		Object.keys(stored).forEach((key) => {
			if (stored[key] !== undefined) {
				setFormField(key, stored[key]);
			}
		});
	}

	await nextTick();
	setFormField(
		"expectedResolutionTime",
		normalizeDateTime(form.value.expectedResolutionTime)
	);
	setFormField(
		"exceptionPictureUrl",
		normalizePictureList(form.value.exceptionPictureUrl)
	);
	safeSessionRemove(FORM_CACHE_KEY);
}

// 远程接口占位：统一通过 asyncOptions（大类） + 级联 children（小类）
async function fetchExceptionTypes() {
	try {
		const data: any = await http.post("/dispatch/exception/type/list", {});
		if (!Array.isArray(data)) return [];
		// 按 sortNo 升序；children 也排序；过滤已删除
		const sorted = [...data]
			.filter((it) => it.deleteFlag === 0)
			.sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
			.map((parent) => ({
				...parent,
				children: Array.isArray(parent.children)
					? parent.children
							.filter((c) => c && c.deleteFlag === 0)
							.sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
					: [],
			}));
		return sorted;
	} catch (e) {
		return [];
	}
}

// 将旧 FB.list / datetime / input / upload 等映射为新 schema 字段
// schema 可在不同模式下动态调整（例如 view 模式全局只读）
const baseSchema: CFormSchema = {
	showReset: true,
	resetBehavior: "back",
	submitText: "保存",
	fields: [
		// 隐藏字段：仅用于提交，界面不展示
		{
			prop: "typeParentCode",
			component: "Input",
			visible: false,
			clearWhenHidden: false,
		},
		{
			prop: "typeCode",
			component: "Input",
			visible: false,
			clearWhenHidden: false,
		},
		{
			prop: "noticeType",
			component: "Input",
			visible: false,
			clearWhenHidden: false,
		},
		{
			prop: "processCode",
			component: "Input",
			visible: false,
			clearWhenHidden: false,
		},
		{
			prop: "materialsCode",
			component: "Input",
			visible: false,
			clearWhenHidden: false,
		},
		{
			prop: "specifications",
			component: "Input",
			visible: false,
			clearWhenHidden: false,
		},
		{
			prop: "equipId",
			component: "Input",
			visible: false,
			clearWhenHidden: false,
		},
		// ===== 基本信息 =====
		{ groupTitle: "基本信息" },
		{
			label: "异常大类",
			prop: "typeParentName",
			required: true,
			component: "Dict",
			placeholder: "请选择异常大类",
			asyncOptions: {
				api: async () => {
					const list = await fetchExceptionTypes();
					exceptionTypeCache.value = list;

					return list.map((it: any) => ({
						label: it.name,
						value: it.code,
						raw: it,
					}));
				},
				reloadOnOpen: true,
				lazy: true,
				immediate: true,
			},
			onChange: async ({ value }) => {
				// 级联重置
				setFormField("typeCode", undefined);
				setFormField("typeName", undefined);
				setFormField("noticeType", undefined);
				setFormField("exceptionDescTemplate", undefined);
				const parent = exceptionTypeCache.value.find(
					(p: any) => p.code === value
				);
				setFormField("typeParentCode", parent?.code);
				setFormField("typeParentName", parent?.name);
			},
			showCascadeClear: true,
			cascadeTo: ["typeCode", "typeName"],
			disabled: ({ model }: any) => !!model._locks?.typeParentCode,
		},
		// { label: '异常大类名称', prop: 'typeParentName', component: 'Normal', readonly: true, placeholder: '-' },
		{
			label: "异常小类",
			prop: "typeName",
			required: true,
			component: "Dict",
			placeholder: "请选择异常小类",
			asyncOptions: {
				// 小类不再独立请求：复用已选大类 children
				api: async () => {
					const parent = exceptionTypeCache.value.find(
						(p: any) => p.code === form.value.typeParentCode
					);
					const children = parent?.children || [];
					return children.map((c: any) => ({
						label: c.name,
						value: c.code,
						raw: c,
					}));
				},
				dependOn: ["typeParentCode"],
				lazy: true,
				immediate: true,
				reloadOnOpen: true,
			},
			disabled: ({ model }) => !model.typeParentCode,
			onChange: ({ value }) => {
				// 反填小类名称
				const parent = exceptionTypeCache.value.find(
					(p: any) => p.code === form.value.typeParentCode
				);
				const hit = parent?.children?.find((c: any) => c.code === value);
				setFormField("typeName", hit?.name);
				setFormField("typeCode", hit?.code);
				setFormField("noticeType", hit?.noticeType);
				// 如果后端给了模板描述，可写入占位字段；用户仍可在“异常描述”里自行输入
				if (!form.value.exceptionDesc) {
					const tpl = hit?.exceptionDesc;
					if (tpl) setFormField("exceptionDesc", tpl);
					setFormField("exceptionDescTemplate", tpl);
				}
			},
		},
		// { label: '异常小类名称', prop: 'typeName', component: 'Normal', placeholder: '-', readonly: true },
		// 预留：系统建议的异常描述模板（只读显示，可帮助用户快速参考）
		{
			label: "描述模板",
			prop: "exceptionDescTemplate",
			component: "Normal",
			placeholder: "-",
			readonly: true,
			visible: ({ model }) => !!model.exceptionDescTemplate,
		},
		{
			label: "期望解决时间",
			prop: "expectedResolutionTime",
			required: true,
			component: "DateTime",
			placeholder: "请选择时间",
			componentProps: { type: "yMd" },
			// 编辑或查看时如果已经有值且锁定，则禁用
			disabled: ({ model }) => !!model._locks?.expectedResolutionTime,
		},
		{
			label: "异常描述",
			prop: "exceptionDesc",
			required: true,
			component: "Textarea",
			placeholder: "请输入异常描述",
			componentProps: { autosize: { minHeight: 80, maxHeight: 200 } },
			disabled: ({ model }) => !!model._locks?.exceptionDesc,
		},
		{
			label: "异常图片",
			prop: "exceptionPictureUrl",
			component: "Uploader",
			componentProps: {
				limit: 6,
				uploadUrl: FILE_UPLOAD_URL,
				...(FILE_PREVIEW_BASE ? { urlBase: FILE_PREVIEW_BASE } : {}),
			},
			disabled: ({ model }) => !!model._locks?.exceptionPictureUrl,
		},
		// ===== 工单信息 =====
		{ groupTitle: "工单信息" },
		{
			label: "加工单编号",
			prop: "workOrder",
			component: "WorkOrderSelect",
			placeholder: "请选择加工单",
			// disabled: ({ model }) => !!model._locks?.workOrder,
		},
		// { label: "工序", prop: "processCode", component: "Normal", readonly: true },
		{
			label: "项目号",
			prop: "projectNumber",
			component: "Normal",
			readonly: true,
		},
		{
			label: "批次号",
			prop: "batchNumber",
			component: "Normal",
			readonly: true,
		},
		{
			label: "分段号",
			prop: "segmentNumber",
			component: "Normal",
			readonly: true,
		},
		{
			label: "物料编码",
			prop: "materialsCode",
			component: "Normal",
			readonly: true,
		},
		{
			label: "物料名称",
			prop: "materialsName",
			component: "Normal",
			readonly: true,
		},
		{ label: "设备", prop: "equipName", component: "Normal", readonly: true },
	],
};

baseSchema.fields.forEach((f: any) => {
	if (f && f.prop && f.component !== "GroupTitle") {
		schemaFieldProps.add(f.prop);
	}
});

// 根据 _mode 动态只读：view 模式整体只读
const schemaRef = computed<CFormSchema>(() => {
	return {
		...baseSchema,
		readonly: form.value._mode === "view",
	};
});

// 缓存已加载的大类（含 children）供小类使用
const exceptionTypeCache = ref<any[]>([]);

function onFieldChange(prop: string, value: any) {
	// 可用于调试：console.log('field change', prop, value)
}

// WorkOrderSelect 内部已处理点击选择逻辑，此处无需额外弹层函数

async function submit(options: { isSubmit?: number } = {}) {
	if (form.value._mode === "view") return; // 查看模式不提交
	const valid = await formRef.value?.validate?.();
	if (!valid) return;
	const payload = await buildSubmitPayload(options);
	handleSubmit(payload);
}

function buildSubmitPayload(options: { isSubmit?: number } = {}) {
	const { _mode, _locks, exceptionDescTemplate, workOrderList, ...rest } =
		form.value || {};
	const payload: Record<string, any> = { ...rest };
	payload.source = payload.source ?? 2;
	payload.isSubmit = options.isSubmit ?? payload.isSubmit ?? 0;

	// 处理图片：后端期望字符串
	if (Array.isArray(payload.exceptionPictureUrl)) {
		const cleaned = payload.exceptionPictureUrl
			.map((u: any) => {
				if (u == null) return "";
				if (typeof u === "string") return stripPictureBaseUrl(u);
				return stripPictureBaseUrl(ensurePicturePreviewUrl(u));
			})
			.map((u: string) => u.trim())
			.filter((u: string) => u !== "");
		if (cleaned.length) {
			let joined = cleaned.join(",");
			if (!joined.endsWith(",")) joined += ",";
			payload.exceptionPictureUrl = joined;
		} else {
			payload.exceptionPictureUrl = "";
		}
	}

	// 日期字段转换为时间戳（后端要求毫秒值）
	if (
		payload.expectedResolutionTime !== undefined &&
		payload.expectedResolutionTime !== null &&
		payload.expectedResolutionTime !== ""
	) {
		let ts: number | null = null;
		const raw = payload.expectedResolutionTime;
		const pickValue = (value: any) => {
			if (value instanceof Date) return value.getTime();
			if (typeof value === "number" && !Number.isNaN(value)) return value;
			if (typeof value === "string" && value.trim()) {
				const trimmed = value.trim();
				if (/^\d+$/.test(trimmed)) {
					const num = Number(trimmed);
					if (!Number.isNaN(num)) return num;
				}
				const normalized = trimmed.replace(/-/g, "/");
				const parsed = Date.parse(normalized);
				if (!Number.isNaN(parsed)) return parsed;
			}
			return null;
		};
		if (Array.isArray(raw)) {
			for (const item of raw) {
				ts = pickValue(item);
				if (ts != null) break;
			}
		} else {
			ts = pickValue(raw);
		}
		if (ts != null && !Number.isNaN(ts)) payload.expectedResolutionTime = ts;
		else delete payload.expectedResolutionTime;
	}

	// noticeType 兼容：后端期望数值
	if (
		payload.noticeType !== undefined &&
		payload.noticeType !== null &&
		payload.noticeType !== ""
	) {
		let nt: any = payload.noticeType;
		if (Array.isArray(nt)) nt = nt[0];
		if (typeof nt === "string" && nt.includes(",")) nt = nt.split(",")[0];
		const ntNum = Number(nt);
		if (!Number.isNaN(ntNum)) payload.noticeType = ntNum;
		else delete payload.noticeType;
	}

	// 清理 undefined/null 字段，避免类型绑定错误
	Object.keys(payload).forEach((key) => {
		const val = payload[key];
		if (val === undefined || val === null) delete payload[key];
	});

	return payload;
}

async function handleSubmit(payload: any) {
	try {
		if (form.value._mode === "edit" && payload.id) {
			await http.post("/dispatch/exception/management/update", payload);
		} else {
			await http.post("/dispatch/exception/management/add", payload);
		}
		uni.showToast({ title: "提交成功", icon: "success" });
		markExceptionListForRefresh();
		nextTick(() => uni.navigateBack());
	} catch (e: any) {
		console.warn("[exception-report] submit failed", e);
		uni.showToast({ title: e?.message || "提交失败", icon: "none" });
	}
}

function markExceptionListForRefresh() {
	try {
		uni.setStorageSync(EXCEPTION_LIST_REFRESH_KEY, Date.now());
	} catch (error) {
		console.warn("[exception-report] mark refresh flag failed", error);
	}
}

async function handleReceive() {
	await runSimpleAction("/dispatch/exception/management/receive", {
		id: form.value.id,
	});
	await loadDetail(form.value.id);
}

// ============ 详情加载 & 路由参数预处理 ============
async function loadDetail(id: string) {
	if (!id) return;
	loadingDetail.value = true;
	try {
		// 假设详情接口返回结构与提交一致 (TODO: 替换真实路径)
		const data: any = await http.post(
			"/dispatch/exception/management/findDetailsById",
			{
				id,
			}
		);

		if (data) {
			Object.keys(data).forEach((k) => {
				setFormField(k, data[k]);
			});
			setFormField(
				"expectedResolutionTime",
				normalizeDateTime(form.value.expectedResolutionTime)
			);
			setFormField(
				"exceptionPictureUrl",
				normalizePictureList(form.value.exceptionPictureUrl)
			);
			detailLoaded.value = true;
			// 若已有大类/小类值，尝试映射名称
			await ensureNamesAfterDict();
			await applyStoredFormData(true);
			await ensureNamesAfterDict();
		}
	} catch (e) {
		console.warn("[exception-report] load detail failed", e);
	} finally {
		loadingDetail.value = false;
	}
}

function applyPrefill(prefill: any) {
	if (!prefill || typeof prefill !== "object") return;
	Object.keys(prefill).forEach((k) => {
		if (prefill[k] !== undefined) setFormField(k, prefill[k]);
	});
}

function applyLocks(locksStr?: string) {
	if (!locksStr) return;
	const obj: Record<string, 1> = {};
	locksStr
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.forEach((k) => {
			obj[k] = 1;
		});
	form.value._locks = { ...(form.value._locks || {}), ...obj };
}

async function ensureNamesAfterDict() {
	// 确保 exceptionTypeCache 已加载（如果尚未加载，主动加载一次）
	if (!exceptionTypeCache.value.length) {
		exceptionTypeCache.value = await fetchExceptionTypes();
	}
	const currentParentCode = form.value.typeParentCode;
	const currentChildCode = form.value.typeCode;
	let parent = currentParentCode
		? exceptionTypeCache.value.find(
				(x: any) =>
					x.code === currentParentCode || x.name === form.value.typeParentName
		  )
		: undefined;
	if (!parent && currentChildCode) {
		parent = exceptionTypeCache.value.find((x: any) =>
			Array.isArray(x.children)
				? x.children.some((c: any) => c.code === currentChildCode)
				: false
		);
		if (parent) {
			setFormField("typeParentCode", parent.code);
			setFormField("typeParentName", parent.name);
		}
	}
	if (parent) {
		const p = exceptionTypeCache.value.find(
			(x: any) => x.code === parent!.code
		);
		if (p) setFormField("typeParentName", p.name);
		const child = (p?.children || []).find((c: any) =>
			currentChildCode
				? c.code === currentChildCode
				: c.name === form.value.typeName
		);
		if (child) {
			setFormField("typeCode", child.code);
			setFormField("typeName", child.name);
			if (child.noticeType !== undefined)
				setFormField("noticeType", child.noticeType);
			if (!form.value.exceptionDesc && child.exceptionDesc)
				setFormField("exceptionDesc", child.exceptionDesc);
		}
	}
}

onLoad(async (opts: any) => {
	clearWorkOrderFields();
	const query = normalizeRouteParams(opts || {});
	const { mode, id, prefill, locks } = query;
	// 统一解析模式
	if (mode) setFormField("_mode", String(mode));
	const editFlag = safeSessionGet(EDIT_FLAG_KEY);
	if (editFlag === "true" && form.value._mode !== "view") {
		setFormField("_mode", "edit");
		safeSessionRemove(EDIT_FLAG_KEY);
	}
	// 解析 locks（支持直接传、URI 编码传）
	if (locks) {
		try {
			applyLocks(decodeURIComponent(String(locks)));
			console.log("[exception-report] applied locks from decoded param", locks);
		} catch {
			applyLocks(String(locks));
		}
	}
	// 解析 prefill：支持原始 JSON、URI 编码 JSON、以及被 encodeURIComponent 过的 JSON
	if (prefill) {
		const raw = String(prefill);
		let parsed: any = null;
		const tryParse = (s: string) => {
			try {
				return JSON.parse(s);
			} catch {
				return null;
			}
		};
		parsed = tryParse(raw) || tryParse(decodeURIComponent(raw));
		if (parsed) applyPrefill(parsed);
	}
	// id
	if (id) setFormField("id", String(id));
	if (
		form.value.id &&
		(form.value._mode === "edit" || form.value._mode === "view")
	) {
		await loadDetail(form.value.id);
	} else {
		// 兼容老逻辑：通过路由参数预填类型信息
		if (query?.code) {
			setFormField("typeCode", query.code);
			setFormField("typeName", query.name);
		}
		if (query?.parentCode) {
			setFormField("typeParentCode", query.parentCode);
			setFormField("typeParentName", query.parentName);
		}
		if (query?.code) {
			setFormField("_mode", form.value._mode || "create");
		}
		await applyStoredFormData(false);
		// 没有详情直接尝试映射名称（若预填已有代码或缓存覆盖）
		await ensureNamesAfterDict();
	}
});

onShow(() => {
	if (form.value?._mode === "view") return;
	consumeWorkOrderCache();
});
</script>
<style scoped>
.er-actions {
	margin-top: 24rpx;
}
.c-form-group-title {
	display: flex;
	align-items: center;
	margin: 40rpx 0 20rpx;
	padding: 8rpx 0; /* 去除左右背景块感，仅保留垂直留白 */
	background: transparent; /* 去除背景，避免与父容器形成小尖角 */
	border-radius: 0;
}
.c-form-group-title:first-child {
	margin-top: 0;
}
.er-records__header::before {
	content: "";
	display: inline-block;
	width: 8rpx;
	height: 34rpx;
	background: linear-gradient(180deg, #2d8cf0, #1a73e8);
	border-radius: 4rpx;
	margin-right: 16rpx;
}
.c-form-group-title__text {
	font-size: 28rpx;
	font-weight: 600;
	line-height: 34rpx;
	color: #222;
}
.er-records {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
	padding: 0 24rpx 20rpx;
	margin-top: 24rpx;
}
.er-records__header {
	font-size: 30rpx;
	font-weight: 600;
	color: #1f2937;
}
.er-record-card {
	--card-outline-color: #e5e7eb;
}
.er-record-body {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}
.er-record-row {
	display: flex;
	gap: 12rpx;
	align-items: flex-start;
}
.er-record-row--remark .er-record-value {
	white-space: pre-wrap;
}
.er-record-label {
	min-width: 120rpx;
	font-size: 26rpx;
	color: #6b7280;
}
.er-record-value {
	flex: 1;
	font-size: 28rpx;
	color: #111827;
}
</style>
