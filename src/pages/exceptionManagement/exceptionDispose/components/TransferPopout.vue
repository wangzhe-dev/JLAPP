<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="transfer-popout">
			<CForm
				ref="formRef"
				v-if="visible"
				v-model="formModel"
				:schema="schemaRef"
				class="transfer-popout__form"
			/>
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
import { queryDictList } from "@/api/dict";

type TransferForm = {
	handleGroupCode: string;
	handleGroupName: string;
	handleP: string;
	handlePName: string;
	handleEdcCode: string;
	noticeContent: string;
	noticeType: string[];
};

type TransferSubmitPayload = TransferForm & {
	id: string;
};

type NoticeOption = {
	label: string;
	value: string;
};

const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		workGroupCode?: string | null;
		workGroupName?: string | null;
		recordId?: string | number | null;
		beforeClose?: (
			payload?: TransferSubmitPayload
		) => boolean | Promise<boolean>;
	}>(),
	{
		visible: false,
		title: "异常转派",
	}
);

const emit = defineEmits<{ (e: "update:visible", value: boolean): void }>();

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<TransferForm>(createDefaultForm());

const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});

const title = computed(() => props.title ?? "异常转派");

const noticeOptions = ref<NoticeOption[]>([]);
const noticeLoaded = ref(false);
const noticeLoading = ref(false);

function resetForm() {
	formModel.value = {
		handleGroupCode: safeString(props.workGroupCode).trim(),
		handleGroupName: safeString(props.workGroupName).trim(),
		handleP: "",
		handlePName: "",
		handleEdcCode: "",
		noticeContent: "",
		noticeType: [],
	};
}

watch(
	() => visible.value,
	(value) => {
		if (value) {
			resetForm();
			ensureNoticeOptions();
		}
	}
);

watch(
	() => [props.workGroupCode, props.workGroupName],
	() => {
		if (!visible.value) return;
		formModel.value.handleGroupCode = safeString(props.workGroupCode).trim();
		formModel.value.handleGroupName = safeString(props.workGroupName).trim();
	}
);

resetForm();

const resolvedGroupCode = computed(() => {
	const code = formModel.value.handleGroupCode || props.workGroupCode;
	return code ? String(code).trim() : "";
});

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "220rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFields(),
}));

function buildFields(): CFormSchemaField[] {
	return [
		{
			label: "指派人员",
			prop: "handleP",
			component: "DispatchPerson",
			required: true,
			componentProps: () => ({
				placeholder: "请选择指派人员",
				title: "选择指派人员",
				workGroupProp: "handleGroupCode",
				workGroupCode: resolvedGroupCode.value,
				getWorkGroupCode: () => resolvedGroupCode.value,
				labelProp: "handlePName",
				extraMap: {
					handlePName: "raw.nickName",
					handleEdcCode: "raw.perField1",
				},
				onBeforeOpen: () => true,
				onError: handleDispatchError,
				multiple: false,
			}),
			onChange: ({ value, prev, model }) => {
				formModel.value.handlePName = model.handlePName || "";
				formModel.value.handleEdcCode = model.handleEdcCode || "";
			},
		},
		{
			label: "通知内容",
			prop: "noticeContent",
			component: "Textarea",
			required: false,
			componentProps: {
				placeholder: "请输入通知内容",
				autosize: { minHeight: 100, maxHeight: 220 },
				maxlength: 200,
			},
		},
		{
			label: "通知方式",
			prop: "noticeType",
			component: "CheckboxGroup",
			required: true,
			componentProps: () => ({
				options: noticeOptions.value.map((option) => ({
					label: option.label,
					value: option.value,
				})),
				direction: "horizontal",
				loading: noticeLoading.value,
			}),
		},
	];
}

function createDefaultForm(): TransferForm {
	return {
		handleGroupCode: "",
		handleGroupName: "",
		handleP: "",
		handlePName: "",
		handleEdcCode: "",
		noticeContent: "",
		noticeType: [],
	};
}

function safeString(value: unknown): string {
	if (value === undefined || value === null) return "";
	return String(value);
}

async function ensureNoticeOptions() {
	if (noticeLoaded.value || noticeLoading.value) return;
	noticeLoading.value = true;
	try {
		const data = await queryDictList(["notice_type"]);
		const list = Array.isArray(data?.notice_type) ? data.notice_type : [];
		noticeOptions.value = list.map((item: any) => ({
			label: item?.dictLabel,
			value: item?.dictValue,
		}));
		noticeLoaded.value = true;
	} catch (error) {
		console.warn("[TransferPopout] load notice options failed", error);
		uni.showToast({ title: "通知方式加载失败", icon: "none" });
	} finally {
		noticeLoading.value = false;
	}
}
async function handleBeforeClose(type: "confirm" | "cancel" | "close") {
	if (type !== "confirm") {
		return true;
	}
	const form = formRef.value;
	if (form?.validate) {
		const ok = await form.validate();
		if (!ok) return Promise.reject(false);
	}
	if (typeof props.beforeClose === "function") {
		let news = JSON.parse(JSON.stringify(formModel.value));
		createDefaultForm();
		const result = await props.beforeClose({
			...news,
			id: safeString(props.recordId),
		});
		if (result === false) return false;
		return result ?? true;
	}
	return true;
}

function handleDispatchError(error: any) {
	if (!error) return;
	const msg =
		typeof error === "string"
			? error
			: error?.msg || error?.message || error?.raw?.msg || "指派人员加载失败";
	if (msg) uni.showToast({ title: msg, icon: "none" });
	console.warn("[TransferPopout] dispatch select error", error);
}
</script>

<style scoped lang="scss">
.transfer-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px !important;
	box-sizing: border-box;
}

.transfer-popout__form {
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
