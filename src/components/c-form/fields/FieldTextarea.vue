<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	readonly?: boolean;
	setValue: (v: any) => void;
}>();

const componentProps = computed(() => {
	const raw = props.field?.componentProps;
	if (typeof raw === "function") {
		try {
			return raw({
				field: props.field,
				state: props.state,
				value: props.state?.value,
			});
		} catch (error) {
			console.warn("[FieldTextarea] componentProps() failed", error);
		}
	}
	return raw && typeof raw === "object" ? raw : {};
});

const placeholder = computed(
	() => componentProps.value.placeholder ?? props.field?.placeholder ?? ""
);

const inlaid = computed(() => {
	if (componentProps.value.inlaid !== undefined)
		return Boolean(componentProps.value.inlaid);
	if (props.field?.inlaid !== undefined) return Boolean(props.field.inlaid);
	return true;
});

const autosize = computed(() => componentProps.value.autosize);

const resolvedMinHeight = computed(() => {
	const raw = autosize.value?.minHeight ?? componentProps.value.minHeight;
	if (raw === undefined || raw === null || raw === "") return "200rpx";
	if (typeof raw === "number") return `${raw}rpx`;
	return String(raw);
});

const autoHeight = computed(() => {
	const fromProps = componentProps.value.autoHeight;
	if (fromProps !== undefined) return Boolean(fromProps);
	if (autosize.value) return true;
	return false;
});

const maxlength = computed(() => {
	const val = componentProps.value.maxlength ?? props.field?.maxlength;
	if (val === undefined || val === null) return undefined;
	const num = Number(val);
	return Number.isNaN(num) ? undefined : num;
});
</script>
<template>
	<sar-input
		type="textarea"
		:model-value="props.state.value"
		:disabled="props.disabled"
		:readonly="props.readonly"
	:placeholder="placeholder"
	:inlaid="inlaid"
	:autosize="autosize"
	:min-height="resolvedMinHeight"
	:auto-height="autoHeight"
	:maxlength="maxlength"
		clearable
		@update:model-value="(val) => props.setValue(val)"
	/>
</template>
