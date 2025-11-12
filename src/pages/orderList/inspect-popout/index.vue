<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="inspect-popout">
			<CForm
				v-if="visible"
				:key="formKey"
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				class="inspect-popout__form"
			>
				<!-- 为每个项目动态生成展开/收起按钮 -->
				<template
					v-for="(item, index) in checkDetailList"
					:key="index"
					#[`changePartsActions_${index}`]
				>
					<view class="expand-toggle">
						<sar-button
							v-if="expandedItems.has(index)"
							@tap.stop="toggleItem(index)"
							size="mini"
							type="text"
							>收起</sar-button
						>

						<sar-button
							v-else
							@tap.stop="toggleItem(index)"
							size="mini"
							type="text"
						>
							展开
						</sar-button>
					</view>
				</template>
			</CForm>
		</view>
	</sar-popout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch, nextTick } from "vue";
import { CForm } from "@/components/c-form";
import type {
	CFormExpose,
	CFormSchema,
	CFormSchemaField,
} from "@/components/c-form/types";
import { requestUrl } from "@/config";
import { ensurePicturePreviewUrl } from "@/utils/picture";
import { getInspectionDetail } from "@/api/inspection";
import { formatDate } from "sard-uniapp";

const CHECK_STATUS_OPTIONS = [
	{ label: "正常", value: "0", tone: "pass" },
	{ label: "异常", value: "1", tone: "fail" },
];

type InspectForm = {
	equipmentName: string;
	equipmentCode: string;
	equipmentModel?: string;
	checkTime?: string;
	items: Array<{
		checkStatus: string | number;
		checkNum: string;
		checkTime?: string;
		remark: string;
		images: any[];
		[key: string]: any;
	}>;
};

type InspectSubmitPayload = {
	id: string;
	mtNo?: string;
	items: Array<{
		checkDetailId?: string;
		itemName?: string;
		checkStatus: string;
		checkNum: string;
		remark: string;
		imageUrls: string[];
	}>;
};

const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		recordId?: string | number | null;
		mtNo?: string | number | null;
		equipmentName?: string;
		equipmentCode?: string;
		equipmentModel?: string;
		type?: string;
		initialValues?: Partial<InspectForm>;
		beforeClose?: (
			payload?: InspectSubmitPayload
		) => boolean | Promise<boolean>;
	}>(),
	{
		visible: false,
		title: "点检录入",
		equipmentName: "",
		equipmentCode: "",
		equipmentModel: "",
		type: "",
		initialValues: () => ({}),
	}
);

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
}>();

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<InspectForm>(createDefaultForm());
const checkDetailList = ref<any[]>([]);
const loading = ref(false);
const expandedItems = ref<Set<number>>(new Set()); // 记录哪些项目是展开状态
const formKey = ref(0); // 用于强制重新渲染 CForm

const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});

const title = computed(() => props.title ?? "点检录入");

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "220rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFieldsWithCards(),
}));

