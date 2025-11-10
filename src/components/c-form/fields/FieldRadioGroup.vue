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
			return raw({
				field: props.field,
				model: props.field?.model || {},
				value: props.state?.value,
			});
		} catch (error) {
			console.warn("[FieldRadioGroup] componentProps() failed", error);
			return {};
		}
	}
	return raw && typeof raw === "object" ? raw : {};
});

const optionList = computed(() => {
	const fieldOptions = componentProps.value.options || props.field?.options;
	if (!fieldOptions) return [];
	if (Array.isArray(fieldOptions)) return fieldOptions;
	if (typeof fieldOptions === "function") {
		try {
			return fieldOptions({
				field: props.field,
				model: props.field?.model || {},
				value: props.state?.value,
			});
		} catch (error) {
			console.warn("[FieldRadioGroup] options() failed", error);
		}
	}
	return [];
});

const direction = computed(
	() => componentProps.value.direction || "horizontal"
);

const disabled = computed(
	() => props.disabled || componentProps.value.disabled
);

const forwardedProps = computed(() => {
	const { options, direction, disabled, ...rest } = componentProps.value;
	return rest;
});

function normalizeValue(value: any) {
	if (value === undefined || value === null) return "";
	return String(value);
}

function emitChange(value: string) {
	if (props.readonly) return;
	const next = value === "" ? undefined : value;
	const prev = props.state?.value;
	props.setValue(next);
	const fn = props.field?.onChange;
	if (typeof fn === "function") {
		try {
			fn({
				field: props.field,
				model: props.field?.model || {},
				value: next,
				prev,
			});
		} catch (error) {
			console.warn("[FieldRadioGroup] onChange failed", error);
		}
	}
}

function handleChange(event: any) {
	const raw = event?.detail?.value ?? event;
	const value = normalizeValue(raw);
	innerValue.value = value;
	emitChange(value);
}
</script>

<template>
	<sar-radio-group
		v-model="innerValue"
		:direction="direction"
		:disabled="disabled"
		v-bind="forwardedProps"
		@change="handleChange"
		@update:model-value="handleChange"
	>
		<template v-if="optionList.length">
			<sar-radio
				v-for="option in optionList"
				:key="option.value ?? option"
				:value="option.value ?? option"
				:disabled="option.disabled"
			>
				{{ option.label || option.text || option.name || option.value || option }}
			</sar-radio>
		</template>
		<slot v-else />
	</sar-radio-group>
</template>
