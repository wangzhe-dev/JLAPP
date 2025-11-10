<template>
	<PageLayout title="保养工单详情" :show-back="true">
		<view class="uod-wrapper">
			<view v-if="loading" class="uod-loading">详情加载中...</view>
			<view v-else class="uod-body">
				<section class="uod-section uod-form-section">
					<CForm v-model="formData" :schema="schemaRef">
						<template #maintenanceItems>
							<div class="uod-section">
								<CCard
									v-for="item in programItems"
									:key="item.id"
									variant="outline"
									:lines="item.lines"
								/>
							</div>
						</template>
					</CForm>
				</section>
			</view>
		</view>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref } from "vue";
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import type { CFormSchema } from "@/components/c-form/types";
import CCard from "@/components/c-card/CCard.vue";
import { selectPlanOrder } from "@/api/order";
import { queryDictList } from "@/api/dict";
import { resolveStatusState } from "@/utils/status";

const loading = ref(true);
const formData = ref<Record<string, any>>({});
const detail = ref<Record<string, any> | null>(null);
const id = ref<string>("");

const statusDict = ref<Record<string, string>>({});

const schemaRef = computed<CFormSchema>(() => ({
	layout: "vertical",
	labelWidth: "240rpx",
	showActions: false,
	fields: [
		{ groupTitle: "工单信息" },
		{
			label: "工单编号",
			prop: "mtNo",
			component: "Normal",
			readonly: true,
			componentProps: { emptyText: "-", copyable: true },
		},
		{
			label: "设备名称",
			prop: "equipmentName",
			component: "Normal",
			readonly: true,
			visible: () => !!formData.value.equipmentName,
			componentProps: { emptyText: "-" },
		},
		{
			label: "计划执行时间",
			prop: "planTime",
			component: "Normal",
			readonly: true,
			format: formatDateTime,
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
			visible: () => !!formData.value.maintainTypeName,
			componentProps: { emptyText: "-" },
		},
		{
			label: "保养级别",
			prop: "maintainLevel",
			component: "Normal",
			readonly: true,
			visible: () => !!formData.value.maintainLevel,
			componentProps: { emptyText: "-" },
		},
		{
			label: "保养周期",
			prop: "maintainCycleName",
			component: "Normal",
			readonly: true,
			visible: () => !!formData.value.maintainCycleName,
			componentProps: { emptyText: "-" },
		},

		{
			label: "设备编号",
			prop: "equipmentCode",
			component: "Normal",
			readonly: true,
			visible: () => !!formData.value.equipmentCode,
			componentProps: { emptyText: "-" },
		},
		{
			label: "设备型号",
			prop: "equipmentModel",
			component: "Normal",
			readonly: true,
			visible: () => !!formData.value.equipmentModel,
			componentProps: { emptyText: "-" },
		},
		{
			label: "所在位置",
			prop: "factoryName",
			component: "Normal",
			readonly: true,
			visible: () => !!formData.value.factoryName,
			componentProps: { emptyText: "-" },
		},
		{
			groupTitle: "保养项目",
			visible: () => programItems.value.length > 0,
		},
		{
			component: "Slot",
			slotName: "maintenanceItems",
			visible: () => programItems.value.length > 0,
		},
	],
}));

const programItems = computed(() => {
	const list = toArray(detail.value?.selectProgramSpareDTOList || []);
	return list
		.map((item: any, index: number) => {
			if (!item) return null;

			// ✅ 正确从 ref 对象里取字典，并避免使用 .get
			const cycleUnitVal = item.cycleUnit;
			const cycleDict = statusDict.value["maintain_cycle"] || {};
			const cycleUnitName =
				cycleDict?.[String(cycleUnitVal)] ?? cycleUnitVal ?? "-";

			const lines = [
				createLine("保养项目", item.upkeepItem || "-"),
				createLine("保养方法", item.upkeepMethod || "-"),
				createLine("保养部位", item.upkeepPart || "-"),
				createLine("保养工具", item.upkeepTools || "-"),
				createLine("保养工时(min)", item.upkeepTime || "-"),
				createLine("周期设定", item.periodicTime || "-"),
				// ✅ 仅展示一行“保养周期”，显示字典解析后的名称
				createLine("保养周期", cycleUnitName || "-"),
			].filter(Boolean);

			return {
				id: item.id || item.programId || `${index}`,
				lines,
			};
		})
		.filter(Boolean);
});
onLoad((options: Record<string, any>) => {
	id.value = options?.id ? String(options.id) : "";
	loadStatusDict();
	fetchDetail();
});

onPullDownRefresh(async () => {
	await fetchDetail(false);
	uni.stopPullDownRefresh();
});