function buildFieldsWithCards(): CFormSchemaField[] {
	const baseFields: CFormSchemaField[] = [
		{
			label: "设备名称",
			prop: "equipmentName",
			defaultValue: props.equipmentName || "",
			component: "Normal",
			readonly: true,
			componentProps: {
				emptyText: "-",
			},
		},
		{
			label: "设备编号",
			prop: "equipmentCode",
			defaultValue: props.equipmentCode || "",
			component: "Normal",
			readonly: true,
			componentProps: {
				emptyText: "-",
			},
		},
		{
			label: "设备型号",
			prop: "equipmentModel",
			defaultValue: props.equipmentModel || "",
			visible: () => false,
		},
		{
			label: "点检时间",
			prop: "checkTime",
			component: "DateTime",
			required: true,
		},
	];

	// 如果没有详情列表，返回基础字段
	if (!checkDetailList.value || checkDetailList.value.length === 0) {
		return baseFields;
	}

	// 动态生成每个保养项目的字段组
	const dynamicFields: CFormSchemaField[] = [];

	checkDetailList.value.forEach((item, index) => {
		const itemName = item?.checkProject;

		// 添加分组标题 - 使用卡片样式，每个项目使用独立的插槽名称
		dynamicFields.push({
			prop: `items.${index}._groupTitle`,
			groupTitle: itemName,
			component: "GroupTitle",
			groupSlot: `changePartsActions_${index}`, // 使用独立的插槽名称
			componentProps: {
				style: "card",
			},
		});

		// 点检部位 - 默认隐藏,点击展开后显示
		dynamicFields.push({
			label: "点检部位",
			prop: `items.${index}.checkPart`,
			component: "Normal",
			format: () => item.checkPart || "-",
			visible: () => expandedItems.value.has(index),
		});
		// 要领/方法 - 默认隐藏,点击展开后显示
		dynamicFields.push({
			label: "点检方式",
			prop: `items.${index}.checkWay`,
			component: "Normal",
			format: () => item.checkWay	 || "-",
			visible: () => expandedItems.value.has(index),
		});

		// 使用工具 - 默认隐藏,点击展开后显示
		dynamicFields.push({
			label: "使用工具",
			prop: `items.${index}.useTools`,
			component: "Normal",
			format: () => item.useTools || "-",
			visible: () => expandedItems.value.has(index),
		});
		// 点检详情 - 默认隐藏,点击展开后显示
		dynamicFields.push({
			label: "点检详情",
			prop: `items.${index}.checkDetail`,
			component: "Normal",
			format: () => item.checkDetail || "-",
			visible: () => expandedItems.value.has(index),
		});
		// 基准上限 - 默认隐藏,点击展开后显示
		dynamicFields.push({
			label: "基准上限",
			prop: `items.${index}.numMax`,
			component: "Normal",
			format: () => item.numMax || "-",
			visible: () => expandedItems.value.has(index),
		});
		// 基准下限 - 默认隐藏,点击展开后显示
		dynamicFields.push({
			label: "基准下限",
			prop: `items.${index}.numMin`,
			component: "Normal",
			format: () => item.numMin || "-",
			visible: () => expandedItems.value.has(index),
		});
		dynamicFields.push({
			label: "基准值",
			prop: `items.${index}.defaultNum`,
			component: "Normal",
			format: () => item.defaultNum || "-",
			visible: () => expandedItems.value.has(index),
		});

		// 点检结果
		dynamicFields.push({
			label: "点检结果",
			prop: `items.${index}.checkStatus`,
			defaultValue: "0",
			required: true,
			component: "RadioGroup",
			componentProps: {
				options: CHECK_STATUS_OPTIONS.map((option) => ({
					label: option.label,
					value: option.value,
				})),
				direction: "horizontal",
			},
		});

		// 检测值
		dynamicFields.push({
			label: "检测值",
			prop: `items.${index}.checkNum`,
			component: "Number",
			required: true,
			defaultValue: item.defaultNum,
			placeholder: "请输入检测值",
			clearable: true,
		});

		// 备注
		dynamicFields.push({
			label: "备注",
			prop: `items.${index}.remark`,
			component: "Textarea",
			componentProps: {
				placeholder: "请输入备注",
				autosize: { minHeight: 80, maxHeight: 160 },
				maxlength: 200,
			},
		});

		// 拍照上传
		dynamicFields.push({
			label: "拍照上传",
			prop: `items.${index}.images`,
			component: "Uploader",
			required: true,
			componentProps: {
				limit: 3,
				uploadUrl: "/file/upload",
				fieldName: "file",
				uploadBaseUrl: requestUrl,
			},
		});
	});

	return [...baseFields, ...dynamicFields];
}

watch(
	() => props.visible,
	(value) => {
		if (value) {
			applyInitialValues();
			// 使用 nextTick 确保 props 都已经更新
			nextTick(() => {
				loadInspectDetail();
			});
		} else {
			checkDetailList.value = [];
		}
	}
);

watch(
	() => props.initialValues,
	() => {
		if (visible.value) applyInitialValues();
	},
	{ deep: true }
);

