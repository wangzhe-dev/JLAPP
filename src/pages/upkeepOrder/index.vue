<template>
	<PageLayout :title="pageTitle" :show-back="true">
		<view class="uo-container">
			<view v-if="loading" class="uo-loading">保养工单详情加载中...</view>
			<view v-else class="uo-body">
				<view class="uo-status-bar" v-if="statusChipText">
					<text class="uo-status__label">工单状态</text>
					<text :class="['uo-status__chip', statusStateClass]">{{
						statusChipText
					}}</text>
				</view>

				<CForm
					ref="formRef"
					v-model="form"
					:schema="schemaRef"
					@change="handleFieldChange"
				>
					<template v-if="planCards.length" #maintenanceItems>
						<div class="uo-plan-cards">
							<CCard
								v-for="item in planCards"
								:key="item.id"
								variant="outline"
								:title="item.title"
								:extra="item.subtitle"
								:lines="item.lines"
							/>
						</div>
					</template>
					<template v-if="detailImages.length" #detailImages>
						<view class="uo-detail-media">
							<image
								v-for="(img, index) in detailImages"
								:key="img.id || index"
								:src="img.src"
								mode="aspectFill"
								class="uo-detail-media__img"
								@tap="previewImage(index)"
							/>
						</view>
					</template>
					<template #changeParts>
						<ChangePartsList
							:items="form.upkeepFormData?.changeParts || []"
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
			:model-value="form.upkeepFormData?.changeParts || []"
			:fetcher="fetchSpareOptions"
			@confirm="onSparePartConfirm"
		/>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch } from "vue";
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import type {
	CFormExpose,
	CFormSchema,
	CFormSchemaField,
} from "@/components/c-form/types";
import CCard from "@/components/c-card/CCard.vue";
import ChangePartsList from "../maintainOrder/components/ChangePartsList.vue";
import SparePartSelector from "../maintainOrder/components/SparePartSelector.vue";
import { buildUpkeepFormFields } from "./upkeepFormSchema";
import {
	selectPlanOrder,
	getPartsManagementlist,
	submitOrder,
} from "@/api/order";
import { queryDictList } from "@/api/dict";
import { resolveStatusState } from "@/utils/status";
import { ensurePicturePreviewUrl } from "@/utils/picture";
import { formatDateTime } from "@/utils/date";
import { pad } from "@/utils/format";
import { toArray } from "@/utils/array";

const pageTitle = ref("填写保养记录");
const submitButtonText = ref("提交保养记录");

const formRef = ref<CFormExpose | null>(null);
const loading = ref<boolean>(true);
const submitting = ref<boolean>(false);
const id = ref<string>("");
const source = ref<string>("1");

const statusDict = ref<Record<string, string>>({});
const sparePartVisible = ref<boolean>(false);

const form = ref<Record<string, any>>({
	id: "",
	mtNo: "",
	planName: "",
	planTime: "",
	orderExecutorName: "",
	maintainTypeName: "",
	maintainLevel: "",
	maintainCycleName: "",
	equipmentName: "",
	equipmentCode: "",
	equipmentModel: "",
	factoryName: "",
	orderStatus: "",
	statusName: "",
	imageList: [],
	upkeepFormData: createUpkeepFormDefaults(),
});

const planItemsRaw = ref<any[]>([]);

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "240rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFields(),
}));

const detailImages = computed(() => normalizePictureList(form.value.imageList));

const planCards = computed(() =>
	planItemsRaw.value
		.map((item: any, index: number) => {
			if (!item) return null;
			const title =
				item.upkeepItem ||
				item.programName ||
				item.maintainItem ||
				`项目${index + 1}`;
			const subtitle = item.upkeepPart || item.maintainPart || "";
			const lines = [
				createLine(
					"保养级别",
					item.upkeepLevel || item.upkeepLevelName || item.maintainLevelName
				),
				createLine("保养部位", item.upkeepPart || item.maintainPart),
				createLine("保养工具", item.upkeepTools || item.tools),
				createLine("保养周期", item.upkeepCycle || item.maintainCycleName),
				createLine(
					"保养工时",
					formatDuration(item.upkeepTime || item.maintainTime)
				),
				createLine("说明", item.upkeepRemark || item.remark),
			].filter(Boolean);
			return {
				id: item.id || item.programId || `${index}`,
				title,
				subtitle,
				lines,
			};
		})
		.filter(Boolean)
);