async function loadStatusDict() {
	try {
		let dicts = [
			"applet_maintenance_order_status",
			"my_applet_maintenance_order_status",
			"maintain_cycle",
		];
		const mapping = await queryDictList(dicts);

		for (const key of dicts) {
			mapping[key] = mapping[key] || [];
			statusDict.value[key] = mapDictItems(mapping[key]);
		}
	} catch (error) {
		console.warn("[UpkeepOrderDetail] loadStatusDict fail", error);
	}
}

async function fetchDetail(showToast = true) {
	if (!id.value) {
		loading.value = false;
		uni.showToast({ title: "缺少工单编号", icon: "none" });
		return;
	}
	loading.value = true;
	try {
		const resp: any = await selectPlanOrder({ id: id.value });
		const data = resp?.data || resp || {};
		detail.value = data;
		formData.value = buildFormData(data);
	} catch (error) {
		console.warn("[UpkeepOrderDetail] fetchDetail fail", error);
		if (showToast) uni.showToast({ title: "加载失败", icon: "none" });
		detail.value = null;
		formData.value = {};
	} finally {
		loading.value = false;
	}
}

function buildFormData(data: Record<string, any>) {
	const planTime =
		data?.planTime ||
		data?.planMaintainTime ||
		data?.planExecuteTime ||
		data?.planStartTime;
	const executor =
		data?.orderExecutor ||
		data?.orderExecutorName ||
		data?.executorName ||
		data?.maintainerName ||
		data?.maintainUserName;
	return {
		mtNo:
			data?.mtNo ||
			data?.workOrderNo ||
			data?.orderNo ||
			data?.maintainNo ||
			"",
		planName:
			data?.planName || data?.maintainPlanName || data?.maintainName || "",
		planTime,
		orderExecutorName: executor || "",
		maintainTypeName:
			data?.maintainTypeName ||
			data?.maintainType ||
			data?.maintainCategoryName ||
			data?.maintainCategory ||
			"",
		maintainLevel:
			data?.maintainLevel || data?.maintainLevelName || data?.upkeepLevel || "",
		maintainCycleName:
			data?.maintainCycleName ||
			data?.maintainCycle ||
			data?.planCycleName ||
			"",
		equipmentName:
			data?.equipmentName || data?.deviceName || data?.equipmentInfoName || "",
		equipmentCode:
			data?.equipmentCode || data?.deviceCode || data?.equipmentInfoCode || "",
		equipmentModel:
			data?.equipmentModel ||
			data?.deviceModel ||
			data?.equipmentInfoModel ||
			"",
		factoryName:
			data?.factoryName || data?.factoryArea || data?.installLocation || "",
	};
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

function toArray(source: any): any[] {
	if (!source) return [];
	if (Array.isArray(source)) return source;
	if (typeof source === "string") {
		try {
			const parsed = JSON.parse(source);
			return Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			return [];
		}
	}
	return [];
}

function createLine(label: string, value: any) {
	if (value === undefined || value === null || value === "") return null;
	return { label, value: String(value) };
}

function formatDuration(value: any) {
	if (value === undefined || value === null || value === "") return "";
	if (typeof value === "number") return `${value}`;
	return String(value);
}

function hasAnyEquipmentInfo() {
	return (
		!!formData.value.equipmentName ||
		!!formData.value.equipmentCode ||
		!!formData.value.equipmentModel ||
		!!formData.value.factoryName
	);
}

function formatDateTime(value: any) {
	if (!value && value !== 0) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
</script>

<style scoped lang="scss">
.uod-wrapper {
	box-sizing: border-box;
	background: #f5f7fb;
	min-height: 100%;
}

.uod-loading {
	padding: 48px 16px;
	text-align: center;
	color: #9ca3af;
	font-size: 14px;
}

.uod-body {
	display: flex;
	flex-direction: column;
	gap: 18px;
}

.uod-status-bar {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.uod-status__label {
	font-size: 14px;
	color: #6b7280;
}

.uod-status__chip {
	padding: 4px 12px;
	border-radius: 999px;
	font-size: 13px;
	font-weight: 600;
	color: #1f2937;
	background: #e5e7eb;
}

.uod-status__chip.is-processing {
	color: #1f2937;
	background: rgba(37, 99, 235, 0.12);
}

.uod-status__chip.is-pending {
	color: #92400e;
	background: rgba(245, 158, 11, 0.18);
}

.uod-status__chip.is-done,
.uod-status__chip.is-success {
	color: #065f46;
	background: rgba(16, 185, 129, 0.16);
}

.uod-status__chip.is-warning {
	color: #92400e;
	background: rgba(249, 115, 22, 0.16);
}

.uod-status__chip.is-fail {
	color: #991b1b;
	background: rgba(248, 113, 113, 0.18);
}

.uod-status__chip.is-cancel {
	color: #4b5563;
	background: rgba(156, 163, 175, 0.18);
}

.uod-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.uod-form-section :deep(.c-form) {
	background: transparent;
}
</style>
