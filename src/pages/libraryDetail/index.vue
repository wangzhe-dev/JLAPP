<template>
	<PageLayout title="知识库详情" :show-back="true">
		<view class="lib-page">
			<view v-if="loading" class="lib-loading">详情加载中...</view>
			<view v-else-if="error" class="lib-error">
				<view class="error-message">{{ error }}</view>
				<sar-button @tap="retryLoad" type="primary" size="medium">
					重试
				</sar-button>
			</view>
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
import { formatDateTime } from "@/utils/date";

const loading = ref<boolean>(false);
const error = ref<string | null>(null);
const form = ref<Record<string, any>>({});
const exceptionPictures = ref<Array<{ id: string; src: string }>>([]);
const scenePictures = ref<Array<{ id: string; src: string }>>([]);
const detailId = ref<string>("");
let abortController: AbortController | null = null;

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
	// 取消之前的请求
	if (abortController) {
		abortController.abort();
	}
	abortController = new AbortController();

	loading.value = true;
	error.value = null;

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
		abortController = null;
	} catch (e: any) {
		// 忽略中止错误
		if (e.name === 'AbortError' || e.errMsg?.includes('abort')) {
			console.log("[libraryDetail] request aborted");
			return;
		}

		const errorMsg = e?.msg || e?.message || "详情加载失败";
		error.value = errorMsg;
		console.error("[libraryDetail] load detail failed", e);
	} finally {
		loading.value = false;
	}
}

function retryLoad() {
	if (detailId.value) {
		loadDetail(detailId.value);
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

.lib-error {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 100px 32px;
	gap: 20px;

	.error-message {
		color: #ff4d4f;
		font-size: 14px;
		text-align: center;
		line-height: 1.6;
	}
}
</style>
