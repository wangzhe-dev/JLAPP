<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch, inject, nextTick } from "vue";
import DispatchPopout from "@/components/dispatch/DispatchPopout.vue";

const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	readonly?: boolean;
	setValue: (v: any) => void;
}>();

const formCtx: any = inject("CFormContext", null);
const popoutVisible = ref(false);
const popoutLoading = ref(false);
const selection = ref<string[]>([]);

const modelRef = computed(() => props.field?.model || {});

const componentConfig = computed(() => {
	const raw = props.field?.componentProps;
	if (typeof raw === "function") {
		try {
			const ctx = {
				model: modelRef.value,
				field: props.field,
				value: props.state?.value,
			};
			const result = raw(ctx);
			return result && typeof result === "object" ? result : {};
		} catch (error) {
			console.warn("[FieldDispatchPerson] componentProps() failed", error);
			return {};
		}
	}
	return raw && typeof raw === "object" ? raw : {};
});

const allowMultiple = computed(() => componentConfig.value.multiple === true);

watch(
	() => props.state?.value,
	(value) => {
		const normalized = normalizeSelectionValue(value);
		if (!isSameArray(selection.value, normalized)) {
			selection.value = normalized.length ? [...normalized] : [];
		}
		if (normalized.length) nextTickClearError();
	},
	{ immediate: true, deep: true }
);

const selectionProxy = computed({
	get() {
		return selection.value.length ? [...selection.value] : undefined;
	},
	set(val) {
		const normalized = normalizeSelectionValue(val);
		if (!isSameArray(selection.value, normalized)) {
			selection.value = normalized.length ? [...normalized] : [];
		}
	},
});

const displayLabel = computed(() => {
	const formatter = componentConfig.value.displayFormatter;
	if (typeof formatter === "function") {
		try {
			const formatted = formatter({
				model: modelRef.value,
				field: props.field,
				value: props.state?.value,
			});
			if (formatted !== undefined && formatted !== null)
				return String(formatted);
		} catch (error) {
			console.warn("[FieldDispatchPerson] displayFormatter failed", error);
		}
	}
	const labelProp = componentConfig.value.labelProp || componentConfig.value.displayProp;
	const labelValue = resolveModelValue(labelProp);
	if (labelValue !== undefined && labelValue !== null && labelValue !== "")
		return String(labelValue);
	const normalized = normalizeSelectionValue(props.state?.value);
	if (normalized.length) return normalized.join("，");
	return "";
});

const placeholderText = computed(
	() => componentConfig.value.placeholder || "请选择"
);
const loadingPlaceholder = computed(
	() => componentConfig.value.loadingText || "加载中..."
);

const workGroupCodeComputed = computed(() => resolveWorkGroupCode());
const titleComputed = computed(
	() => componentConfig.value.title || "选择指派人员"
);

const requestParamsComputed = computed(() => {
	const cfg = componentConfig.value;
	const raw = cfg.requestParams;
	const source = cfg.requestSource ?? "workGroup";
	
	// 优先使用 requestParams
	if (typeof raw === "function") {
		try {
			const ctx = {
				field: props.field,
				model: modelRef.value,
				value: props.state?.value,
			};
			const result = raw(ctx);
			const params = result && typeof result === "object" ? result : {};
			return params;
		} catch (error) {
			console.warn("[FieldDispatchPerson] requestParams function failed", error);
			return {};
		}
	}
	
	if (raw && typeof raw === "object") {
		return raw;
	}
	
	// 如果没有 requestParams，尝试从 prop 中读取
	const params: Record<string, any> = {};
	
	if (source === "department") {
		// 从 departmentCodeProp 读取部门代码
		const deptProp = cfg.departmentCodeProp || cfg.departmentProp;
		if (deptProp) {
			// 直接访问 props.field.model 以确保获取最新值
			const model = props.field?.model || {};
			// 显式地访问属性值以建立响应式依赖
			const deptCode = deptProp.split('.').reduce((obj: any, key: string) => obj?.[key], model);
			if (deptCode) {
				params.departmentCode = String(deptCode);
			}
		}
	} else {
		// 从 workGroupCode 相关 prop 读取
		const groupCode = workGroupCodeComputed.value;
		if (groupCode) {
			params.workGroupCode = groupCode;
		}
	}
	return params;
});

