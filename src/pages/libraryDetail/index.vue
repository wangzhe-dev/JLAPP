<template>
	<PageLayout title="知识库详情" :show-back="true">
		<view class="lib-page">
			<view v-if="loading" class="lib-loading">详情加载中...</view>
			<view v-else class="lib-body">
				<CForm v-model="form" :schema="schemaRef">
					<template #exceptionPictures>
						<ImageGrid :items="exceptionPictures" />
					</template>
					<template #scenePictures>
						<ImageGrid :items="scenePictures" />
					</template>
				</CForm>
			</view>
		</view>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import type { CFormSchema, CFormSchemaField } from "@/components/c-form/types";
import ImageGrid from "@/components/image-grid/ImageGrid.vue";
import { findDetailsById } from "@/api/exception";
import { ensurePicturePreviewUrl } from "@/utils/picture";

const loading = ref<boolean>(false);
const form = ref<Record<string, any>>({});
const exceptionPictures = ref<Array<{ id: string; src: string }>>([]);
const scenePictures = ref<Array<{ id: string; src: string }>>([]);
const detailId = ref<string>("");

const schemaRef = computed<CFormSchema>(() => ({
	layout: "vertical",
	labelWidth: "240rpx",
	readonly: true,
	showActions: false,
	fields: buildFields(),
}));

function buildFields(): CFormSchemaField[] {
	return [
		{ groupTitle: "基本信息", prop: "_group_basic" },
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
			componentProps: {
				emptyText: "-",
				format: (value: any) => formatDateTime(value),
			},
		},
		{
			label: "异常描述",
			prop: "exceptionDesc",
			component: "Textarea",
			componentProps: { autosize: { minHeight: 80, maxHeight: 200 } },
		},
		{ groupTitle: "工单信息", prop: "_group_order" },
		{
			label: "加工单编号",
			prop: "workOrder",
			component: "Normal",
			componentProps: { emptyText: "--" },
		},
		{
			label: "工序",
			prop: "processName",
			component: "Normal",
			componentProps: { emptyText: "--" },
		},
		{
			label: "批次号",
			prop: "batchNumber",
			component: "Normal",
			componentProps: { emptyText: "--" },
		},
		{
			label: "物料",
			prop: "materialsName",
			component: "Normal",
			componentProps: { emptyText: "--" },
		},
		{
			label: "项目号",
			prop: "projectNumber",
			component: "Normal",
			componentProps: { emptyText: "--" },
		},
		{
			label: "分段号",
			prop: "segmentNumber",
			component: "Normal",
			componentProps: { emptyText: "--" },
		},
		{
			label: "设备名称",
			prop: "equipName",
			component: "Normal",
			componentProps: { emptyText: "--" },
		},
		{
			label: "异常图片",
			prop: "exceptionPictures",
			component: "Slot",
			visible: () => exceptionPictures.value.length > 0,
			slotName: "exceptionPictures",
		},
		{
			label: "解决办法",
			prop: "solution",
			component: "Textarea",
			componentProps: { autosize: { minHeight: 80, maxHeight: 200 }, emptyText: "--" },
		},
		{
			label: "现场图片",
			prop: "scenePictures",
			component: "Slot",
			visible: () => scenePictures.value.length > 0,
			slotName: "scenePictures",
		},
	];
}

function formatDateTime(value: any) {
	if (!value && value !== 0) return "-";
	if (typeof value === "string" && value.includes("-") && value.length >= 10)
		return value;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value ?? "");
	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
		date.getSeconds()
	)}`;
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
		const resp: any = await findDetailsById({ id });
		const data = resp?.data || resp || {};
		exceptionPictures.value = normalizePictureList(data?.exceptionPictureUrl);
		scenePictures.value = normalizePictureList(data?.scenePictureUrl);
		form.value = {
			...data,
			createdTime: formatDateTime(data?.createdTime),
			expectedResolutionTime: formatDateTime(data?.expectedResolutionTime),
		};
	} catch (error) {
		console.warn("[libraryDetail] load detail failed", error);
		uni.showToast({ title: "详情加载失败", icon: "none" });
	} finally {
		loading.value = false;
	}
}

onLoad((options: Record<string, any>) => {
	const id = options?.id ? String(options.id) : "";
	if (!id) {
		uni.showToast({ title: "缺少知识库ID", icon: "none" });
		return;
	}
	detailId.value = id;
	loadDetail(id);
});
</script>

<style scoped lang="scss">
.lib-page {
	min-height: 100vh;
	background: #f3f4f6;
}

.lib-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px;
}

.lib-loading {
	padding: 48px 16px;
	text-align: center;
	color: #9ca3af;
}
</style>
