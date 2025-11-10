<script setup lang="ts">
// @ts-nocheck
// 精简版：严格按官网示例使用 <sar-datetime-picker-input>
// 不做任何扩展/降级/格式转换。
// 只负责把选中的值回填到表单。
// 若需要其它行为再单独提出。

import { ref, watch, computed } from "vue";
import { formatDate } from "sard-uniapp";
import { pad } from "@/utils/format";

const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	setValue: (v: any) => void;
}>();

const value = ref<any>(props.state.value);
watch(
	() => props.state.value,
	(v: any) => {
		value.value = v;
		console.log(value.value, "[FieldDateTime] props.state.value changed:", v);
	}
);

const componentProps = computed<Record<string, any>>(() => {
	const raw = props.field?.componentProps;
	if (typeof raw === "function") {
		try {
			return (
				raw({
					field: props.field,
					model: (props.field as any)?.model ?? {},
					values: (props.field as any)?.model ?? {},
				}) || {}
			);
		} catch (err) {
			console.warn("[FieldDateTime] componentProps error", err);
			return {};
		}
	}
	return raw && typeof raw === "object" ? raw : {};
});

const placeholder = computed(() => {
	if (componentProps.value?.placeholder != null)
		return componentProps.value.placeholder;
	if (props.field?.placeholder) return props.field.placeholder;
	return "请选择日期";
});

const title = computed(() => {
	if (componentProps.value?.title != null) return componentProps.value.title;
	if (props.field?.title) return props.field.title;
	return "请选择日期";
});

const pickerProps = computed(() => {
	const { placeholder: _ph, title: _tt, ...rest } = componentProps.value || {};
	return rest;
});

// 将值转换为 Date 对象用于显示
const displayValue = computed(() => {
	if (!value.value) return undefined;

	// 如果已经是 Date 对象，直接返回
	if (value.value instanceof Date) return value.value;

	// 将字符串转换为 Date 对象
	const dateStr = String(value.value).replace(/-/g, "/");
	const date = new Date(dateStr);

	return isNaN(date.getTime()) ? undefined : date;
});

function formatDateTime(input: any) {
	if (!input) return input;

	const d = input instanceof Date ? input : new Date(input);
	if (isNaN(d.getTime())) return input;

	const type = componentProps.value?.type || "yMdhms";
	const isDateOnly = type === "yMd" || type === "ymd" || type === "date";

	return isDateOnly
		? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
		: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
				d.getHours()
		  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function onChange(v: any) {
	const formatted = formatDateTime(v);
	value.value = formatted;
	props.setValue(formatted);
}
</script>
<template>
	<sar-datetime-picker-input
		:model-value="displayValue"
		:title="title"
		:placeholder="placeholder"
		clearable
		:type="componentProps.type || 'yMdhms'"
		:disabled="disabled"
		v-bind="pickerProps"
		@update:model-value="onChange"
	/>
</template>
