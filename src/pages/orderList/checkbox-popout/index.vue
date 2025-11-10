<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="escalate-popout">
			<CForm
				v-if="visible"
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				class="escalate-popout__form"
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
import { useUserStore } from "@/stores/user";
import { storeToRefs } from "pinia";
import { queryDictList } from "@/api/dict";

type BeforeCloseHandler = (
	type: "confirm" | "cancel" | "close",
	payload?: EscalateForm
) => boolean | Promise<boolean>;

const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		recordId?: string | number | null;
		dispatchType?: "repair" | "inspect" | "maintain";
		beforeClose?: BeforeCloseHandler;
	}>(),
	{
		dispatchType: "repair",
		visible: false,
		title: "派工",
	}
);

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
	(e: "submit", value: EscalateForm): void;
}>();
const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});
type EscalateForm = {
	planTime: string;
	userName: string;
};

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<EscalateForm>(createDefaultForm());
const title = computed(() => props.title ?? "派单");

function getTodayDate() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
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

function resetForm() {
	formModel.value = createDefaultForm();
}

const buildFieldsComputed = computed<CFormSchemaField[]>(() => {
	return [
		{
			label: "指派人员",
			prop: "userId",
			component: "DispatchPerson",
			required: true,
			componentProps: {
				placeholder: "请选择指派人员",
				title: "选择指派人员",
				labelProp: "userName",
				onError: handleDispatchError,
				multiple: props.dispatchType === "inspect" ? true : false,
				requestSource: "custom", // 使用自定义接口
				customApi: {
					url: "/system/user/getAllUsers",
					method: "post",
				},
			},
			onChange: ({ value, prev, model }) => {
				formModel.value.userName = model.userName || "";
			},
		},
		{
			label: "选择时间",
			prop: "planTime",
			component: "DateTime",
			required: true,
			defaultValue: getTodayDate(),
			componentProps: {
				type: "yMd",
				min: getTodayDate(),
			},
			visible: props.dispatchType !== "repair",
		},
	];
});

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "220rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFieldsComputed.value,
}));

function createDefaultForm(): EscalateForm {
	return {
		planTime: getTodayDate(),
		userName: "",
		userId: "",
	};
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
		if (!ok) return false;
	}
	if (typeof props.beforeClose === "function") {
		let news = JSON.parse(JSON.stringify(formModel.value));
		// Add recordId to the payload
		if (props.dispatchType === "repair") {
			news.userId = Number(news.userId);
		}
		const result = await props.beforeClose(news);
		if (result === false) return false;
		return result ?? Promise.reject(true);
	}
	return true;
}

function handleDispatchError(error: any) {
	if (!error) return;
	const msg =
		typeof error === "string"
			? error
			: error?.msg || error?.message || "派工人员加载失败";
	if (msg) uni.showToast({ title: msg, icon: "none" });
}
</script>

<style scoped lang="scss">
.escalate-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px;
	box-sizing: border-box;
}

.escalate-popout__form {
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
