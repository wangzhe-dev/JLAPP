<!--
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-18 16:53:04
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-29 16:36:23
 * @FilePath: /NEWAPP/src/pages/orderList/textarea-popout/index.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="textarea-popout">
			<CForm
				v-if="visible"
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				class="textarea-popout__form"
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

type TextareaPopoutForm = {
	noticeContent: string;
};
type BeforeCloseHandler = (
	type: "confirm" | "cancel" | "close",
	payload?: any,
	reasonType?: 1 | 2 | 3
) => boolean | Promise<boolean>;
const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		placeholder?: string;
		maxlength?: number | string;
		submitTrim?: boolean;
		reasonType?: number | string;
		recordId?: string | number | null;
		beforeClose?: BeforeCloseHandler;
	}>(),
	{
		maxlength: 200,
		submitTrim: true,
		reasonType: null,
	}
);

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
}>();

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<TextareaPopoutForm>({
	noticeContent: "",
});

const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});

const reasonCopy = computed(() => {
	console.log('[TextareaPopout] reasonType:', props.reasonType, typeof props.reasonType);
	const type = Number(props.reasonType);
	
	if (type === 2) {
		return { title: "驳回原因", placeholder: "请输入驳回原因" };
	} else if (type === 3) {
		return { title: "转单理由", placeholder: "请输入转单理由" };
	} else {
		return { title: "拒绝原因", placeholder: "请输入拒绝原因" };
	}
});

const title = computed(() => props.title ?? reasonCopy.value.title);
const placeholder = computed(
	() => props.placeholder ?? reasonCopy.value.placeholder
);

watch(
	() => visible.value,
	(value) => {
		if (value) {
			resetForm();
		}
	}
);

const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "10rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFields(),
}));

function buildFields(): CFormSchemaField[] {
	return [
		{
			label: undefined,
			prop: "noticeContent",
			component: "Textarea",
			required: true,
			noLabel: title.value,
			componentProps: {
				placeholder: placeholder.value,
				inlaid: false,
				autosize: { minHeight: "230rpx", maxHeight: "220rpx" },
				maxlength: Number(props.maxlength ?? 200) || 200,
			},
		},
	];
}

function resetForm() {
	formModel.value = { noticeContent: "" };
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
		let news = {
			rejectReason: formModel.value.noticeContent,
			id: props.recordId,
		};
		const result = await props.beforeClose(news, props.reasonType);
		if (result === false) return false;
		return result ?? Promise.reject(true);
	}
	return true;
}
</script>

<style scoped lang="scss">
.textarea-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px;
	box-sizing: border-box;
}

.textarea-popout__form {
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