watch(
	() => [props.equipmentName, props.equipmentCode],
	() => {
		applyEquipmentMeta();
	},
	{ immediate: true }
);

watch(
	() => checkDetailList.value,
	() => {
		// 当详情列表变化时，重新构建表单字段
		// 触发 computed 重新计算
	},
	{ deep: true }
);

async function loadInspectDetail() {
	if (!props.mtNo || !props.type) {
		console.warn("[InspectPopout] 缺少必要参数", {
			mtNo: props.mtNo,
			type: props.type,
		});
		return;
	}

	loading.value = true;
	try {
		const response = await getInspectionDetail({
			mtNo: String(props.mtNo),
			type: props.type,
		});

		checkDetailList.value = response?.equipmentCheckDetailList || [];

		// 初始化表单数据
		initFormItems();

		// 强制重新渲染 CForm 以应用 defaultValue
		await nextTick();
		formKey.value++;
	} catch (error) {
		console.warn("[InspectPopout] 点检详情加载失败", error);
		uni.showToast({ title: "点检详情加载失败", icon: "none" });
		checkDetailList.value = [];
	} finally {
		loading.value = false;
	}
}

function initFormItems() {
	if (!checkDetailList.value || checkDetailList.value.length === 0) {
		formModel.value.items = [];
		return;
	}

	// 根据详情列表初始化表单项
	formModel.value.items = checkDetailList.value.map((item, index) => {
		const defaultNum = item?.defaultNum;
		// 确保 defaultNum 转换为字符串或空字符串
		const checkNumValue =
			defaultNum !== undefined && defaultNum !== null ? String(defaultNum) : "";
		return {
			checkDetailId: item?.id || item?.checkDetailId || "",
			itemName: item?.itemName || item?.name || item?.projectName || "",
			checkStatus: "0",
			checkTime: "",
			checkNum: checkNumValue, // 使用转换后的值
			defaultNum: defaultNum,
			remark: "",
			images: [],
			_raw: item, // 保存原始数据
		};
	});
}

function createDefaultForm(): InspectForm {
	return {
		equipmentName: "",
		equipmentCode: "",
		checkTime: formatDate(new Date(), "YYYY-MM-DD ss:HH:mm"),
		items: [],
	};
}

function applyInitialValues() {
	const normalized = normalizeInitialValues(props.initialValues);
	formModel.value = {
		...createDefaultForm(),
		...normalized,
	};
	applyEquipmentMeta();
}

function normalizeInitialValues(
	source?: Partial<InspectForm>
): Partial<InspectForm> {
	if (!source) return {};
	return {
		equipmentName: safeString(source.equipmentName),
		equipmentCode: safeString(source.equipmentCode),
		items: Array.isArray(source.items) ? source.items : [],
	};
}

function normalizeStatus(value: any) {
	if (value === undefined || value === null || value === "") return "";
	return String(value);
}

function safeString(value: any) {
	if (value === undefined || value === null) return "";
	return String(value);
}

function applyEquipmentMeta() {
	formModel.value.equipmentName = safeString(props.equipmentName);
	formModel.value.equipmentCode = safeString(props.equipmentCode);
	// 如果没有点检时间,设置为当前时间
	if (!formModel.value.checkTime) {
		formModel.value.checkTime = new Date().toISOString();
	}
}

/**
 * 从URL中移除MinIO基础路径
 * @param url 完整URL或相对路径
 * @returns 相对路径(不含MinIO base)
 */
function stripMinioBase(url: string): string {
	if (!url) return "";
	const minioBase = "http://10.147.128.87:9000";
	// 移除MinIO基础路径
	if (url.startsWith(minioBase)) {
		return url.substring(minioBase.length);
	}
	return url;
}

/**
 * 提取上传文件的相对路径(不含MinIO base)
 * @param list 文件列表
 * @returns 相对路径数组
 */