function normalizeSelectionValue(value: any): string[] {
	if (value === undefined || value === null || value === "" || value === false)
		return [];
	if (Array.isArray(value)) return value.map((item) => String(item));
	return [String(value)];
}

function isSameArray(a: string[] | undefined, b: string[]): boolean {
	const aList = Array.isArray(a) ? a : [];
	if (aList.length !== b.length) return false;
	for (let i = 0; i < aList.length; i++) {
		if (aList[i] !== b[i]) return false;
	}
	return true;
}

function resolveModelValue(path: string | undefined) {
	if (!path) return undefined;
	const segments = path.split(".").filter(Boolean);
	if (!segments.length) return undefined;
	let cursor: any = modelRef.value;
	for (const key of segments) {
		if (cursor == null) return undefined;
		cursor = cursor[key];
	}
	return cursor;
}

function setModelValue(path: string | undefined, value: any) {
	if (!path) return;
	const segments = path.split(".").filter(Boolean);
	if (!segments.length) return;
	let cursor: any = modelRef.value;
	for (let i = 0; i < segments.length - 1; i++) {
		const key = segments[i];
		if (!cursor[key] || typeof cursor[key] !== "object") {
			cursor[key] = {};
		}
		cursor = cursor[key];
	}
	cursor[segments[segments.length - 1]] = value;
}

function normalizeWorkGroupCode(candidate: any): string {
	if (candidate === undefined || candidate === null) return "";
	if (typeof candidate === "string") return candidate.trim();
	if (typeof candidate === "number") return String(candidate).trim();
	if (typeof candidate === "boolean") return candidate ? "1" : "0";
	if (Array.isArray(candidate)) {
		for (const item of candidate) {
			const normalized = normalizeWorkGroupCode(item);
			if (normalized) return normalized;
		}
		return "";
	}
	if (typeof candidate === "object") {
		const potentialKeys = [
			"value",
			"id",
			"key",
			"code",
			"deptCode",
			"departmentCode",
			"costCenterCode",
			"groupCode",
			"workGroupCode",
			"handleGroupCode",
			"dispatchGroupCode",
			"dictValue",
		];
		for (const key of potentialKeys) {
			if (candidate[key] !== undefined && candidate[key] !== null) {
				const normalized = normalizeWorkGroupCode(candidate[key]);
				if (normalized) return normalized;
			}
		}
		if (typeof candidate.toString === "function") {
			const text = String(candidate.toString()).trim();
			if (text && text !== "[object Object]") return text;
		}
		return "";
	}
	if (typeof candidate === "function") {
		try {
			return normalizeWorkGroupCode(candidate());
		} catch {
			return "";
		}
	}
	return String(candidate).trim();
}

function resolveWorkGroupCode() {
	const cfg = componentConfig.value;
	if (typeof cfg.getWorkGroupCode === "function") {
		try {
			const result = cfg.getWorkGroupCode({
				field: props.field,
				model: modelRef.value,
				value: props.state?.value,
			});
			const normalized = normalizeWorkGroupCode(result);
			if (normalized) return normalized;
		} catch (error) {
			console.warn("[FieldDispatchPerson] getWorkGroupCode failed", error);
		}
	}
	const direct = normalizeWorkGroupCode(cfg.workGroupCode);
	if (direct) return direct;
	if (cfg.workGroupProp) {
		if (formCtx?.getFieldState) {
			const state =
				typeof cfg.workGroupProp === "string"
					? formCtx.getFieldState(cfg.workGroupProp)
					: null;
			if (state) {
				const normalized = normalizeWorkGroupCode(state.value);
				if (normalized) return normalized;
			}
		}
		const value = resolveModelValue(cfg.workGroupProp);
		const normalized = normalizeWorkGroupCode(value);
		if (normalized) return normalized;
	}
	const modelFallback = normalizeWorkGroupCode(modelRef.value?.workGroupCode);
	if (modelFallback) return modelFallback;
	const propFallback = normalizeWorkGroupCode(
		props.field?.workGroupCode ?? props.field?.dispatchGroupCode
	);
	if (propFallback) return propFallback;
	return "";
}