const statusChipText = computed(() => {
	const code = String(form.value.orderStatus ?? "");
	if (!code || code === "-") return form.value.statusName || "";
	return statusDict.value[code] || form.value.statusName || "";
});

const statusState = computed(() =>
	statusChipText.value
		? resolveStatusState(statusChipText.value, form.value.orderStatus)
		: ""
);

const statusStateClass = computed(() =>
	statusState.value ? `is-${statusState.value}` : ""
);

function buildFields(): CFormSchemaField[] {
	const detailFields: CFormSchemaField[] = [
		{ groupTitle: "工单信息", prop: "_group_detail" },
		{
			label: "工单编号",
			prop: "mtNo",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-", copyable: true },
		},
		{
			label: "保养计划",
			prop: "planName",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			label: "计划执行时间",
			prop: "planTime",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			label: "执行人",
			prop: "orderExecutorName",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			label: "保养类型",
			prop: "maintainTypeName",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			label: "保养级别",
			prop: "maintainLevel",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			label: "保养周期",
			prop: "maintainCycleName",
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
			label: "设备编号",
			prop: "equipmentCode",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			label: "所在位置",
			prop: "factoryName",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-" },
		},
		{
			component: "GroupTitle",
			prop: "_group_planItems",
			groupTitle: "保养项目",
			visible: () => planCards.value.length > 0,
		},
		{
			component: "Slot",
			prop: "_slot_planItems",
			slotName: "maintenanceItems",
			visible: () => planCards.value.length > 0,
		},
		{
			component: "GroupTitle",
			prop: "_group_detail_images",
			groupTitle: "保养图片",
			visible: () => detailImages.value.length > 0,
		},
		{
			component: "Slot",
			prop: "_slot_detail_images",
			slotName: "detailImages",
			visible: () => detailImages.value.length > 0,
		},
	];

	return detailFields.concat(
		buildUpkeepFormFields({
			groupTitle: "填写保养记录",
		})
	);
}

const UPKEEP_FORM_PREFIX = "upkeepFormData.";

const upkeepFormKeySet = new Set<keyof UpkeepFormData>([
	"actualHour",
	"startTime",
	"finishTime",
	"remark",
	"changeParts",
]);

function parseUpkeepProp(prop: string) {
	const isUpkeep = prop?.startsWith(UPKEEP_FORM_PREFIX);
	const key = isUpkeep ? prop.slice(UPKEEP_FORM_PREFIX.length) : prop;
	return { isUpkeep, key } as {
		isUpkeep: boolean;
		key: keyof UpkeepFormData | string;
	};
}

function ensureUpkeepForm(): UpkeepFormData {
	const current = form.value.upkeepFormData;
	if (current && typeof current === "object") return current as UpkeepFormData;
	const next = createUpkeepFormDefaults();
	form.value.upkeepFormData = next;
	return next;
}

function updateUpkeepFormField(prop: string, value: any) {
	if (!upkeepFormKeySet.has(prop as keyof UpkeepFormData)) return;
	const target = ensureUpkeepForm();
	switch (prop) {
		case "changeParts":
			target.changeParts = Array.isArray(value) ? [...value] : [];
			break;
		default:
			(target as any)[prop] = value;
	}
}

function createUpkeepFormDefaults(): UpkeepFormData {
	return {
		actualHour: "",
		startTime: formatDateTime(Date.now()),
		finishTime: "",
		remark: "",
		changeParts: [],
	};
}

interface UpkeepChangePart {
	spareId: string;
	spareName: string;
	spareNum: number | "";
}

interface UpkeepFormData {
	actualHour: string;
	startTime: string;
	finishTime: string;
	remark: string;
	changeParts: UpkeepChangePart[];
}

function mapDictItems(list: any[]) {
	if (!Array.isArray(list)) return {};
	return list.reduce((acc: Record<string, string>, item: any) => {
		const val = item?.dictValue ?? item?.dictCode ?? item?.value;
		const label = item?.dictLabel ?? item?.dictName ?? item?.label;
		if (val !== undefined && val !== null && val !== "") {
			acc[String(val)] = label ? String(label) : String(val);
		}
		return acc;
	}, {} as Record<string, string>);
}

