<template>
	<PageLayout :title="pageTitle" :show-back="true">
		<view class="mo-container">
			<view v-if="loading" class="mo-loading">工单详情加载中...</view>
			<view v-else class="mo-body">
				<view class="mo-status-bar" v-if="statusChipText">
					<text class="mo-status__label">工单状态</text>
					<text :class="['mo-status__chip', statusStateClass]">
						{{ statusChipText }}
					</text>
				</view>

				<CForm
					ref="formRef"
					v-model="form"
					:schema="schemaRef"
					@change="handleFieldChange"
				>
					<template v-if="dispatchRecords.length" #dispatchRecords>
						<view class="mo-slot-cards">
							<CCard
								v-for="(record, index) in dispatchRecords"
								:key="record.id || record.dispatchId || index"
								variant="outline"
								:title="record.isPass"
								:extra="record.createdTime"
								:lines="resolveDispatchLines(record)"
							/>
						</view>
					</template>
					<template v-if="repairRecords.length" #repairRecords>
						<view class="mo-slot-cards">
							<CCard
								v-for="(record, index) in repairRecords"
								:key="record.id || record.repairId || index"
								variant="outline"
								:extra="record.createdTime"
								:title="record.equipmentName"
								:lines="resolveRepairLines(record)"
							/>
						</view>
					</template>
					<template v-if="detailImages.length" #faultImages>
						<view class="mo-detail-media">
							<image
								v-for="(img, index) in detailImages"
								:key="img.id || index"
								:src="img.src"
								mode="aspectFill"
								class="mo-detail-media__img"
								@tap="previewImage(index)"
							/>
						</view>
					</template>
					<template #changeParts>
						<ChangePartsList
							:items="form.repairFormData?.changeParts || []"
							@remove="removeSparePart"
						/>
					</template>
					<template #changePartsActions>
						<sar-icon name="plus" size="42rpx" @tap="openSparePartPop" />
					</template>

					<template #actions>
						<sar-row>
							<sar-button
								round
								block
								theme="primary"
								:loading="submitting"
								@tap="handleSubmit"
							>
								{{ submitButtonText }}
							</sar-button>
						</sar-row>
					</template>
				</CForm>
			</view>
		</view>
		<SparePartSelector
			v-model:visible="sparePartVisible"
			:model-value="form.repairFormData?.changeParts || []"
			:fetcher="fetchSpareOptions"
			@confirm="onSparePartConfirm"
		/>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, reactive, ref, watch } from "vue";
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import type {
	CFormExpose,
	CFormSchema,
	CFormSchemaField,
} from "@/components/c-form/types";
import {
	orderListDetail,
	selectFaultReasonType,
	selectFaultReason,
	selectFaultMeasureType,
	selectFaultMeasure,
	getPartsManagementlist,
	equipmentRepairAdd,
	getRepairMessage,
} from "@/api/order";
import SparePartSelector from "./components/SparePartSelector.vue";
import ChangePartsList from "./components/ChangePartsList.vue";
import CCard from "@/components/c-card/CCard.vue";
import { queryDictList } from "@/api/dict";
import { ensurePicturePreviewUrl } from "@/utils/picture";
import { resolveStatusState } from "@/utils/status";
import { requestUrl } from "@/config";
import { buildRepairFormFields } from "./repairFormSchema";
import type { OptionItem } from "./repairFormSchema";
import { isH5 } from "@/utils/platform";

function toArray<T>(input: T | T[] | null | undefined): T[] {
	if (!input) return [];
	return Array.isArray(input) ? input : [input];
}

function normalizePictureList(raw: any): Array<{ id: string; src: string }> {
	const list = toArray(raw)
		.flatMap((item: any) => {
			if (!item) return [];
			if (typeof item === "string")
				return item
					.split(/[,;]/)
					.map((s) => s.trim())
					.filter(Boolean);
			return [item.url || item.src || item.path || item];
		})
		.map((item, index) => ({
			id: `${index}`,
			src: ensurePicturePreviewUrl(item),
		}))
		.filter((item) => !!item.src);
	return list;
}

