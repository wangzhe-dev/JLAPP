<template>
	<PageLayout title="异常详情" :show-back="true">
		<view class="erd-page">
			<view v-if="loading" class="erd-loading">详情加载中...</view>
			<view v-else class="erd-body">
				<CForm ref="formRef" v-model="form" :schema="schemaRef">
					<template v-if="exceptionPictures.length" #exceptionImages>
						<view class="erd-images">
							<image
								v-for="(img, index) in exceptionPictures"
								:key="img.id || index"
								:src="img.src"
								class="erd-image"
								mode="aspectFill"
								@tap="previewImages(index)"
							/>
						</view>
					</template>
				</CForm>
				<view v-if="managementRecords.length" class="erd-records">
					<view class="erd-records__header">执行记录</view>
					<CCard
						v-for="(record, index) in managementRecords"
						:key="record.id || record.code || index"
						class="erd-record-card"
						variant="outline"
						:title="record.documentNumber"
						:extra="formatRecordTime(record)"
						:lines="resolveCardLines(record)"
					>
					</CCard>
				</view>
			</view>
		</view>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { http } from "@/utils/request";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import type {
	CFormExpose,
	CFormSchema,
	CFormSchemaField,
} from "@/components/c-form/types";
import CCard from "@/components/c-card/CCard.vue";
import { ensurePicturePreviewUrl } from "@/utils/picture";
import { formatDate } from "sard-uniapp";
import { formatDateTime } from "@/utils/date";
const formRef = ref<CFormExpose | null>(null);
const loading = ref<boolean>(false);
const form = ref<Record<string, any>>({ buttonPermissionList: [] });
const managementRecords = computed(() => {
	const list = form.value?.managementRecordList;
	if (!Array.isArray(list)) return [];
	return list.filter((item) => !!item && typeof item === "object");
});
const exceptionPictures = computed(() => {
	const list = form.value?.exceptionPictureList;
	if (!Array.isArray(list)) return [];
	return list;
});

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "240rpx",
	layout: "vertical",
	readonly: true,
	showActions: false,
	fields: buildFields(),
}));

function buildFields(): CFormSchemaField[] {
	return [
		{ groupTitle: "基本信息", prop: "_group_base" },
		{
			label: "单号",
			prop: "documentNumber",
			component: "Normal",
			componentProps: { emptyText: "-", copyable: true },
		},
		{
			label: "异常大类",
			prop: "typeParentName",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "异常小类",
			prop: "typeName",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "呼叫人",
			prop: "createdNameBy",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "呼叫时间",
			prop: "createdTime",
			component: "Normal",
			componentProps: {
				emptyText: "-",
				format: (value: any) => formatDateTime(value),
			},
		},
		{
			label: "期望解决时间",
			prop: "expectedResolutionTime",
			component: "Normal",
		},
		{
			label: "异常描述",
			prop: "exceptionDesc",
			component: "Textarea",
			componentProps: { autosize: { minHeight: 80, maxHeight: 200 } },
		},
		{
			label: "异常图片",
			component: "Slot",
			slotName: "exceptionImages",
			prop: "_slot_exception_images",
			slotFormItem: true,
			visible: () => exceptionPictures.value.length > 0,
		},
		{ groupTitle: "工单信息", prop: "_group_order" },
		{
			label: "加工单编号",
			prop: "workOrder",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "工序名称",
			prop: "processName",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "批次号",
			prop: "batchNumber",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "物料",
			prop: "materialsName",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "船号/项目号",
			prop: "projectNumber",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "分段号",
			prop: "segmentNumber",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
		{
			label: "设备名称",
			prop: "equipName",
			component: "Normal",
			componentProps: { emptyText: "-" },
		},
	];
}

function formatRecordTime(record: any) {
	const raw = record?.createdTime || "-";
	return formatDateTime(raw);
}

function normalizePictureList(raw: any) {
	if (!raw) return [];
	const list = Array.isArray(raw)
		? raw
		: String(raw)
				.replace(/,$/, "")
				.split(/[,;]/)
				.map((item) => item.trim())
				.filter(Boolean);
	return list.map((item, index) => ({
		id: `${index}`,
		src: ensurePicturePreviewUrl(item),
	}));
}

async function loadDetail(id: string) {
	loading.value = true;
	try {
		const resp: any = await http.post(
			"/dispatch/exception/management/findDetailsById",
			{ id }
		);
		const data = resp?.data || resp || {};
		const next: Record<string, any> = {
			...data,
			buttonPermissionList: Array.isArray(data?.buttonPermissionList)
				? data.buttonPermissionList
				: [],
			managementRecordList: Array.isArray(data?.managementRecordList)
				? data.managementRecordList
				: [],
			exceptionPictureList: normalizePictureList(data?.exceptionPictureUrl),
			createdTime: formatDateTime(data?.createdTime),
			expectedResolutionTime: formatDateTime(data?.expectedResolutionTime, {
				includeTime: false,
			}),
		};
		form.value = next;
	} catch (error) {
		console.warn("[exception-report-detail] load detail failed", error);
		uni.showToast({ title: "详情加载失败", icon: "none" });
	} finally {
		loading.value = false;
	}
}

function previewImages(start: number) {
	const urls = exceptionPictures.value.map((item) => item.src);
	if (!urls.length) return;
	uni.previewImage({ urls, current: start });
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

	pushLine("备注", item?.executeRecord || "-");
	pushLine("操作人", item?.createdNameBy || "-");

	return lines;
}
onLoad((options: Record<string, any>) => {
	const idParam = options?.id ? String(options.id) : "";
	if (!idParam) {
		uni.showToast({ title: "缺少异常ID", icon: "none" });
		return;
	}
	loadDetail(idParam);
});
</script>

<style scoped lang="scss">
.erd-page {
	min-height: 100vh;
	background: #f3f4f6;
}

.erd-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.erd-loading {
	padding: 48px 16px;
	text-align: center;
	color: #9ca3af;
}

.erd-actions {
	margin-top: 12px;
}

.erd-records {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
	padding: 0 24rpx 20rpx;
}

.erd-records__header {
	font-size: 30rpx;
	font-weight: 600;
	color: #1f2937;
}

.erd-record-card {
	--card-outline-color: #e5e7eb;
}

.erd-record-body {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}

.erd-record-row {
	display: flex;
	gap: 12rpx;
	align-items: flex-start;
}

.erd-record-row--remark .erd-record-value {
	white-space: pre-wrap;
}

.erd-record-label {
	min-width: 120rpx;
	font-size: 26rpx;
	color: #6b7280;
}

.erd-record-value {
	flex: 1;
	font-size: 28rpx;
	color: #111827;
}

.erd-images {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
}

.erd-image {
	width: 96px;
	height: 96px;
	border-radius: 8px;
	overflow: hidden;
	background: #f3f4f6;
}
</style>
