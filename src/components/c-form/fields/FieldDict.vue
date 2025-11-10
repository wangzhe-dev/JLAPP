<script setup lang="ts">
// @ts-nocheck
import { computed, watchEffect, ref, watch, inject } from "vue";
// 字典 / 选项字段：使用 sard picker-input
// 输入 props： field, state, disabled, readonly, setValue, getOptions()
const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	readonly?: boolean;
	setValue: (v: any) => void;
	getOptions: () => any[];
	loadOptions?: (force?: boolean) => Promise<void> | void;
	clearCascade?: (includeSelf?: boolean) => string[];
}>();

const formCtx = inject<any>("CFormContext", null);

function handleCascadeClear() {
	if (typeof props.clearCascade === "function") {
		props.clearCascade(true);
	}
}

const popupVisible = ref(false);
const emit = defineEmits(["dict-click"]);

const loading = ref(false);

async function ensureLazyLoaded(force = false) {
	const cfg = props.field?.asyncOptions;
	const needForce = force || cfg?.reloadOnOpen === true;
	const shouldLoad =
		needForce ||
		cfg?.lazy === true ||
		(!columns.value.length && (cfg || props.field?.dict));
	if (!shouldLoad || typeof props.loadOptions !== "function") return;
	const forceFlag = needForce || cfg?.lazy === true || !columns.value.length;
	loading.value = true;
	try {
		await props.loadOptions(forceFlag);
	} finally {
		loading.value = false;
	}
}

async function handleClick() {
	emit("dict-click", { field: props.field, value: props.state.value });
	const guard = props.field.onClick;
	if (typeof guard === "function") {
		try {
			const passed = await guard({
				field: props.field,
				model: props.field?.model || {},
				value: props.state.value,
			});
			if (passed === false) return;
		} catch {
			return;
		}
	}
	await ensureLazyLoaded(true);
	popupVisible.value = true;
}

// 计算列：保证当外部 options 变更时（异步/字典加载）能够触发刷新
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
			console.warn("[FieldDict] componentProps() failed", error);
		}
	}
	return raw && typeof raw === "object" ? raw : {};
});

const labelPropKey = computed(() => {
	const cp = componentProps.value || {};
	return (
		cp.labelProp ||
		cp.displayProp ||
		props.field?.labelProp ||
		props.field?.displayProp ||
		""
	);
});

const joinSeparator = computed(() => {
	const cp = componentProps.value || {};
	if (cp.displaySeparator !== undefined) return cp.displaySeparator;
	if (props.field?.displaySeparator !== undefined)
		return props.field.displaySeparator;
	return "、";
});

const placeholder = computed(
	() => componentProps.value.placeholder ?? props.field?.placeholder ?? ""
);

const optionsSource = computed(() => {
	const cp = componentProps.value;
	let source: any = undefined;
	if (cp && cp.options !== undefined) source = cp.options;
	if (source === undefined) source = props.getOptions?.() || [];
	if (typeof source === "function") {
		try {
			return source({
				field: props.field,
				model: props.field?.model || {},
				value: props.state?.value,
			});
		} catch (error) {
			console.warn("[FieldDict] options() failed", error);
			return [];
		}
	}
	return source;
});

const columns = computed(() => {
	const opts = Array.isArray(optionsSource.value)
		? optionsSource.value
		: [];
	return opts.map((o: any) => ({
		label: o?.label ?? o?.text ?? o?.name ?? o?.value,
		value: o?.value,
		origin: o,
	}));
});

function isSameOptionValue(a: any, b: any) {
	if (a === b) return true;
	if (a == null || b == null) return false;
	return String(a) === String(b);
}

function findOptionByValue(value: any) {
	return columns.value.find((item: any) =>
		isSameOptionValue(item?.value, value)
	);
}

function resolveOptionLabel(option: any, fallback: any): string {
	if (option && typeof option === "object") {
		const origin = option.origin || option.raw || option;
		const raw = origin?.raw || origin;
		const candidate =
			option.label ??
			origin?.label ??
			origin?.text ??
			origin?.name ??
			origin?.title ??
			origin?.warnDesc ??
			origin?.faultTypeDesc ??
			origin?.value ??
			raw?.label ??
			raw?.text ??
			raw?.name ??
			raw?.title ??
			raw?.warnDesc ??
			raw?.faultTypeDesc ??
			raw?.value;
		if (candidate !== undefined && candidate !== null) {
			return String(candidate);
		}
	}
	if (fallback === undefined || fallback === null) return "";
	return typeof fallback === "string" || typeof fallback === "number"
		? String(fallback)
		: "";
}