function normalizeImagePathList(input: any): string {
	if (!input) return "";
	const list = Array.isArray(input) ? input : [input];
	const urls = list
		.map((item: any) => {
			if (!item) return "";
			if (typeof item === "string") return item.trim();
			return (
				item.url ||
				item.resultUrl ||
				item.originUrl ||
				item.path ||
				item.tempFilePath ||
				item.src ||
				(item.response && (item.response.url || item.response.data)) ||
				""
			);
		})
		.map((url: any) => (typeof url === "string" ? url.trim() : ""))
		.filter((url: string) => !!url);
	return urls.join(",");
}

function formatDateTime(value: any) {
	if (!value && value !== 0) return "";
	if (typeof value === "string" && /\d{4}-\d{2}-\d{2}/.test(value))
		return value;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value ?? "");
	const pad = (num: number) => (num < 10 ? `0${num}` : `${num}`);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
		date.getSeconds()
	)}`;
}

const isPcClient = isH5();

function getNowDateTime() {
	return formatDateTime(Date.now());
}

type RepairChangePart = {
	spareId: string;
	spareName: string;
	spareNum: number;
};

interface RepairFormData {
	orderStatus: string;
	repairStartTime: string;
	repairEndTime: string;
	changeParts: RepairChangePart[];
	repairProcess: string;
	reason: string;
	imagePath: any[];
	faultReasonTypeCode: string;
	faultReasonTypeDesc: string;
	faultReasonCode: string;
	faultReasonDesc: string;
	faultMeasureTypeCode: string;
	faultMeasureTypeDesc: string;
	faultMeasureCode: string;
	faultMeasureDesc: string;
	maintenanceTime: string | number | undefined;
	repairReasonCode: string;
	repairReason: string;
}

function createRepairFormDefaults(): RepairFormData {
	return {
		equipmentCode: "", //设备编号
		equipmentName: "", //设备名称
		faultReasonTypeCode: "", //故障原因分类编码
		faultReasonTypeDesc: "", //故障原因分类描述
		faultReasonCode: "", //故障原因编码
		faultReasonDesc: "", //故障原因描述
		faultMeasureCode: "", //故障措施编码
		faultMeasureDesc: "", //故障措施描述
		faultMeasureTypeCode: "", //故障措施分类编码
		faultMeasureTypeDesc: "", //故障措施分类描述
		repairProcess: "", //维修过程
		repairStartTime: "", //开始时间
		repairEndTime: "", //结束时间
		repairReasonCode: "",
		repairReason: "", //维修结果
		reason: "", //建议或原因
		maintenanceTime: "",
		imagePath: [], //维修图片
		changeParts: [],
	};
}

const repairFormKeySet = new Set<keyof RepairFormData>([
	"repairStartTime",
	"repairEndTime",
	"changeParts",
	"repairProcess",
	"reason",
	"imagePath",
	"faultReasonTypeCode",
	"faultReasonTypeDesc",
	"faultReasonCode",
	"faultReasonDesc",
	"faultMeasureTypeCode",
	"faultMeasureTypeDesc",
	"faultMeasureCode",
	"faultMeasureDesc",
	"maintenanceTime",
	"repairReasonCode",
	"repairReason",
]);

const REPAIR_FORM_PREFIX = "repairFormData.";

function parseRepairProp(prop: string) {
	const isRepair = prop?.startsWith(REPAIR_FORM_PREFIX);
	const key = isRepair ? prop.slice(REPAIR_FORM_PREFIX.length) : prop;
	return { isRepair, key };
}

function diffMinutes(start: any, end: any) {
	if (!start || !end) return "";
	const startDate = new Date(start);
	const endDate = new Date(end);
	if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "";
	const diffMs = endDate.getTime() - startDate.getTime();
	if (diffMs < 0) return "";
	const minutes = diffMs / 60000;
	if (!Number.isFinite(minutes)) return "";
	return minutes >= 1 ? Math.round(minutes).toString() : minutes.toFixed(1);
}

function resolveDispatchLines(record: any) {
	const lines: Array<{ label: string; value: string }> = [];
	const add = (label: string, value: any) => {
		if (value === undefined || value === null || value === "") return;
		const text = typeof value === "string" ? value.trim() : String(value);
		if (!text) return;
		lines.push({ label, value: text });
	};
	add("派工人", record?.leaderName || record?.dispatchUserName);
	add("接收人", record?.repairName || record?.receiveUserName);
	add("预计维修日期", record?.expectRepairTime);
	add("派工时间", record?.createdTime);
	return lines;
}

function formatChangeParts(list: any) {
	if (!Array.isArray(list) || !list.length) return "";
	const parts = list
		.map((item) => {
			const name = item?.spareName || item?.name || "";
			if (!name) return "";
			const qty = item?.spareNum ?? item?.quantity;
			if (qty === undefined || qty === null || qty === "") return name;
			return `${name}×${qty}`;
		})
		.filter(Boolean);
	return parts.join("；");
}

function resolveRepairLines(record: any) {
	const primaryLineCount = 3;
	const lines: any[] = [];
	const addLine = (label: string, raw: any) => {
		if (raw === undefined || raw === null || raw === "") return;
		const text = typeof raw === "string" ? raw.trim() : String(raw);
		if (!text) return;
		lines.push({ label, value: text });
	};

	addLine("故障原因", record?.faultReasonDesc || "-");

	const changePartsText = formatChangeParts(record);
	lines.push({
		label: "更换部件",
		value: changePartsText || "-",
	});

	addLine("维修过程", record?.repairProcess ?? "-");
	addLine("开始时间", record?.repairStartTime);
	addLine("结束时间", record?.repairEndTime);
	addLine("维修净时(min)", record?.maintenanceTime ?? "-");
	addLine("维修结果", record?.repairReason ?? record?.repairResult ?? "-");
	addLine("原因或建议", record?.reason ?? record?.suggestion ?? "-");

	const pictures = normalizePictureList(
		record?.imagePath ?? record?.repairImagePath ?? record?.images
	);
	if (pictures.length) {
		lines.push({
			label: "维修图片",
			// value: `${pictures.length}张`,
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

const pageTitle = ref("填写维修记录");
const submitButtonText = ref("保存维修记录");
const formMode = ref<"repair" | "again">("repair");

const formRef = ref<CFormExpose | null>(null);
const loading = ref<boolean>(true);
const submitting = ref<boolean>(false);
const id = ref<string>("");
const form = ref<Record<string, any>>({
	id: "",
	orderCode: "",
	equipmentCode: "",
	equipmentName: "",
	repairName: "",
	factoryName: "",
	faultTypeDesc: "",
	expectRepairTime: "",
	problemDetail: "",
	orderStatus: "",
	statusName: "",
	imageList: [],
	repairReasonCode: "",
	repairReason: "",
	faultReasonTypeCode: "",
	faultReasonTypeDesc: "",
	faultReasonCode: "",
	faultReasonDesc: "",
	faultMeasureTypeCode: "",
	faultMeasureTypeDesc: "",
	faultMeasureCode: "",
	faultMeasureDesc: "",
	repairStartTime: "",
	repairEndTime: "",
	maintenanceTime: undefined,
	repairProcess: "",
	reason: "",
	imagePath: [],
	changeParts: [],
	repairFormData: createRepairFormDefaults(),
});

const statusDict = ref<Array<{ dictValue: string; dictLabel: string }>>([]);
const repairResultOptions = ref<OptionItem[]>([]);
const faultReasonTypeOptions = ref<OptionItem[]>([]);
const faultReasonOptions = ref<OptionItem[]>([]);
const faultMeasureTypeOptions = ref<OptionItem[]>([]);
const faultMeasureOptions = ref<OptionItem[]>([]);
const dispatchRecords = ref<any[]>([]);
const repairRecords = ref<any[]>([]);

const faultReasonTypeMap = reactive(new Map<string, any>());
const faultMeasureTypeMap = reactive(new Map<string, any>());

function ensureRepairForm(): RepairFormData {
	const current = form.value.repairFormData;
	if (current && typeof current === "object") return current;
	const next = createRepairFormDefaults();
	form.value.repairFormData = next;
	return next;
}

function updateRepairFormField(prop: string, value: any) {
	if (!repairFormKeySet.has(prop as keyof RepairFormData)) return;
	const target = ensureRepairForm();
	switch (prop) {
		case "imagePath":
			target.imagePath = Array.isArray(value) ? [...value] : [];
			break;
		case "maintenanceTime":
			target.maintenanceTime = value === "" ? undefined : value;
			break;
		default:
			// 保持字符串或原值，避免 undefined 破坏默认
			target[prop as keyof RepairFormData] =
				value === undefined ? "" : (value as any);
			break;
	}
	const mirrorValue = target[prop as keyof RepairFormData];
	if (prop in form.value) {
		(form.value as any)[prop] = mirrorValue;
	}
}

function applyRepairTimeDefaults(expectTime?: any) {
	const repairForm = ensureRepairForm();
	if (!repairForm.repairStartTime) {
		const preferExpect = isPcClient && expectTime;
		const startValue = preferExpect
			? formatDateTime(expectTime)
			: getNowDateTime();
		repairForm.repairStartTime = startValue;
		updateRepairFormField("repairStartTime", startValue);
	}
	// if (isPcClient && !repairForm.repairEndTime) {
	// 	const endValue = getNowDateTime();
	// 	repairForm.repairEndTime = endValue;
	// 	updateRepairFormField("repairEndTime", endValue);
	// }
}

const detailImages = computed(() => normalizePictureList(form.value.imageList));

const statusChipText = computed(() => {
	const code = String(form.value.orderStatus ?? "");
	if (!code) return form.value.statusName || "";
	const hit = statusDict.value.find((item) => item.dictValue === code);
	return hit?.dictLabel || form.value.statusName || "";
});

const statusState = computed(() =>
	statusChipText.value
		? resolveStatusState(statusChipText.value, form.value.orderStatus)
		: ""
);

const statusStateClass = computed(() =>
	statusState.value ? `is-${statusState.value}` : ""
);

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "240rpx",
	layout: "vertical",
	showActions: true,
	fields: buildFields(),
}));

const sparePartVisible = ref<boolean>(false);

function buildFields(): CFormSchemaField[] {
	const detailFields: CFormSchemaField[] = [
		{ groupTitle: "报修信息", prop: "_group_detail" },
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
			label: "执行人",
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
			label: "报修时间",
			prop: "expectRepairTime",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			label: "问题描述",
			prop: "problemDetail",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			component: "GroupTitle",
			groupTitle: "报修图片",
			visible: () => detailImages.value.length > 0,
			prop: "_group_fault_images",
		},
		{
			component: "Slot",
			slotName: "faultImages",
			visible: () => detailImages.value.length > 0,
			prop: "_slot_fault_images",
		},
	];

	const historyFields: CFormSchemaField[] = [];

	if (dispatchRecords.value.length > 0) {
		historyFields.push({
			component: "GroupTitle",
			groupTitle: "派工记录",
			prop: "_group_dispatch_records",
		});
		historyFields.push({
			component: "Slot",
			slotName: "dispatchRecords",
			prop: "_slot_dispatch_records",
		});
	}

	if (repairRecords.value.length > 0) {
		historyFields.push({
			component: "GroupTitle",
			groupTitle: "维修记录",
			prop: "_group_history_repair",
		});
		historyFields.push({
			component: "Slot",
			slotName: "repairRecords",
			prop: "_slot_history_repair",
		});
	}

	return detailFields.concat(historyFields).concat(
		buildRepairFormFields({
			repairResultOptions,
			faultReasonTypeOptions,
			faultReasonOptions,
			faultMeasureTypeOptions,
			faultMeasureOptions,
			requestUrl,
			repairGroupTitle: "填写维修记录",
			getRepairStartDefault: () =>
				form.value.expectRepairTime
					? formatDateTime(form.value.expectRepairTime)
					: getNowDateTime(),
		})
	);
}

async function loadStatusDict() {
	try {
		const mapping = await queryDictList([
			"repair_order_status_type",
			"repair_result_type",
		]);
		statusDict.value = toArray(mapping?.repair_order_status_type).map(
			(item: any) => ({
				dictValue: String(item.dictValue ?? item.dictCode ?? ""),
				dictLabel: item.dictLabel ?? item.dictName ?? "",
			})
		);
		repairResultOptions.value = toArray(mapping?.repair_result_type).map(
			(item: any) => ({
				label: item.dictLabel ?? item.dictName ?? "",
				value: String(item.dictValue ?? item.dictCode ?? ""),
				raw: item,
			})
		);
	} catch (error) {
		console.warn("[MaintainOrder] loadStatusDict failed", error);
	}
}

async function loadFaultReasonTypeList() {
	try {
		const resp = await selectFaultReasonType({});
		const list = resp?.data || resp || [];
		faultReasonTypeOptions.value = list.map((item: any) => {
			const code =
				item.faultReasonTypeCode || item.code || String(item.id || "");
			faultReasonTypeMap.set(code, item);
			return {
				label: item.faultReasonTypeDesc || item.name || item.desc || "",
				value: code,
				raw: item,
			};
		});
	} catch (error) {
		console.warn("[MaintainOrder] loadFaultReasonTypeList failed", error);
	}
}

async function loadFaultReasonList(typeCode: string) {
	const raw = faultReasonTypeMap.get(typeCode);
	if (!raw?.id) {
		faultReasonOptions.value = [];
		return;
	}
	try {
		const resp = await selectFaultReason({ faultReasonTypeId: raw.id });
		const list = resp?.data || resp || [];
		faultReasonOptions.value = list.map((item: any) => ({
			label: item.faultReasonDesc || item.name || "",
			value: item.faultReasonCode || item.code || String(item.id || ""),
			raw: item,
		}));
	} catch (error) {
		faultReasonOptions.value = [];
		console.warn("[MaintainOrder] loadFaultReasonList failed", error);
	}
}

async function loadFaultMeasureTypeList() {
	try {
		const resp = await selectFaultMeasureType({});
		const list = resp?.data || resp || [];
		faultMeasureTypeOptions.value = list.map((item: any) => {
			const code =
				item.faultMeasureTypeCode || item.code || String(item.id || "");
			faultMeasureTypeMap.set(code, item);
			return {
				label: item.faultMeasureTypeDesc || item.name || "",
				value: code,
				raw: item,
			};
		});
	} catch (error) {
		console.warn("[MaintainOrder] loadFaultMeasureTypeList failed", error);
	}
}

async function loadFaultMeasureList(typeCode: string) {
	const raw = faultMeasureTypeMap.get(typeCode);
	if (!raw?.id) {
		faultMeasureOptions.value = [];
		return;
	}
	try {
		const resp = await selectFaultMeasure({ faultMeasureTypeId: raw.id });
		const list = resp?.data || resp || [];
		faultMeasureOptions.value = list.map((item: any) => ({
			label: item.faultMeasureDesc || item.name || "",
			value: item.faultMeasureCode || item.code || String(item.id || ""),
			raw: item,
		}));
	} catch (error) {
		faultMeasureOptions.value = [];
		console.warn("[MaintainOrder] loadFaultMeasureList failed", error);
	}
}

async function fetchSpareOptions() {
	try {
		const resp = await getPartsManagementlist({});

		const repairForm = ensureRepairForm();
		// repairForm.changeParts = repairForm.changeParts.filter(
		// 	(item: any) => item.spareId !== part.spareId
		// );
		// 使用当前表单中的已选备件列表
		const selectedMap = new Map(
			(repairForm.changeParts || []).map((item: any) => [
				String(item.spareId || ""),
				Number(item.spareNum) || 0,
			])
		);

		const result = resp
			.map((item: any) => {
				const value = String(item?.id || item?.materialCode || "");
				if (!value) return null;
				const label = item?.spareName || item?.materialName || "";
				if (!label) return null;
				const baseQty = Number(item?.spareNum || item?.quantity || 1);
				const quantity = Number.isFinite(baseQty) && baseQty > 0 ? baseQty : 1;
				const selectedQty = selectedMap.get(value) || 0;
				return {
					spareId: value,
					spareName: label,
					quantity,
					spareNum: selectedQty,
				};
			})
			.filter(Boolean);
		return result;
	} catch (error) {
		console.warn("[UpkeepOrder] fetchSpareOptions failed", error);
		return [];
	}
}

async function fetchDetail(showToast = true) {
	if (!id.value) return;
	loading.value = true;
	try {
		dispatchRecords.value = [];
		repairRecords.value = [];
		const payload = await orderListDetail({ id: id.value });
		const data = payload?.data ?? payload ?? {};
		let detail = data?.equipmentRepaircommit;
		if (Array.isArray(detail)) detail = detail[0] ?? {};
		const next: Record<string, any> = {
			id: detail?.id || id.value,
			orderCode: id.value,
			equipmentCode: detail?.equipmentCode || "-",
			equipmentName: detail?.equipmentName || "-",
			repairName: detail?.repairName || detail?.maintainUserName || "-",
			factoryName: detail?.factoryName || detail?.equipmentFactoryName || "-",
			faultTypeDesc: detail?.faultTypeDesc || detail?.faultTypeName || "-",
			expectRepairTime: detail?.expectRepairTime,
			problemDetail: detail?.problemDetail || detail?.faultDesc || "-",
			orderStatus: detail?.orderStatus || data?.orderStatus || "-",
			statusName: detail?.orderStatusName || data?.statusName || "-",
			imageList:
				detail?.imagePath || detail?.faultPic || detail?.pictures || [],
		};
		Object.assign(form.value, next);

		dispatchRecords.value = toArray(
			data?.equipmentRepairdispatches || data?.dispatchRecords || []
		);

		const repairFormState = ensureRepairForm();
		if (repairFormState.faultReasonTypeCode)
			loadFaultReasonList(repairFormState.faultReasonTypeCode);
		if (repairFormState.faultMeasureTypeCode)
			loadFaultMeasureList(repairFormState.faultMeasureTypeCode);
	} catch (error) {
		console.warn("[MaintainOrder] fetchDetail failed", error);
		if (showToast)
			uni.showToast({
				title: error?.msg || error?.message || "工单详情获取失败",
				icon: "none",
			});
	} finally {
		applyRepairTimeDefaults(form.value.expectRepairTime);
		loading.value = false;
	}
}

async function fetchRepairRecords(showToast = false) {
	if (!id.value) return;
	try {
		const resp = await getRepairMessage({ id: id.value });
		const list = toArray(resp?.data ?? resp ?? []);
		repairRecords.value = list;
	} catch (error) {
		console.warn("[MaintainOrder] fetchRepairRecords failed", error);
		if (showToast) {
			uni.showToast({
				title: error?.msg || error?.message || "维修记录获取失败",
				icon: "none",
			});
		}
	}
}

function handleFieldChange(prop: string, value: any) {
	const { isRepair, key } = parseRepairProp(prop);
	const repairForm = ensureRepairForm();
	if (isRepair) {
		(repairForm as any)[key] = value;
		if (key in form.value) (form.value as any)[key] = value;
	}
	if (key === "repairReasonCode") {
		const option = repairResultOptions.value.find(
			(item) => item.value === value
		);
		repairForm.repairReason = option?.label || "";
		form.value.repairReason = repairForm.repairReason;
		updateRepairFormField("repairReason", repairForm.repairReason);
	}
	if (key === "faultReasonTypeCode") {
		const option = faultReasonTypeOptions.value.find(
			(item) => item.value === value
		);
		repairForm.faultReasonTypeDesc = option?.label || "";
		repairForm.faultReasonCode = "";
		repairForm.faultReasonDesc = "";
		form.value.faultReasonTypeDesc = repairForm.faultReasonTypeDesc;
		form.value.faultReasonCode = "";
		form.value.faultReasonDesc = "";
		faultReasonOptions.value = [];
		if (option) loadFaultReasonList(option.value);
		updateRepairFormField(
			"faultReasonTypeDesc",
			repairForm.faultReasonTypeDesc
		);
		updateRepairFormField("faultReasonCode", repairForm.faultReasonCode);
		updateRepairFormField("faultReasonDesc", repairForm.faultReasonDesc);
	}
	if (key === "faultReasonCode") {
		const option = faultReasonOptions.value.find(
			(item) => item.value === value
		);
		repairForm.faultReasonDesc = option?.label || "";
		form.value.faultReasonDesc = repairForm.faultReasonDesc;
		updateRepairFormField("faultReasonDesc", repairForm.faultReasonDesc);
	}
	if (key === "faultMeasureTypeCode") {
		const option = faultMeasureTypeOptions.value.find(
			(item) => item.value === value
		);
		repairForm.faultMeasureTypeDesc = option?.label || "";
		repairForm.faultMeasureCode = "";
		repairForm.faultMeasureDesc = "";
		form.value.faultMeasureTypeDesc = repairForm.faultMeasureTypeDesc;
		form.value.faultMeasureCode = "";
		form.value.faultMeasureDesc = "";
		faultMeasureOptions.value = [];
		if (option) loadFaultMeasureList(option.value);
		updateRepairFormField(
			"faultMeasureTypeDesc",
			repairForm.faultMeasureTypeDesc
		);
		updateRepairFormField("faultMeasureCode", repairForm.faultMeasureCode);
		updateRepairFormField("faultMeasureDesc", repairForm.faultMeasureDesc);
	}
	if (key === "faultMeasureCode") {
		const option = faultMeasureOptions.value.find(
			(item) => item.value === value
		);
		repairForm.faultMeasureDesc = option?.label || "";
		form.value.faultMeasureDesc = repairForm.faultMeasureDesc;
		updateRepairFormField("faultMeasureDesc", repairForm.faultMeasureDesc);
	}
	updateRepairFormField(key, value);
}

watch(
	() => [
		form.value.repairFormData?.repairStartTime,
		form.value.repairFormData?.repairEndTime,
	],
	([start, end]) => {
		updateRepairFormField("repairStartTime", start);
		updateRepairFormField("repairEndTime", end);
		if (!start || !end) return;
		const diff = diffMinutes(start, end);
		const repairForm = ensureRepairForm();
		// if (diff && !repairForm.maintenanceTime) {
		// 	repairForm.maintenanceTime = diff;
		// }
		// updateRepairFormField("maintenanceTime", repairForm.maintenanceTime);
	}
);

function openSparePartPop() {
	sparePartVisible.value = true;
}

function normalizeSparePart(item: any) {
	const spareId = String(item?.spareId || item?.value || "");
	if (!spareId) return null;
	const spareName = item?.spareName || item?.label || "";
	if (!spareName) return null;
	const spareNum = sanitizeSpareNum(item?.spareNum ?? item?.quantity);
	return { spareId, spareName, spareNum };
}

function sanitizeSpareNum(value: any): number | "" {
	if (value === undefined || value === null || value === "") return "";
	const num = Number(value);
	if (!Number.isFinite(num) || num <= 0) return "";
	return num;
}

function onSparePartConfirm(payloadList: any) {
	if (!Array.isArray(payloadList) || !payloadList.length) {
		console.warn("[MaintainOrder] onSparePartConfirm: 无效的 payloadList");
		return true;
	}

	const currentList = [];
	payloadList.forEach((payload) => {
		if (!payload || !payload.spareId) return;
		currentList.push({
			spareId: payload.spareId,
			spareName: payload.spareName,
			quantity: payload.quantity,
			spareNum: payload.spareNum,
		});
	});

	// 直接更新 form.value.repairFormData.changeParts 以确保响应式更新
	const repairForm = ensureRepairForm();
	repairForm.changeParts = currentList;

	// 强制触发响应式更新
	form.value = { ...form.value };

	console.log("[MaintainOrder] 备件已添加:", repairForm.changeParts);
	console.log("[MaintainOrder] 当前表单数据:", form.value.repairFormData?.changeParts);
	return true;
}

function removeSparePart(part: { spareId?: string }) {
	if (!part?.spareId) return;
	const repairForm = ensureRepairForm();
	const prevList = Array.isArray(repairForm.changeParts)
		? repairForm.changeParts
		: [];
	if (!prevList.length) return;
	const nextList = prevList.filter(
		(item: any) => String(item?.spareId) !== String(part.spareId)
	);
	if (nextList.length === prevList.length) return;
	repairForm.changeParts = nextList;
	updateRepairFormField("changeParts", nextList);

	// 强制触发响应式更新
	form.value = { ...form.value };
	console.log("[MaintainOrder] 备件已移除，剩余:", repairForm.changeParts);
}

function previewImage(index: number) {
	const urls = detailImages.value.map((item) => item.src);
	if (!urls.length) return;
	uni.previewImage({
		urls,
		current: index,
	});
}

async function handleSubmit() {
	if (submitting.value) return;
	try {
		const valid = await formRef.value?.validate();
		if (!valid) return;
		submitting.value = true;
		const repairForm = ensureRepairForm();
		const payload = {
			orderIds: id.value,
			equipmentRepair: {
				...repairForm,
				orderId: id.value,
				equipmentCode: form.value.equipmentCode,
				equipmentName: form.value.equipmentName,
				imagePath: normalizeImagePathList(repairForm.imagePath),
				changeParts: repairForm.changeParts.map((item: any) => ({
					spareId: item.spareId,
					spareName: item.spareName,
					spareNum: item.spareNum,
				})),
			},
		};

		await equipmentRepairAdd(payload);
		uni.showToast({ title: "提交成功", icon: "success" });
		setTimeout(() => uni.navigateBack(), 600);
	} catch (error) {
		console.warn("[MaintainOrder] submit failed", error);
		uni.showToast({
			title: error?.msg || error?.message || "提交失败",
			icon: "none",
		});
	} finally {
		submitting.value = false;
	}
}

onLoad((options: Record<string, any>) => {
	const modeParam = typeof options?.mode === "string" ? options.mode : "";
	if (modeParam === "again") {
		formMode.value = "again";
		pageTitle.value = "再次维修";
		submitButtonText.value = "提交再次维修";
	} else {
		formMode.value = "repair";
		pageTitle.value = "填写维修记录";
		submitButtonText.value = "保存维修记录";
	}

	if (options?.id) id.value = String(options.id);
	loadStatusDict();
	loadFaultReasonTypeList();
	loadFaultMeasureTypeList();
	fetchDetail();
	fetchRepairRecords();
});

onPullDownRefresh(async () => {
	await fetchDetail(false);
	await fetchRepairRecords(true);
	uni.stopPullDownRefresh();
});
</script>

<style scoped lang="scss">
.mo-container {
	min-height: 100vh;
	background: #f3f4f6;
	display: flex;
	flex-direction: column;
}

.mo-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
	// padding: 16px;
}

.mo-loading {
	padding: 48px 16px;
	text-align: center;
	color: #9ca3af;
}

.mo-status-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	background: #fff;
	border-radius: 12px;
	margin: 12px 8px 0 8px;
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.mo-status__label {
	font-size: 14px;
	color: #6b7280;
}

.mo-status__chip {
	padding: 4px 12px;
	border-radius: 999px;
	font-size: 13px;
	font-weight: 600;
	background: #e5e7eb;
	color: #1f2937;
}

.mo-status__chip.is-success,
.mo-status__chip.is-done {
	background: rgba(16, 185, 129, 0.16);
	color: #065f46;
}

.mo-status__chip.is-warning {
	background: rgba(249, 115, 22, 0.16);
	color: #92400e;
}

.mo-status__chip.is-fail {
	background: rgba(248, 113, 113, 0.18);
	color: #991b1b;
}

.mo-status__chip.is-processing {
	background: rgba(37, 99, 235, 0.12);
	color: #1f2937;
}

.mo-status__chip.is-pending {
	background: rgba(245, 158, 11, 0.18);
	color: #92400e;
}

.mo-detail-media {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
}

.mo-detail-media__img {
	width: 96px;
	height: 96px;
	border-radius: 8px;
	overflow: hidden;
	background: #f3f4f6;
}

.mo-slot-cards {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.mo-footer {
	margin-top: auto;
	padding: 0 16px 24px;
}
</style>
