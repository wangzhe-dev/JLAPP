<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="approval-popout">
			<!-- 采用 CForm 承载结构化信息，便于后续扩展字段 -->
			<CForm
				ref="cFormRef"
				v-model="formModel"
				:schema="schemaRef"
				v-if="visible"
				class="approval-popout__form"
			>
				<template v-if="repairRecords.length" #repairRecords>
					<div class="approval-popout__records">
						<CCard
							style="margin-bottom: 20rpx"
							v-for="(record, index) in repairRecords"
							:key="record.id || record.repairId || index"
							variant="outline"
							:lines="resolveRepairLines(record)"
						/>
					</div>
				</template>
				<template #changeParts>
					<ChangePartsList
						:items="formModel?.jneSeSpareConnectionList || []"
						@remove="removeSparePart"
					/>
				</template>
				<template #changePartsActions>
					<sar-icon name="plus" size="42rpx" @tap="openSparePartPop" />
				</template>
			</CForm>
		</view>
		<SparePartSelector
			v-model:visible="sparePartVisible"
			:model-value="formModel?.jneSeSpareConnectionList || []"
			:fetcher="fetchSpareOptions"
			:confirm="onSparePartConfirm"
		/>
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
import SparePartSelector from "@/pages/maintainOrder/components/SparePartSelector.vue";
import ChangePartsList from "@/pages/maintainOrder/components/ChangePartsList.vue";
import CCard from "@/components/c-card/CCard.vue";
import { ensurePicturePreviewUrl, normalizePictureList } from "@/utils/picture";
import { getPartsManagementlist, selectPlanOrder } from "@/api/order";
import { formatDateTime } from "@/utils/date";
import { pad } from "@/utils/format";
import { toArray } from "@/utils/array";
const sparePartVisible = ref<boolean>(false);
type BeforeCloseHandler = (
	type: "confirm" | "cancel" | "close",
	payload?: any
) => boolean | Promise<boolean>;

type TextareaPopoutForm = {
	actualHour: string; // 实际工时
	startTime: string;
	finishTime: string;
	jneSeSpareConnectionList: any[];
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
		title: "保养记录填写",
		visible: false,
		equipmentName: "",
		orderId: null,
		beforeClose: undefined,
	}
);

const cFormRef = ref<CFormExpose | null>(null);
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
	actualHour: "",
	startTime: "",
	finishTime: "",
	jneSeSpareConnectionList: [],
});

// 计算保养工时默认值（repairRecords 中 upkeepTime 的累加）
const defaultActualHour = computed(() => {
	if (!repairRecords.value || !repairRecords.value.length) return "";
	const total = repairRecords.value.reduce((sum, record) => {
		const time = Number(record?.upkeepTime) || 0;
		return sum + time;
	}, 0);
	return total > 0 ? String(total) : "";
});

watch(
	() => visible.value,
	(value) => {
		if (value) {
			loadRepairRecords(props.orderId).then(() => {
				resetForm();
			});
			return;
		}
		resetForm();
	}
);

// 监听 actualHour 变化，自动计算 finishTime
watch(
	() => formModel.value.actualHour,
	(newHour) => {
		if (!formModel.value.startTime || !newHour) return;

		const minutes = Number(newHour) || 0;
		if (minutes <= 0) return;

		try {
			const startDate = new Date(formModel.value.startTime);
			if (isNaN(startDate.getTime())) return;

			const finishDate = new Date(startDate.getTime() + minutes * 60 * 1000);
			formModel.value.finishTime = formatDateTime(finishDate);
		} catch (error) {
			console.warn("[UpkeepPopout] 计算完成时间失败", error);
		}
	}
);

// 监听 startTime 变化，自动计算 finishTime
watch(
	() => formModel.value.startTime,
	(newStartTime) => {
		if (!newStartTime || !formModel.value.actualHour) return;

		const minutes = Number(formModel.value.actualHour) || 0;
		if (minutes <= 0) return;

		try {
			const startDate = new Date(newStartTime);
			if (isNaN(startDate.getTime())) return;

			const finishDate = new Date(startDate.getTime() + minutes * 60 * 1000);
			formModel.value.finishTime = formatDateTime(finishDate);
		} catch (error) {
			console.warn("[UpkeepPopout] 计算完成时间失败", error);
		}
	}
);