function applyLabelProp(value: any, selectedOptions?: any[]) {
	const key = labelPropKey.value;
	if (!key) return;
	const model = props.field?.model;
	if (!model || typeof model !== "object") return;
	const assign = (next: any) => {
		model[key] = next;
		if (formCtx?.setValue && key !== props.field?.prop) {
			try {
				formCtx.setValue(key, next);
			} catch {}
		}
	};
	if (
		value === undefined ||
		value === null ||
		(Array.isArray(value) && value.length === 0)
	) {
		assign("");
		return;
	}
	const options = Array.isArray(selectedOptions) ? selectedOptions : [];
	const getOption = (val: any, index: number) =>
		options[index] || findOptionByValue(val);
	if (Array.isArray(value)) {
		const labels = value
			.map((val, index) => resolveOptionLabel(getOption(val, index), val))
			.filter((label) => !!label);
		const separator = joinSeparator.value ?? "、";
		assign(labels.join(separator));
		return;
	}
	const option = getOption(value, 0);
	assign(resolveOptionLabel(option, value));
}

function handleClear() {
	const prev = props.state.value;
	props.setValue(undefined);
	applyLabelProp(undefined);
	handleCascadeClear();
	const fn = props.field.onChange;
	if (typeof fn === "function") {
		try {
			fn({
				field: props.field,
				model: props.field?.model || {},
				value: undefined,
				prev,
			});
		} catch {}
	}
}

async function handleChange(val: any, selectedOptions?: any[], indexes?: any[]) {
	const prev = props.state.value;
	props.setValue(val);
	applyLabelProp(val, selectedOptions);
	const fn = props.field.onChange;
	if (typeof fn === "function") {
		try {
			await fn({
				field: props.field,
				model: props.field?.model || {},
				value: val,
				prev,
				options: selectedOptions,
				indexes,
			});
		} catch {}
	}
	popupVisible.value = false;
}

const displayValue = computed(() => {
	const raw = props.state?.value;
	if (raw === undefined || raw === null || raw === "") return "";
	const toLabel = (val: any) => {
		const matched = columns.value.find((item) =>
			isSameOptionValue(item?.value, val)
		);
		if (matched) return matched.label ?? String(val ?? "");
		if (val && typeof val === "object") {
			return val.label || val.text || val.name || val.value || "";
		}
		return typeof val === "number" ? String(val) : val ?? "";
	};
	if (Array.isArray(raw)) {
		if (!raw.length) return "";
		const labels = raw.map((item) => toLabel(item)).filter(Boolean);
		const separator = joinSeparator.value ?? "、";
		return labels.length
			? labels.join(separator)
			: raw.map((item) => String(item ?? "")).join(separator);
	}
	return toLabel(raw);
});

// 调试：仅在开发环境打印一次最新长度（可按需移除）
watchEffect(() => {
	if (process.env.NODE_ENV !== "production") {
		try {
			console.debug("[FieldDict] columns length:", columns.value.length);
		} catch {}
	}
});

watch(
	() => props.state.value,
	(val) => {
		applyLabelProp(val);
	},
	{ immediate: true }
);

watch(
	() => columns.value,
	() => {
		applyLabelProp(props.state.value);
	}
	);

	watch(
		() => labelPropKey.value,
		() => {
			applyLabelProp(props.state.value);
		}
	);
</script>
<template>
	<view class="field-dict">
		<sar-popout-input
			:model-value="displayValue"
			:placeholder="loading ? '加载中...' : placeholder"
			clearable
			:readonly="props.readonly"
			:disabled="props.disabled || loading"
			@click="handleClick"
			@tap="handleClick"
			@clear="handleClear"
		/>
		<sar-picker-popout
			v-model:visible="popupVisible"
			:model-value="props.state.value"
			:columns="columns"
			title="请选择"
			@change="handleChange"
			@update:model-value="handleChange"
		/>
	</view>
</template>