function refreshStatusName() {
	const code = String(form.value.orderStatus ?? "");
	if (!code) return;
	const label = statusDict.value[code];
	if (label) form.value.statusName = label;
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
			return [
				item.url ||
					item.src ||
					item.path ||
					item.pictureUrl ||
					item.imageUrl ||
					item,
			];
		})
		.map((item, index) => ({
			id: `${index}`,
			src: ensurePicturePreviewUrl(item),
		}))
		.filter((item) => !!item.src);
	return list;
}

function diffMinutes(start: any, end: any): number {
	const s = new Date(start);
	const e = new Date(end);
	if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
	const diff = e.getTime() - s.getTime();
	if (diff <= 0) return 0;
	return Math.round(diff / 60000);
}


function formatDuration(value: any) {
	if (value === undefined || value === null || value === "") return "";
	if (typeof value === "number") return `${value}`;
	return String(value);
}

function createLine(label: string, value: any) {
	if (value === undefined || value === null || value === "") return null;
	return { label, value: String(value) };
}

function sanitizeSpareNum(value: any): number | "" {
	if (value === undefined || value === null || value === "") return "";
	const num = Number(value);
	if (!Number.isFinite(num) || num <= 0) return "";
	return num;
}

function normalizeSparePart(item: any): UpkeepChangePart | null {
	const spareId = String(item?.spareId || item?.value || "");
	if (!spareId) return null;
	const spareName = item?.spareName || item?.label || "";
	if (!spareName) return null;
	const spareNum = sanitizeSpareNum(item?.spareNum ?? item?.quantity ?? 1);
	return { spareId, spareName, spareNum };
}

function openSparePartPop() {
	sparePartVisible.value = true;
}

function onSparePartChange(entry: any) {
	const upkeepForm = ensureUpkeepForm();
	const spare = normalizeSparePart(entry);
	if (!spare) return;
	const incoming = sanitizeSpareNum(spare.spareNum);
	const existing = upkeepForm.changeParts.find(
		(item) => item.spareId === spare.spareId
	);
	if (existing) {
		const current = sanitizeSpareNum(existing.spareNum);
		const base = current === "" ? 0 : current;
		const add = incoming === "" ? 0 : incoming;
		const next = base + add;
		existing.spareNum = next > 0 ? next : "";
	} else {
		upkeepForm.changeParts.push({
			spareId: spare.spareId,
			spareName: spare.spareName,
			spareNum: incoming,
		});
	}
	updateUpkeepFormField("changeParts", upkeepForm.changeParts);
}

function onSparePartConfirm(payload: any) {
	onSparePartChange(payload);
	console.log('[UpkeepOrder] 备件已确认');
	
	// ⭐ 必须返回 true 表示成功
	return true;
}

function removeSparePart(part: { spareId: string }) {
	const upkeepForm = ensureUpkeepForm();
	upkeepForm.changeParts = upkeepForm.changeParts.filter(
		(item) => item.spareId !== part.spareId
	);
	updateUpkeepFormField("changeParts", upkeepForm.changeParts);
}

async function fetchSpareOptions() {
	try {
		const resp = await getPartsManagementlist({});

		const selectedMap = new Map(
			(ensureUpkeepForm().changeParts || []).map((item: any) => [
				String(item.spareId || ""),
				Number(item.spareNum) || 1,
			])
		);
		return resp
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
	} catch (error) {
		console.warn("[UpkeepOrder] fetchSpareOptions failed", error);
		return [];
	}
}

function handleFieldChange(prop: string, value: any) {
	const { isUpkeep, key } = parseUpkeepProp(prop);
	if (!isUpkeep) return;
	const upkeepForm = ensureUpkeepForm();
	(upkeepForm as any)[key] = value;
	if (key in form.value) {
		(form.value as any)[key] = value;
	}
}