function clearLinkedProps() {
	const cfg = componentConfig.value;
	const labelProp = cfg.labelProp || cfg.displayProp;
	if (labelProp) setModelValue(labelProp, "");
	const extraMap = cfg.extraMap || {};
	if (extraMap && typeof extraMap === "object") {
		Object.keys(extraMap).forEach((targetProp) => {
			setModelValue(targetProp, "");
		});
	}
	if (typeof cfg.onClear === "function") {
		try {
			cfg.onClear({
				field: props.field,
				model: modelRef.value,
				setField: setModelValue,
			});
		} catch (error) {
			console.warn("[FieldDispatchPerson] onClear failed", error);
		}
	}
}

function applyOption(option: any) {
	if (!option) return;
	const cfg = componentConfig.value;
	const labelProp = cfg.labelProp || cfg.displayProp;
	if (labelProp) {
		const labelValue =
			option?.label ??
			option?.raw?.nickName ??
			option?.raw?.name ??
			option?.raw?.userName ??
			"";
		setModelValue(labelProp, labelValue ?? "");
	}
	const extraMap = cfg.extraMap || {};
	if (extraMap && typeof extraMap === "object") {
		Object.keys(extraMap).forEach((targetProp) => {
			const mapper = extraMap[targetProp];
			let result: any;
			if (typeof mapper === "function") {
				try {
					result = mapper(option);
				} catch (error) {
					console.warn("[FieldDispatchPerson] extraMap function failed", error);
				}
			} else if (Array.isArray(mapper)) {
				for (const path of mapper) {
					const value = getValueFromOption(option, path);
					if (value !== undefined && value !== null && value !== "") {
						result = value;
						break;
					}
				}
			} else if (typeof mapper === "string") {
				result = getValueFromOption(option, mapper);
			}
			setModelValue(targetProp, result ?? "");
		});
	}
}

function applyMultipleOptions(options: any[]) {
	if (!options || !options.length) return;
	const cfg = componentConfig.value;
	const labelProp = cfg.labelProp || cfg.displayProp;
	
	if (labelProp) {
		// 收集所有选中项的 label，用逗号分隔
		const labels = options.map(option => 
			option?.label ??
			option?.raw?.nickName ??
			option?.raw?.name ??
			option?.raw?.userName ??
			""
		).filter(Boolean);
		const combinedLabel = labels.join("，");
		setModelValue(labelProp, combinedLabel);
	}
	
	// 对于 extraMap，多选模式下只处理第一个选项，或者可以根据业务需求调整
	const extraMap = cfg.extraMap || {};
	if (extraMap && typeof extraMap === "object" && options.length > 0) {
		const firstOption = options[0];
		Object.keys(extraMap).forEach((targetProp) => {
			const mapper = extraMap[targetProp];
			let result: any;
			if (typeof mapper === "function") {
				try {
					// 可以传入所有 options 或只传第一个，根据业务需求
					result = mapper(firstOption);
				} catch (error) {
					console.warn("[FieldDispatchPerson] extraMap function failed", error);
				}
			} else if (Array.isArray(mapper)) {
				for (const path of mapper) {
					const value = getValueFromOption(firstOption, path);
					if (value !== undefined && value !== null && value !== "") {
						result = value;
						break;
					}
				}
			} else if (typeof mapper === "string") {
				result = getValueFromOption(firstOption, mapper);
			}
			setModelValue(targetProp, result ?? "");
		});
	}
}

function getValueFromOption(option: any, path: string) {
	if (!option || !path) return undefined;
	const segments = path.split(".").filter(Boolean);
	let cursor = option;
	for (const key of segments) {
		if (cursor == null) return undefined;
		cursor = cursor[key];
	}
	return cursor;
}

function openPopout() {
	if (props.disabled || props.readonly) return;
	popoutVisible.value = true;
}

function handleClear() {
	const prev = props.state?.value;
	selection.value = [];
	if (allowMultiple.value) updateModelValue([]);
	else updateModelValue("");
	clearLinkedProps();
	triggerFieldChange(
		allowMultiple.value ? [] : "",
		prev,
		null,
		[]
	);
}