function resetForm() {
	const now = new Date();
	const defaultHour = defaultActualHour.value;
	console.log(defaultHour, "defaultActualHour.value");

	const startTimeStr = formatDateTime(now);
	let finishTimeStr = "";

	// 如果有默认工时，计算完成时间
	if (defaultHour) {
		const minutes = Number(defaultHour) || 0;
		if (minutes > 0) {
			const finishDate = new Date(now.getTime() + minutes * 60 * 1000);
			finishTimeStr = formatDateTime(finishDate);
		}
	}

	formModel.value = {
		actualHour: defaultHour,
		startTime: startTimeStr,
		finishTime: finishTimeStr,
		jneSeSpareConnectionList: [],
	};

	// 使用 nextTick 确保表单已渲染
	setTimeout(() => {
		if (cFormRef.value?.setValue) {
			cFormRef.value.setValue("actualHour", defaultHour);
			cFormRef.value.setValue("startTime", startTimeStr);
			cFormRef.value.setValue("finishTime", finishTimeStr);
		}
	}, 100);
}
function openSparePartPop() {
	sparePartVisible.value = true;
}

function onSparePartConfirm(payloadList: any) {
	// 处理批量添加备件
	if (!Array.isArray(payloadList) || !payloadList.length) {
		console.warn("[UpkeepPopout] onSparePartConfirm: 无效的 payloadList");
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

	formModel.value.jneSeSpareConnectionList = currentList;
	console.log("[UpkeepPopout] 备件已添加:", currentList.length);

	// ⭐ 必须返回 true 表示成功
	return true;
}

function removeSparePart(part: { spareId?: string }) {
	const spareId = part?.spareId;
	if (!spareId) return;

	const list = formModel.value.jneSeSpareConnectionList;
	if (!Array.isArray(list) || !list.length) return;

	const nextList = list.filter(
		(item: any) => String(item?.spareId ?? "") !== String(spareId)
	);
	if (nextList.length === list.length) return;

	formModel.value.jneSeSpareConnectionList = nextList;
}
async function fetchSpareOptions() {
	try {
		const resp = await getPartsManagementlist({});

		// 使用当前表单中的已选备件列表
		const selectedMap = new Map(
			(formModel.value.jneSeSpareConnectionList || []).map((item: any) => [
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
			groupTitle: "保养项目",
			prop: "_group_repair",
			visible: repairRecords.value.length > 0,
		},
		{
			component: "Slot",
			slotName: "repairRecords",
		},

		{
			component: "GroupTitle",
			groupTitle: "填写保养记录",
			prop: "_group_upkeep",
		},
		{
			label: "保养工时(min)",
			prop: "actualHour",
			component: "Input",
			required: true,
			placeholder: "请输入实际工时",
			defaultValue: defaultActualHour.value,
			componentProps: {
				type: "number",
			},
		},
		{
			label: "开始时间",
			prop: "startTime",
			component: "DateTime",
			required: true,
			placeholder: "请选择开始时间",
			componentProps: {
				type: "yMdhms",
			},
		},
		{
			label: "完成时间",
			prop: "finishTime",
			component: "DateTime",
			required: true,
			placeholder: "请选择完成时间",
			componentProps: {
				type: "yMdhms",
			},
		},

		{
			component: "GroupTitle",
			groupTitle: "更换备件",
			prop: "_group_changeParts",
			groupSlot: "changePartsActions",
		},
		{
			label: "更换备件",
			prop: "jneSeSpareConnectionList",
			slotName: "changeParts",
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
		const resp = await selectPlanOrder({ id });
		const list = resp.selectProgramSpareDTOList;
		repairRecords.value = list;
	} catch (error) {
		console.warn("[ApprovePopout] loadRepairRecords failed", error);
		uni.showToast({ title: "维修记录加载失败", icon: "none" });
	} finally {
		recordsLoading.value = false;
	}
}

function resolveRepairLines(record: any) {
	const lines: any[] = [];
	const addLine = (label: string, raw: any) => {
		if (raw === undefined || raw === null || raw === "") return;
		const text = typeof raw === "string" ? raw.trim() : String(raw);
		if (!text) return;
		lines.push({ label, value: text });
	};
	addLine("保养项目", record?.upkeepItem ?? "-");
	addLine("保养级别", record?.upkeepLevel ?? "-");
	addLine("保养部位", record?.upkeepPart ?? "-");
	addLine("保养工具", record?.upkeepTools ?? "-");
	addLine("保养工时", record?.upkeepTime ?? "-");

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
	const form = cFormRef.value;
	if (form?.validate) {
		const ok = await form.validate();
		if (!ok) return Promise.reject(false);
	}
	if (typeof props.beforeClose === "function") {
		const result = await props.beforeClose({
			...formModel.value,
			orderId: props.orderId,
		});
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
