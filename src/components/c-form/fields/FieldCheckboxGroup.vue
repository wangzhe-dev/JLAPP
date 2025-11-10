<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch } from "vue";

const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	readonly?: boolean;
	setValue: (v: any) => void;
}>();

const innerValue = ref(normalizeValue(props.state?.value));

watch(
	() => props.state?.value,
	(value) => {
		innerValue.value = normalizeValue(value);
	}
);

const componentProps = computed(() => {
	const raw = props.field?.componentProps;
	if (typeof raw === "function") {
		try {
			const ctx = {
				model: props.field?.model || {},
				field: props.field,
				value: innerValue.value,
			};
			const result = raw(ctx);
			return result && typeof result === "object" ? result : {};
		} catch (error) {
			console.warn("[FieldCheckboxGroup] componentProps() failed", error);
			return {};
		}
	}
	return raw && typeof raw === "object" ? raw : {};
});

const forwardedProps = computed(() => {
	const { options, direction, disabled, ...rest } = componentProps.value;
	return rest;
});

const optionList = computed(() => {
	const fieldOptions = componentProps.value.options || props.field?.options;
	if (!fieldOptions) return [];
	if (Array.isArray(fieldOptions)) return fieldOptions;
	if (typeof fieldOptions === "function") {
		try {
			return fieldOptions({
				model: props.field?.model || {},
				field: props.field,
				value: innerValue.value,
			});
		} catch (error) {
			console.warn("[FieldCheckboxGroup] options() failed", error);
		}
	}
	return [];
});

const direction = computed(() => componentProps.value.direction || "vertical");
const disabled = computed(() => props.disabled || componentProps.value.disabled);

function normalizeValue(value: any): string[] {
	if (value === undefined || value === null || value === "" || value === false) {
		return [];
	}
	if (Array.isArray(value)) return value.map((item) => String(item));
	return [String(value)];
}

function handleChange(event: any) {
	if (props.readonly) return;
	const raw = event?.detail?.value ?? event;
	const values = Array.isArray(raw) ? raw.map((item) => String(item)) : [];
	innerValue.value = values;
	props.setValue(values);
	const fn = props.field?.onChange;
	if (typeof fn === "function") {
		try {
			fn({
				field: props.field,
				model: props.field?.model || {},
				value: values,
				prev: props.state?.value,
			});
		} catch (error) {
			console.warn("[FieldCheckboxGroup] onChange failed", error);
		}
	}
}
</script>

<template>
	<sar-checkbox-group
		v-model="innerValue"
		:direction="direction"
		:disabled="disabled"
		v-bind="forwardedProps"
		@change="handleChange"
	>
		<template v-if="optionList.length">
			<sar-checkbox
				v-for="option in optionList"
				:key="option.value || option"
				:value="option.value || option"
				:disabled="option.disabled"
			>
				{{ option.label || option.text || option.name || option.value || option }}
			</sar-checkbox>
		</template>
		<template v-else>
			<slot />
		</template>
	</sar-checkbox-group>
</template>
