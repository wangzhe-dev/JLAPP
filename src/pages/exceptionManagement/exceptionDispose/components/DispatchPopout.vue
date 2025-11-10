<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="dispatch-popout">
			<CForm
				v-if="visible"
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				class="dispatch-popout__form"
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

type DispatchForm = {
	handleGroupCode: string;
	handleGroupName: string;
	handleP: string;
	handlePName: string;
	handleEdcCode: string;
};

type DispatchSubmitPayload = {
	id: string;
	handleGroupCode: string;
	handleGroupName: string;
	handleP: string;
	handlePName: string;
	handleEdcCode: string;
};

const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		workGroupCode?: string | null;
		workGroupName?: string | null;
		recordId?: string | number | null;
		beforeClose?: (
			payload?: DispatchSubmitPayload
		) => boolean | Promise<boolean>;
	}>(),
	{
		visible: false,
		title: "派工",
	}
);

const emit = defineEmits<{ (e: "update:visible", value: boolean): void }>();

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<DispatchForm>(createDefaultForm());

const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});

const title = computed(() => props.title ?? "派工");

function resetForm() {
	formModel.value = {
		handleGroupCode: safeString(props.workGroupCode).trim(),
		handleGroupName: safeString(props.workGroupName).trim(),
		handleP: "",
		handlePName: "",
		handleEdcCode: "",
		id: safeString(props.recordId).trim(),
	};
}

watch(
	() => visible.value,
	(value) => {
		if (value) {
			resetForm();
		}
	},
	{
		deep: true,
		immediate: true,
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
			label: "班组",
			prop: "handleGroupName",
			defaultValue: props.workGroupName || "",
			component: "Normal",
			readonly: true,
			componentProps: {
				emptyText: "-",
			},
		},
		{
			label: "派工人员",
			prop: "handleP",
			component: "DispatchPerson",
			required: true,
			componentProps: () => ({
				placeholder: "请选择派工人员",
				title: "选择派工人员",
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
	];
}

function createDefaultForm(): DispatchForm {
	return {
		handleGroupCode: "",
		handleGroupName: "",
		handleP: "",
		handlePName: "",
		handleEdcCode: "",
		id: "",
	};
}

function safeString(value: unknown): string {
	if (value === undefined || value === null) return "";
	return String(value);
}

function handleDispatchError(error: any) {
	if (!error) return;
	const msg =
		typeof error === "string"
			? error
			: error?.msg || error?.message || "派工人员加载失败";
	if (msg) uni.showToast({ title: msg, icon: "none" });
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
</script>

<style scoped lang="scss">
.dispatch-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px;
	box-sizing: border-box;
}

.dispatch-popout__form {
	:deep(.c-form-wrapper) {
		min-height: auto;
		background: transparent;
		padding-bottom: 0;
	}

	:deep(.c-form) {
		padding: 0;
	}
}
</style>
