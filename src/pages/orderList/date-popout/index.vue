<!--
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-23 19:11:40
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-29 16:35:20
 * @FilePath: /NEWAPP/src/pages/orderList/date-popout/index.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="wo-popout-body">
			<CForm
				v-if="visible"
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				class="date-popout__form"
			/>
		</view>
	</sar-popout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch } from "vue";
import { formatDate } from "sard-uniapp";
import { CForm } from "@/components/c-form";
import type {
	CFormExpose,
	CFormSchema,
	CFormSchemaField,
} from "@/components/c-form/types";
type DatePopoutForm = {
	repairDate: string;
};
type BeforeCloseHandler = (
	type: "confirm" | "cancel" | "close",
	payload?: any
) => boolean | Promise<boolean>;
const props = defineProps<{
	modelValue?: string;
	visible?: boolean;
	title?: string;
	pickerType?: string;
	beforeClose?: BeforeCloseHandler;
}>();

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
}>();

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<DatePopoutForm>({
	repairDate: formatDate(new Date(), "YYYY-MM-DD ss:HH:mm"),
}); 

const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});
 
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
			prop: "repairDate",
			component: "DateTime",
			required: true,
		},
	];
}

function resetForm() {
	formModel.value = { repairDate: "" };
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
			repairDate: formModel.value.repairDate,
		};
		const result = await props.beforeClose(news);
		if (result === false) return false;
		return result ?? Promise.reject(true);
	}
	return true;
}
 
</script>
<style scoped lang="scss">
.wo-popout-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px;
	box-sizing: border-box;
	max-height: 20vh;
	overflow-y: auto;
}

.date-popout__form {
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