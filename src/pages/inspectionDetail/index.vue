<template>
	<PageLayout title="点检详情" :show-back="true">
		<view class="insp-wrapper">
			<view v-if="loading" class="insp-loading">详情加载中...</view>
			<view v-else class="insp-body">
				<section class="insp-section insp-form-section">
					<CForm v-model="formData" :schema="schemaRef">
						<template #inspectionItems>
							<section class="insp-section insp-detail-section">
								<template v-if="detailItems.length">
									<CCard
										v-for="(item, index) in detailItems"
										:key="item.id || item.detailId || index"
										variant="outline"
										:title="item.checkProject"
										:lines="resolveDetailLines(item)"
									/>
								</template>
								<view v-else class="insp-empty">暂无点检明细</view>
							</section>
						</template>
						<template #inspectionProcess>
							<section
								v-if="showProcessEntry"
								class="insp-section insp-process-section"
							>
								<CCard
									v-for="(record, index) in processRecords"
									:key="record.id || index"
									variant="outline"
									:lines="resolveProcessLines(record)"
								/>
								<view v-if="!processRecords.length" class="insp-process__empty">
									暂无点检记录
								</view>
							</section>
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
import type { CFormSchema, CFormSchemaField } from "@/components/c-form/types";
import CCard from "@/components/c-card/CCard.vue";
import { queryDictList } from "@/api/dict";
import { ensurePicturePreviewUrl } from "@/utils/picture";
import { resolveStatusState } from "@/utils/status";
import {
	getInspectionDetail,
	getInspectionProcessList,
} from "@/api/inspection";

const loading = ref(true);
const detail = ref<any>(null);
const formData = ref<Record<string, any>>({});
const processStatusDict = ref<Record<string, string>>({});
const processRecordsList = ref<any[]>([]); // 点检记录列表
const processLoading = ref(false); // 点检记录加载状态

const queryParams = {
	mtNo: ref<string>(""),
	type: ref<string>(""),
	source: ref<string>("1"),
	isView: ref<boolean>(true),
	equipmentModel: ref<string>(""),
};

const schemaRef = computed<CFormSchema>(() => ({
	layout: "vertical",
	labelWidth: "240rpx",
	showActions: false,
	fields: buildFields(),
}));

const detailItems = computed(() => {
	const list = detail.value?.equipmentCheckDetailList;
	if (!Array.isArray(list)) return [];
	return list.map((item: any) => {
		const statusText = resolveCheckStatus(item);
		return {
			...item,
			// statusText,
			// statusState: resolveStatusState(statusText, item.checkStatus),
		};
	});
});

const processRecords = computed(() => {
	// 使用从接口获取的点检记录列表
	const list = processRecordsList.value;
	if (!Array.isArray(list)) return [];
	return list.filter(Boolean).map((item: any, index: number) => {
		const statusText = resolveProcessStatus(item);
		return {
			id: item.id,
			equipmentCode: item.equipmentCode || "-",
			equipmentName: item.equipmentName || "-",
			orderExecutorName: item.orderExecutorName || "-",
			createdTime: item.createdTime || "-",
			statusText,
			statusState: resolveStatusState(statusText, item.orderStatus),
		};
	});
});

onLoad((options: Record<string, any>) => {
	queryParams.mtNo.value = options?.mtNo || "";
	queryParams.type.value = options?.type || "";
	queryParams.source.value = options?.source || "1";
	queryParams.equipmentModel.value = options?.equipmentModel || "";
	queryParams.isView.value = options?.isView ? options.isView !== "0" : true;
	loadProcessStatusDict();
	// 先加载详情,再加载点检记录
	fetchDetail().then(() => {
		fetchProcessRecords();
	});
});

onPullDownRefresh(async () => {
	await Promise.all([fetchDetail(), fetchProcessRecords()]);
	uni.stopPullDownRefresh();
});

async function fetchDetail() {
	if (!queryParams.mtNo.value) {
		loading.value = false;
		uni.showToast({ title: "缺少点检单号", icon: "none" });
		return;
	}
	loading.value = true;
	try {
		const resp: any = await getInspectionDetail({
			mtNo: queryParams.mtNo.value,
			type: queryParams.type.value,
		});
		const data = resp?.data || resp || {};
		const executorList = Array.isArray(data.equipmentCheckOrderExecutorList)
			? data.equipmentCheckOrderExecutorList
					.map((item: any) => item?.orderExecutorName)
					.filter(Boolean)
			: [];
		const orderExecutorName =
			data.orderExecutorName || executorList.join("、") || "-";
		detail.value = {
			...data,
			orderExecutorName,
		};
		formData.value = {
			mtNo: data.mtNo,
			planName: data.planName,
			checkName: data.checkName,
			planTime: data.planTime,
			orderExecutorName,
			equipmentName: data.equipmentName,
			equipmentCode: data.equipmentCode,
			equipmentModel: data.equipmentModel || queryParams.equipmentModel.value,
			checkTime: data.checkTime,
		};
	} catch (error) {
		console.warn("[inspectionDetail] fetch detail failed", error);
		uni.showToast({ title: "加载失败", icon: "none" });
		detail.value = null;
		formData.value = {};
	} finally {
		loading.value = false;
	}
}

