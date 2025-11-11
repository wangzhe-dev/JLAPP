<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="approval-popout">
			<!-- 采用 CForm 承载结构化信息，便于后续扩展字段 -->
			<CForm
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				v-if="visible"
				class="approval-popout__form"
			>
				<template v-if="repairRecords.length" #repairRecords>
					<div class="approval-popout__records">
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
			</CForm>
		</view>
	</sar-popout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch } from "vue";
import { CForm } from "@/components/c-form";
import type {
	CFormExpose,
	CFormSchema,
	CFormSchemaField,
} from "@/components/c-form/types";

import CCard from "@/components/c-card/CCard.vue";
import { ensurePicturePreviewUrl, normalizePictureList } from "@/utils/picture";
import { getRepairMessage } from "@/api/order";
import { pad } from "@/utils/format";
import { toArray } from "@/utils/array";

type ApproveOption = {
	label: string;
	value: string;
};
type BeforeCloseHandler = (
	type: "confirm" | "cancel" | "close",
	payload?: any
) => boolean | Promise<boolean>;

type TextareaPopoutForm = {
	auditingSuggest: string;
	approvalResult: string;
	orderStatus?: string;
};
const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		equipmentName?: string;
		orderId?: string | number;
		beforeClose?: BeforeCloseHandler;
	}>(),
	{
		title: "审批工单",
		visible: false,
		equipmentName: "",
		orderId: null,
		beforeClose: undefined,
	}
);

const formRef = ref<CFormExpose | null>(null);
const repairRecords = ref<any[]>([]);

const recordsLoading = ref(false);
const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
}>();
const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});
const formModel = ref<TextareaPopoutForm>({
	auditingSuggest: "",
	approvalResult: "5",
	orderStatus: "5",
});

watch(
	() => formModel.value.approvalResult,
	(value) => {
		const normalized =
			value === undefined || value === null ? "" : String(value);
		if (formModel.value.orderStatus !== normalized) {
			formModel.value.orderStatus = normalized;
		}
	}
);

watch(
	() => formModel.value.orderStatus,
	(value) => {
		if (value === undefined || value === null) return;
		const normalized = String(value);
		if (formModel.value.approvalResult !== normalized) {
			formModel.value.approvalResult = normalized;
		}
	}
);

watch(
	() => visible.value,
	(value) => {
		if (value) {
			loadRepairRecords(props.orderId);
			resetForm();
		}
	}
);

function resetForm() {
	formModel.value = {
		auditingSuggest: "",
		approvalResult: "5",
		orderStatus: "5",
	};
}
const optionList = computed<ApproveOption[]>(() => {
	return [
		{ label: "通过", value: "5" },
		{ label: "不通过", value: "2" },
	];
});

const buildFieldsComputed = computed<CFormSchemaField[]>(() => {
	return [
		{
			label: "工单编号",
			prop: "orderCode",
			component: "Normal",
			defaultValue: props.orderId || "-",
		},
		{
			label: "设备名称",
			prop: "equipmentName",
			component: "Normal",
			defaultValue: props.equipmentName || "-",
		},
		{
			component: "GroupTitle",
			groupTitle: "维修记录",
			prop: "_group_repair",
			visible: repairRecords.value.length > 0,
		},
		{
			component: "Slot",
			slotName: "repairRecords",
		},
		{
			component: "GroupTitle",
			groupTitle: "审批处理",
			prop: "_group_approval",
		},
		{
			label: "审批结果",
			prop: "approvalResult",
			component: "RadioGroup",
			required: true,
			defaultValue: () => formModel.value.approvalResult ?? "5",
			componentProps: () => ({
				direction: "horizontal",
				options: optionList.value,
			}),
		},
		{
			label: "审批建议",
			prop: "auditingSuggest",
			component: "Textarea",
		},
	];
});

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "220rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFieldsComputed.value,
}));

async function loadRepairRecords(id: string) {
	if (!id || recordsLoading.value) return;
	recordsLoading.value = true;
	try {
		const resp = await getRepairMessage({ id });
		const list = unwrapRecordList(resp);
		repairRecords.value = list;
	} catch (error) {
		console.warn("[ApprovePopout] loadRepairRecords failed", error);
		uni.showToast({ title: "维修记录加载失败", icon: "none" });
	} finally {
		recordsLoading.value = false;
	}
}

function formatRecordTime(value: any) {
	if (!value && value !== 0) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value ?? "-");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
		date.getSeconds()
	)}`;
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

	addLine("故障原因", record?.faultReasonDesc ?? record?.faultReason ?? "-");

	const changePartsText = formatChangeParts(record);
	lines.push({
		label: "更换部件",
		value: changePartsText || "-",
	});

	addLine("维修过程", record?.repairProcess ?? "-");
	addLine("开始时间", formatRecordTime(record?.repairStartTime));
	addLine("结束时间", formatRecordTime(record?.repairEndTime));
	addLine("维修净时(min)", record?.maintenanceTime ?? "-");
	addLine("维修结果", record?.repairReason ?? record?.repairResult ?? "-");
	addLine("原因或建议", record?.reason ?? record?.suggestion ?? "-");

	const pictures = normalizePictureList(
		record?.imagePath ?? record?.repairImagePath ?? record?.images
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

	const parts = rawList
		.map((item: any) => {
			const name = item?.spareName ?? "";
			const qty = item?.spareNum;
			if (!name && (qty === undefined || qty === null)) return "";
			const quantity =
				qty === undefined || qty === null ? "" : `x${String(qty)}`;
			return `${name}${quantity}`;
		})
		.filter(Boolean);

	return parts.join("；");
}

function unwrapRecordList(raw: any): any[] {
	if (!raw) return [];
	if (Array.isArray(raw)) return raw;
	const candidates = [
		raw.records,
		raw.rows,
		raw.list,
		raw.items,
		raw.data,
		Array.isArray(raw?.data) ? raw.data : undefined,
		raw?.data?.records,
		raw?.data?.rows,
		raw?.data?.list,
	];
	for (const item of candidates) {
		if (Array.isArray(item)) return item;
	}
	return [];
}

async function handleBeforeClose(type: "confirm" | "cancel" | "close") {
	if (type !== "confirm") {
		return true;
	}
	const form = formRef.value;
	if (form?.validate) {
		const ok = await form.validate();
		if (!ok) return false;
	}
	if (typeof props.beforeClose === "function") {
		const approvalResult =
			formModel.value.approvalResult ?? formModel.value.orderStatus ?? "";
		let news = {
			orderIds: props.orderId,
			equipmentRepairauditing: {
				orderStatus: approvalResult,
				approvalResult,
				auditingReport: formModel.value.auditingReport,
				auditingSuggest: formModel.value.auditingSuggest,
			},
		};
		const result = await props.beforeClose(news);
		if (result === false) return false;
		return result ?? Promise.reject(true);
	}
	return true;
}
</script>

<style scoped lang="scss">
.approval-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px !important;
	box-sizing: border-box;
}

.approval-popout__form {
	:deep(.c-form-wrapper) {
		/* Popout 中不需要占满视口高度，避免内容被推到底部 */
		min-height: auto;
		background: transparent;
		padding-bottom: 0;
	}

	:deep(.c-form) {
		padding: 0;
	}

	:deep(.c-form-group-title) {
		margin: 12px 0 8px;
	}
}
</style>