watch(
	() => [
		form.value.upkeepFormData?.startTime,
		form.value.upkeepFormData?.finishTime,
	],
	([start, end]) => {
		updateUpkeepFormField("startTime", start);
		updateUpkeepFormField("finishTime", end);
		if (!start || !end) return;
		const minutes = diffMinutes(start, end);
		if (!minutes) return;
		const hours = minutes / 60;
		const upkeepForm = ensureUpkeepForm();
		if (!upkeepForm.actualHour) {
			const formatted =
				hours >= 1 ? hours.toFixed(1) : Math.max(hours, 0).toFixed(2);
			upkeepForm.actualHour = String(parseFloat(formatted));
			updateUpkeepFormField("actualHour", upkeepForm.actualHour);
		}
	}
);

function previewImage(index: number) {
	const urls = detailImages.value.map((item) => item.src);
	if (!urls.length) return;
	uni.previewImage({
		urls,
		current: index,
	});
}

async function loadStatusDict() {
	try {
		const mapping = await queryDictList([
			"applet_maintenance_order_status",
			"my_applet_maintenance_order_status",
		]);
		statusDict.value = {
			...mapDictItems(mapping?.applet_maintenance_order_status || []),
			...mapDictItems(mapping?.my_applet_maintenance_order_status || []),
		};
		refreshStatusName();
	} catch (error) {
		console.warn("[UpkeepOrder] loadStatusDict failed", error);
	}
}

async function fetchDetail(showToast = true) {
	if (!id.value) {
		loading.value = false;
		uni.showToast({ title: "缺少工单信息", icon: "none" });
		return;
	}
	loading.value = true;
	try {
		const resp = await selectPlanOrder({ id: id.value });
		const data = resp?.data ?? resp ?? {};
		const planTime =
			data?.planTime ||
			data?.planMaintainTime ||
			data?.planExecuteTime ||
			data?.planStartTime ||
			"";
		const executor =
			data?.orderExecutor ||
			data?.orderExecutorName ||
			data?.executorName ||
			data?.maintainerName ||
			data?.maintainUserName ||
			"";
		form.value.mtNo =
			data?.mtNo ||
			data?.workOrderNo ||
			data?.orderNo ||
			data?.maintainNo ||
			"";
		form.value.planName = data?.planName || data?.maintainPlanName || "";
		form.value.planTime = planTime ? formatDateTime(planTime) : "";
		form.value.orderExecutorName = executor;
		form.value.maintainTypeName =
			data?.maintainTypeName ||
			data?.maintainType ||
			data?.maintainCategoryName ||
			"";
		form.value.maintainLevel =
			data?.maintainLevel || data?.maintainLevelName || data?.upkeepLevel || "";
		form.value.maintainCycleName =
			data?.maintainCycleName ||
			data?.maintainCycle ||
			data?.planCycleName ||
			"";
		form.value.equipmentName =
			data?.equipmentName || data?.deviceName || data?.equipmentInfoName || "";
		form.value.equipmentCode =
			data?.equipmentCode || data?.deviceCode || data?.equipmentInfoCode || "";
		form.value.equipmentModel =
			data?.equipmentModel ||
			data?.deviceModel ||
			data?.equipmentInfoModel ||
			"";
		form.value.factoryName =
			data?.factoryName || data?.factoryArea || data?.installLocation || "";
		const statusCode =
			data?.formStatus ??
			data?.orderStatus ??
			data?.status ??
			data?.statusCode ??
			"";
		form.value.orderStatus = statusCode ? String(statusCode) : "";
		form.value.statusName =
			statusDict.value[String(statusCode)] ||
			data?.formStatusName ||
			data?.orderStatusName ||
			data?.statusName ||
			"";
		form.value.imageList = normalizePictureList(
			data?.pictureLater || data?.maintainAfterImage || data?.afterImages || []
		);
		planItemsRaw.value = toArray(
			data?.selectProgramSpareDTOList ||
				data?.maintainItemList ||
				data?.programList ||
				[]
		);
		const upkeepForm = ensureUpkeepForm();
		upkeepForm.actualHour = data?.actualHour ? String(data.actualHour) : "";
		upkeepForm.startTime = data?.startTime
			? formatDateTime(data.startTime)
			: upkeepForm.startTime;
		upkeepForm.finishTime = data?.finishTime
			? formatDateTime(data.finishTime)
			: "";
		upkeepForm.remark = data?.remark || data?.maintainRemark || "";
		upkeepForm.changeParts = toArray(
			data?.jneSeSpareConnectionList || data?.selectPartsDTOList || []
		)
			.map((item: any) => ({
				spareId: String(item?.spareId || item?.id || ""),
				spareName: item?.spareName || item?.name || "",
				spareNum:
					Number(item?.spareNum || item?.quantity || 0) > 0
						? Number(item?.spareNum || item?.quantity || 0)
						: "",
			}))
			.filter((item) => item.spareId && item.spareName);
		form.value.upkeepFormData = upkeepForm;
		refreshStatusName();
	} catch (error) {
		console.warn("[UpkeepOrder] fetchDetail failed", error);
		if (showToast)
			uni.showToast({
				title: error?.msg || error?.message || "获取保养详情失败",
				icon: "none",
			});
	} finally {
		loading.value = false;
	}
}