/**
 * 获取点检记录列表
 */
async function fetchProcessRecords() {
	if (!queryParams.mtNo.value) {
		console.warn("[inspectionDetail] fetchProcessRecords: 缺少点检单号");
		return;
	}

	// 如果没有设备编号,无法获取点检记录
	if (!detail.value?.equipmentCode) {
		console.warn("[inspectionDetail] fetchProcessRecords: 缺少设备编号");
		return;
	}

	processLoading.value = true;
	try {
		const resp: any = await getInspectionProcessList({
			orderId: queryParams.mtNo.value,
			equipmentCode: detail.value.equipmentCode,
			pageNum: 1,
			pageSize: 999,
		});

		const records = resp?.data?.records || resp?.records || [];
		processRecordsList.value = Array.isArray(records) ? records : [];

		console.log(
			"[inspectionDetail] 点检记录加载成功:",
			processRecordsList.value.length
		);
	} catch (error) {
		console.warn("[inspectionDetail] fetchProcessRecords failed", error);
		processRecordsList.value = [];
		// 不显示错误提示,静默失败
	} finally {
		processLoading.value = false;
	}
}

function resolveCheckStatus(item: any) {
	const status = item?.checkStatus;
	const map = {
		0: "正常",
		1: "异常",
	};
	if (status === 0 || status === "0") return "正常";
	if (status === 1 || status === "1") return "异常";
	return map[status as keyof typeof map] || item?.checkStatusName || "未判定";
}

function buildMediaList(item: any) {
	const images = parseImageList(item?.imagePath);
	if (!images.length) return [];
	const previewUrls = images.map((url) => url.src);
	return images.map((image, index) => ({
		...image,
		previewUrls,
		id: image.id ?? `${item?.id || item?.detailId || "media"}-${index}`,
	}));
}

function parseImageList(path: any) {
	if (!path) return [];
	const list = Array.isArray(path)
		? path
		: String(path)
				.split(/[;,]/)
				.map((item) => item.trim())
				.filter(Boolean);
	return list
		.map((url, idx) => {
			const finalUrl = ensurePicturePreviewUrl(url);
			if (!finalUrl) return null;
			return {
				type: "image",
				src: finalUrl,
				id: `${finalUrl}-${idx}`,
			};
		})
		.filter(Boolean);
}

function formatDateTime(value: any) {
	if (value === undefined || value === null || value === "") return "-";
	if (typeof value === "number") return formatDate(new Date(value));
	if (value instanceof Date) return formatDate(value);
	const parsed = new Date(String(value).replace(/-/g, "/"));
	if (isNaN(parsed.getTime())) return String(value);
	return formatDate(parsed);
}

