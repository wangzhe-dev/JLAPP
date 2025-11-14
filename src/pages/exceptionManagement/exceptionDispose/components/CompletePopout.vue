<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
		confirm-text="处理异常"
	>
		<view class="complete-popout">
			<CForm
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				class="complete-popout__form"
			/>
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

type CompleteForm = {
	solution: string;
	scenePictureUrl: any[];
};

type CompleteSubmitPayload = CompleteForm & {
	id: string;
};

const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		recordId?: string | number | null;
		beforeClose?: (
			payload?: CompleteSubmitPayload
		) => boolean | Promise<boolean>;
	}>(),
	{
		visible: false,
		title: "处理异常",
	}
);

const emit = defineEmits<{ (e: "update:visible", value: boolean): void }>();

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<CompleteForm>(createDefaultForm());

const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});

const title = computed(() => props.title ?? "处理异常");

watch(
	() => visible.value,
	(value) => {
		if (value) resetForm();
	}
);

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "220rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFields(),
}));

function buildFields(): CFormSchemaField[] {
	return [
		{
			label: "解决办法",
			prop: "solution",
			component: "Textarea",
			required: true,
			componentProps: {
				placeholder: "请输入解决办法",
				autosize: { minHeight: 120, maxHeight: 300 },
				maxlength: 500,
			},
		},
		{
			label: "现场照片",
			prop: "scenePictureUrl",
			component: "Uploader",
			required: false,
			componentProps: {
				limit: 9,
				uploadUrl: "/file/upload",
				uploadBaseUrl: requestUrl,
				fieldName: "file",
			},
		},
	];
}

function createDefaultForm(): CompleteForm {
	return {
		solution: "",
		scenePictureUrl: [],
	};
}

function resetForm() {
	const defaults = createDefaultForm();
	if (!formModel.value) {
		formModel.value = defaults;
	} else {
		formModel.value.solution = defaults.solution;
		formModel.value.scenePictureUrl = defaults.scenePictureUrl;
	}
	nextTick(() => {
		formRef.value?.setValue?.("solution", defaults.solution);
		formRef.value?.setValue?.("scenePictureUrl", defaults.scenePictureUrl);
		formRef.value?.clearValidate?.();
	});
}

function normalizeSceneList(raw: any): any[] {
	if (!raw) return [];
	if (Array.isArray(raw)) return raw.slice();
	if (typeof raw === "string") {
		return raw
			.split(/[\,\s]+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}
	return [];
}

function safeString(value: unknown): string {
	if (value === undefined || value === null) return "";
	return String(value);
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
		const normalized = {
			solution: safeString(formModel.value.solution).trim(),
			scenePictureUrl: normalizeSceneList(formModel.value.scenePictureUrl),
		};
		formModel.value.solution = normalized.solution;
		formModel.value.scenePictureUrl = normalized.scenePictureUrl;
		const payload: CompleteSubmitPayload = {
			id: safeString(props.recordId).trim(),
			solution: normalized.solution,
			scenePictureUrl: normalized.scenePictureUrl.slice(),
		};
		const result = await props.beforeClose(payload);
		if (result === false) return false;
		resetForm();
		return result ?? true;
	}
	resetForm();
	return true;
}
</script>

<style scoped lang="scss">
.complete-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px;
	box-sizing: border-box;
}

.complete-popout__form {
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