function handleChange(payload: {
	value?: string[] | undefined;
	options?: any[];
}) {
	const values = Array.isArray(payload?.value)
		? payload.value.map((item) => String(item))
		: [];
	if (!isSameArray(selection.value, values)) {
		selection.value = values.length ? [...values] : [];
	}
	const options = Array.isArray(payload?.options) ? payload.options : [];
	
	if (!options.length) {
		const prev = props.state?.value;
		if (allowMultiple.value) updateModelValue([]);
		else updateModelValue("");
		clearLinkedProps();
		triggerFieldChange(
			allowMultiple.value ? [] : "",
			prev,
			null,
			options
		);
		if (!allowMultiple.value) popoutVisible.value = false;
		return;
	}
	
	const prev = props.state?.value;
	if (allowMultiple.value) {
		updateModelValue(values);
		// 多选模式：合并所有选中项的 label
		applyMultipleOptions(options);
	} else {
		const option = options[0];
		updateModelValue(option.value || "");
		applyOption(option);
	}
	
	const eventValue = allowMultiple.value ? values : options[0]?.value || "";
	triggerFieldChange(eventValue, prev, options[0] || null, options);
	if (eventValue && (!Array.isArray(eventValue) || eventValue.length)) {
		nextTickClearError();
	}
	if (!allowMultiple.value) popoutVisible.value = false;
}

function updateModelValue(nextValue: any) {
	if (allowMultiple.value) {
		const nextArr = Array.isArray(nextValue)
			? nextValue.map((item) => String(item))
			: [];
		props.setValue(nextArr);
	} else {
		const nextStr =
			nextValue === undefined || nextValue === null ? "" : String(nextValue);
		props.setValue(nextStr);
	}
}

function triggerFieldChange(
	value: any,
	prev: any,
	option: any,
	options: any[] = []
) {
	const fn = props.field?.onChange;
	if (typeof fn === "function") {
		try {
			fn({
				field: props.field,
				model: modelRef.value,
				value,
				prev,
				option,
				options,
				selection: [...selection.value],
			});
		} catch (error) {
			console.warn("[FieldDispatchPerson] field.onChange failed", error);
		}
	}
}

function nextTickClearError() {
	if (!formCtx?.clearValidate) return;
	const prop = props.field?.prop;
	if (!prop) return;
	nextTick(() => {
		try {
			formCtx.clearValidate(prop);
		} catch (error) {
			console.warn("[FieldDispatchPerson] clearValidate failed", error);
		}
	});
}

function handleError(error: any) {
	const message =
		error?.msg ||
		error?.message ||
		error?.raw?.msg ||
		error?.data?.msg ||
		error?.toString?.() ||
		"派工人员加载失败";
	if (typeof uni !== "undefined") {
		uni.showToast({ title: message, icon: "none" });
	}
	if (typeof componentConfig.value.onError === "function") {
		try {
			componentConfig.value.onError(error);
		} catch (err) {
			console.warn("[FieldDispatchPerson] onError callback failed", err);
		}
	}
}

function handleLoading(state: any) {
	popoutLoading.value = !!state;
}
</script>

<template>
  <sar-popout-input
    :model-value="displayLabel"
    :placeholder="popoutLoading ? loadingPlaceholder : placeholderText"
    clearable
    :readonly="props.readonly"
    :disabled="props.disabled || popoutLoading"
    :loading="popoutLoading"
    @click="openPopout"
    @tap="openPopout"
    @clear="handleClear"
  />
  <DispatchPopout
    v-model:visible="popoutVisible"
    v-model="selectionProxy"
    :work-group-code="workGroupCodeComputed"
    :title="titleComputed"
    :multiple="allowMultiple"
    :request-source="componentConfig.requestSource"
    :request-params="requestParamsComputed"
    :custom-api="componentConfig.customApi"
    @change="handleChange"
    @loading="handleLoading"
    @error="handleError"
  />
</template>

<style scoped>
.sar-popout-input {
	width: 100%;
}
</style>