function formatDate(date: Date) {
	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
		date.getSeconds()
	)}`;
}

const PROCESS_STATUS_DICT_CODE = "maintenance_process_order_status_type";

async function loadProcessStatusDict() {
	try {
		const mapping = await queryDictList([PROCESS_STATUS_DICT_CODE]);
		processStatusDict.value = mapDictItems(
			mapping?.[PROCESS_STATUS_DICT_CODE] || []
		);
	} catch (error) {
		console.warn("[inspectionDetail] loadProcessStatusDict failed", error);
	}
}

function mapDictItems(list: any[]) {
	if (!Array.isArray(list)) return {};
	return list.reduce((acc: Record<string, string>, item: any) => {
		const value = item?.dictValue ?? item?.dictCode ?? item?.value;
		const label = item?.dictLabel ?? item?.dictName ?? item?.label;
		if (value !== undefined && value !== null) {
			acc[String(value)] = label ? String(label) : String(value);
		}
		return acc;
	}, {} as Record<string, string>);
}

function hasExtendedInfo(item: any) {
	return (
		item?.useTools ||
		item?.numMax ||
		item?.numMin ||
		item?.defaultNum ||
		item?.unit ||
		item?.checkDetail ||
		item?.description ||
		item?.remark
	);
}

const showProcessEntry = computed(
	() =>
		queryParams.isView.value &&
		detail.value?.formStatus !== "1" &&
		Boolean(queryParams.mtNo.value)
);

function resolveProcessStatus(item: any) {
	const code = extractProcessStatusCode(item);
	if (code && processStatusDict.value[code]) {
		return processStatusDict.value[code];
	}
	const name =
		item?.orderStatusName ||
		item?.statusName ||
		item?.statusText ||
		item?.processStatusName;
	if (name) return name;
	if (code) {
		const map: Record<string, string> = {
			"0": "待处理",
			"1": "处理中",
			"2": "已完成",
			"3": "已关闭",
		};
		return map[code] || code;
	}
	return "-";
}

function extractProcessStatusCode(item: any) {
	const raw =
		item?.orderStatus ??
		item?.status ??
		item?.processStatus ??
		item?.orderStatusCode ??
		item?.statusCode ??
		item?.processStatusCode;
	if (raw === undefined || raw === null || raw === "") return "";
	return String(raw);
}

function resolveDetailLines(item: any) {
	const lines = [
		{ label: "点检部位", value: item?.checkPart || "-" },
		{ label: "点检方式", value: item?.checkWay || "-" },
		{ label: "是否是数值", value: item.isNum == 1 ? "否" : "是" },
		// {
		// 	label: "点检图片",
		// 	type: "image-list",
		// 	images: item?.imagePath || "-",
		// },
	];
	if (hasExtendedInfo(item)) {
		lines.push(
			{ label: "默认正常值", value: item.defaultNum, collapsible: true },
			{ label: "检测值", value: item?.checkNum || "-", collapsible: true },
			{ label: "使用工具", value: item?.useTools || "-", collapsible: true },
			{ label: "基准上限", value: item?.numMax || "-", collapsible: true },
			{ label: "基准下限", value: item?.numMin || "-", collapsible: true },
			{ label: "点检详情", value: item?.checkDetail || "-", collapsible: true }
			// { label: "备注", value: item?.remark || "-", collapsible: true }
		);
	}
	return lines;
}

function resolveProcessLines(item: any) {
	console.log(item, './aaaaaaaaa');
	
	return [
		{
			label: "设备编号",
			value: item?.equipmentCode,
		},
		{
			label: "设备名称",
			value: item?.equipmentName,
		},
		{
			label: "操作",
			value: item?.statusText,
		},
		{
			label: "执行人",
			value: item?.orderExecutorName,
		},
		{
			label: "时间",
			value: item?.createdTime,
		},
	];
}

function buildFields(): CFormSchemaField[] {
	const isView = queryParams.isView.value;
	const fields: CFormSchemaField[] = [];

	fields.push({
		groupTitle: "点检详情",
		visible: () => isView,
	});
	fields.push({
		label: "点检单号",
		prop: "mtNo",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-", copyable: true },
		visible: () => isView,
	});
	fields.push({
		label: "计划名称",
		prop: "planName",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
		visible: () => isView,
	});
	fields.push({
		label: "点检手册",
		prop: "checkName",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
		visible: () => isView,
	});
	fields.push({
		label: "计划执行时间",
		prop: "planTime",
		component: "Normal",
		readonly: true,
		format: (val: any) => (val ? String(val) : "-"),
		componentProps: { emptyText: "-" },
		visible: () => isView,
	});
	fields.push({
		label: "执行人",
		prop: "orderExecutorName",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
		visible: () => isView,
	});

	fields.push({
		groupTitle: "设备信息",
		visible: () => !isView,
	});
	fields.push({
		label: "设备名称",
		prop: "equipmentName",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
		visible: () => !isView,
	});
	fields.push({
		label: "设备编号",
		prop: "equipmentCode",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
		visible: () => !isView,
	});
	fields.push({
		label: "设备型号",
		prop: "equipmentModel",
		component: "Normal",
		readonly: true,
		componentProps: { emptyText: "-" },
		visible: () => !isView,
	});
	fields.push({
		label: "点检时间",
		prop: "checkTime",
		component: "Normal",
		readonly: true,
		format: formatDateTime,
		componentProps: { emptyText: "-" },
		visible: () => !isView,
	});
	fields.push({
		groupTitle: "点检项目",
		visible: () => detailItems.value.length > 0,
	});
	fields.push({
		component: "Slot",
		slotName: "inspectionItems",
		visible: () => detailItems.value.length > 0,
	});
	fields.push({
		groupTitle: "点检流程",
		visible: () => showProcessEntry.value,
	});
	fields.push({
		component: "Slot",
		slotName: "inspectionProcess",
		visible: () => showProcessEntry.value,
	});
	return fields;
}
</script>

<style scoped lang="scss">
.insp-wrapper {
	box-sizing: border-box;
	background: #f5f7fb;
}
.insp-loading {
	text-align: center;
	color: #666;
	font-size: 14px;
	padding: 40px 0;
}

.insp-empty {
	text-align: center;
	font-size: 14px;
	color: #999;
	padding: 40px 0;
}

.insp-section {
	background: #fff;
	border-radius: 12px;
	box-shadow: 0 6px 18px rgba(15, 63, 118, 0.06);
}

.insp-form-section :deep(.c-form) {
	background: transparent;
}

.insp-form-section :deep(.c-form-group-title__text) {
	font-size: 16px;
	color: #14223b;
}

.insp-detail-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.insp-process-section {
	margin-top: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.insp-process__empty {
	text-align: center;
	font-size: 14px;
	color: #999;
	padding: 24px 0;
}
</style>