function validateUpkeepForm(): boolean {
	const upkeepForm = ensureUpkeepForm();
	const hourNum = Number(upkeepForm.actualHour);
	if (!upkeepForm.actualHour || !Number.isFinite(hourNum) || hourNum <= 0) {
		uni.showToast({ title: "请输入实际工时", icon: "none" });
		return false;
	}
	if (!upkeepForm.startTime) {
		uni.showToast({ title: "请选择开始时间", icon: "none" });
		return false;
	}
	if (!upkeepForm.finishTime) {
		uni.showToast({ title: "请选择结束时间", icon: "none" });
		return false;
	}
	return true;
}

async function handleSubmit() {
	if (submitting.value) return;
	const valid = await formRef.value?.validate();
	if (!valid) return;
	if (!validateUpkeepForm()) return;
	const upkeepForm = ensureUpkeepForm();
	try {
		submitting.value = true;
		const payload = {
			id: id.value,
			actualHour: Number(upkeepForm.actualHour),
			startTime: upkeepForm.startTime,
			finishTime: upkeepForm.finishTime,
			pictureLater: "",
			jneSeSpareConnectionList: (upkeepForm.changeParts || []).map((item) => ({
				spareId: item.spareId,
				spareName: item.spareName,
				spareNum: Number(item.spareNum || 0),
			})),
			remark: upkeepForm.remark,
		};
		await submitOrder(payload);
		uni.showToast({ title: "提交成功", icon: "success" });
		setTimeout(() => uni.navigateBack(), 600);
	} catch (error) {
		console.warn("[UpkeepOrder] submit failed", error);
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
	if (options?.source) source.value = String(options.source);
	if (options?.id) id.value = String(options.id);

	loadStatusDict();
	fetchDetail();
});

onPullDownRefresh(async () => {
	await fetchDetail(false);
	uni.stopPullDownRefresh();
});
</script>

<style scoped lang="scss">
.uo-container {
	min-height: 100vh;
	background: #f3f4f6;
	display: flex;
	flex-direction: column;
}

.uo-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px;
}

.uo-loading {
	padding: 48px 16px;
	text-align: center;
	color: #9ca3af;
}

.uo-status-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	border-radius: 12px;
	background: #fff;
	margin-bottom: 8px;
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.uo-status__label {
	font-size: 14px;
	color: #6b7280;
}

.uo-status__chip {
	padding: 4px 12px;
	border-radius: 999px;
	font-size: 13px;
	font-weight: 600;
	background: #e5e7eb;
	color: #1f2937;
}

.uo-status__chip.is-success,
.uo-status__chip.is-done {
	background: rgba(16, 185, 129, 0.16);
	color: #065f46;
}

.uo-status__chip.is-warning {
	background: rgba(249, 115, 22, 0.16);
	color: #92400e;
}

.uo-status__chip.is-fail {
	background: rgba(248, 113, 113, 0.18);
	color: #991b1b;
}

.uo-status__chip.is-processing {
	background: rgba(37, 99, 235, 0.12);
	color: #1f2937;
}

.uo-status__chip.is-pending {
	background: rgba(245, 158, 11, 0.18);
	color: #92400e;
}

.uo-detail-media {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
}

.uo-detail-media__img {
	width: 96px;
	height: 96px;
	border-radius: 8px;
	background: #f3f4f6;
	overflow: hidden;
}

.uo-plan-cards {
	display: flex;
	flex-direction: column;
	gap: 12px;
}
</style>