function extractUploadUrls(list: any[]): string[] {
	if (!Array.isArray(list)) return [];
	return list
		.map((item) => {
			if (!item) return "";
			let url = "";
			if (typeof item === "string") {
				url = item;
			} else {
				// 优先使用 originUrl,其次 url,最后 resultUrl
				url = item.originUrl || item.url || item.resultUrl || "";
			}
			// 移除MinIO基础路径,只保存相对路径
			return stripMinioBase(url);
		})
		.filter(Boolean); // 过滤掉空字符串
}

function resetForm() {
	formModel.value = createDefaultForm();
	applyEquipmentMeta();
	expandedItems.value.clear(); // 重置展开状态
}

// 切换单个项目的展开/收起状态
function toggleItem(index: number) {
	if (expandedItems.value.has(index)) {
		expandedItems.value.delete(index);
	} else {
		expandedItems.value.add(index);
	}
	// 触发响应式更新
	expandedItems.value = new Set(expandedItems.value);
}

async function handleBeforeClose(type: "confirm" | "cancel" | "close") {
	if (type !== "confirm") {
		if (type === "cancel" || type === "close") resetForm();
		return true;
	}
	const form = formRef.value;
	if (form?.validate) {
		const ok = await form.validate();
		if (!ok) return Promise.reject(false);
	}

	// // 验证并格式化每个项目的数据
	const items = (formModel.value.items || []).map((item) => {
		const checkStatus = normalizeStatus(item.checkStatus);
		const checkNum = safeString(item.checkNum).trim();
		const remark = safeString(item.remark).trim();

		const imageUrls = extractUploadUrls(item.images);
		return {
			...item._raw,
			checkNum: checkNum,
			remark: remark,
			checkStatus: item.checkStatus || "",
			imagePath: imageUrls.join(","),
		};
	});

	if (typeof props.beforeClose === "function") {
		try {
			const payload: InspectSubmitPayload = {
				// id: safeString(props.recordId).trim(),
				mtNo: safeString(props.mtNo).trim(),
				equipmentName: props.equipmentName,
				equipmentCode: props.equipmentCode,
				equipmentModel: props.equipmentModel,
				checkDetailList: items,
			};
			const result = await props.beforeClose(payload);
			if (result === false) return false;
		} catch (error) {
			if (error?.message === "validation_failed") {
				return false;
			}
			throw error;
		}
	}
	resetForm();
	return true;
}
</script>

<style scoped lang="scss">
.inspect-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px;
	box-sizing: border-box;
	max-height: 70vh;
	overflow-y: auto;
}

.inspect-popout__form {
	:deep(.c-form-wrapper) {
		min-height: auto !important;
		background: transparent !important;
		padding-bottom: 0 !important;
	}

	:deep(.c-form) {
		padding: 0 !important;
	}

	:deep(.sar-form) {
		padding: 0 !important;
	}

	// 美化卡片分组样式
	:deep(.c-form-group-title--card) {
		padding: 28rpx 32rpx;
		margin: 24rpx 0 0;
		// background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 16rpx 16rpx 0 0;
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);

		.c-form-group-title__text {
			font-size: 32rpx;
			font-weight: 700;
			// color: #ffffff;
		}
	}

	// 卡片分组后的第一个表单项，去除上边距
	:deep(.c-form-group-title--card + .c-form-item-wrapper) {
		margin-top: 0;
		padding: 32rpx;
		background: #ffffff;
		border-radius: 0;
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	}

	// 卡片分组内的表单项
	:deep(.c-form-group-title--card ~ .c-form-item-wrapper) {
		background: #ffffff;
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
		margin-top: 0;
		margin-bottom: 0;
		border-radius: 0;

		&:last-of-type {
			padding-bottom: 32rpx;
			border-radius: 0 0 16rpx 16rpx;
			margin-bottom: 24rpx;
		}
	}
}

// 展开/收起按钮样式
.expand-toggle {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-left: 20rpx;

	&__btn {
		font-size: 28rpx;
		color: #1989fa;
		padding: 8rpx 20rpx;
		background: rgba(25, 137, 250, 0.1);
		border-radius: 8rpx;
		transition: all 0.3s;

		&:active {
			background: rgba(25, 137, 250, 0.2);
			transform: scale(0.95);
		}
	}
}
</style>
