<template>
	<sar-checkbox-popout
		v-if="isMultiple"
		v-model="innerValue"
		v-model:visible="innerVisible"
		:title="title"
		:options="optionList"
		searchable
		filter-placeholder="请输入派工人员姓名"
		@change="handleCheckboxChange"
	/>
	<sar-radio-popout
		v-else
		v-model="singleValue"
		v-model:visible="innerVisible"
		:title="title"
		:options="optionList"
		searchable
		filter-placeholder="请输入派工人员姓名"
		@change="handleRadioChange"
	/>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch } from "vue";
import { selectWorkGroupPerson, employeeQueryList } from "@/api/workGroup";

type OptionItem = {
	value: string;
	label: string;
	raw: Record<string, any>;
};

type RequestContext = {
	workGroupCode: string;
	multiple: boolean;
};

type RequestParamsInput =
	| Record<string, any>
	| ((ctx: RequestContext) => Record<string, any> | undefined | null);

type CustomApiConfig = {
	url: string;
	method?: "get" | "post" | "GET" | "POST";
	params?: Record<string, any>;
};

const props = withDefaults(
	defineProps<{
		modelValue?: string[] | undefined;
		visible?: boolean;
		workGroupCode?: string | null;
		title?: string;
		multiple?: boolean;
		requestSource?: "workGroup" | "department" | "custom";
		requestParams?: RequestParamsInput;
		customApi?: CustomApiConfig;
	}>(),
	{
		title: "选择派工人员",
		multiple: true,
		requestSource: "workGroup",
	}
);

const emit = defineEmits<{
	(e: "update:modelValue", value: string[] | undefined): void;
	(e: "update:visible", value: boolean): void;
	(
		e: "change",
		payload: { value: string[] | undefined; options: OptionItem[] }
	): void;
	(e: "loading", value: boolean): void;
	(e: "error", error: any): void;
}>();

const innerValue = ref<string[] | undefined>(
	normalizeInputValue(props.modelValue)
);
const innerVisible = ref<boolean>(props.visible ?? false);
const optionList = ref<OptionItem[]>([]);
const rawResponse = ref<any>(null);
const loading = ref(false);

const isMultiple = computed(() => props.multiple !== false);

watch(
	() => props.modelValue,
	(value) => {
		innerValue.value = normalizeInputValue(value);
	}
);

watch(innerValue, (value) => {
	emit("update:modelValue", value);
});

watch(
	() => props.visible,
	(value) => {
		if (typeof value === "boolean") {
			innerVisible.value = value;
		}
	}
);

watch(innerVisible, (value) => {
	emit("update:visible", value);
	if (value) {
		loadOptions();
	}
});

watch(
	() => props.workGroupCode,
	() => {
		if (innerVisible.value) loadOptions();
	}
);

watch(
	() => props.requestSource,
	() => {
		if (innerVisible.value) loadOptions();
	}
);

watch(
	() => props.requestParams,
	(newVal) => {
		if (innerVisible.value) loadOptions();
	},
	{ deep: true }
);

watch(
	() => props.customApi,
	(newVal) => {
		if (innerVisible.value) loadOptions();
	},
	{ deep: true }
);

watch(
	() => props.multiple,
	(value) => {
		if (
			value === false &&
			Array.isArray(innerValue.value) &&
			innerValue.value.length > 1
		) {
			innerValue.value = innerValue.value.slice(0, 1);
			emitSelection(innerValue.value);
		}
	}
);

const title = computed(() => props.title);

const optionMap = computed(() => {
	const map = new Map<string, OptionItem>();
	for (const item of optionList.value) {
		map.set(item.value, item);
	}
	return map;
});

const singleValue = computed({
	get() {
		const arr = innerValue.value;
		return Array.isArray(arr) && arr.length ? arr[0] : "";
	},
	set(value: any) {
		innerValue.value = normalizeSingleValue(value);
	},
});

async function loadOptions() {
	const source = props.requestSource ?? "workGroup";

	// 获取自定义请求参数 - 每次都重新解析以获取最新值
	const customParams = resolveRequestParams({
		workGroupCode: props.workGroupCode || "",
		multiple: isMultiple.value,
	});

	// 处理自定义接口调用
	if (source === "custom") {
		if (!props.customApi?.url) {
			optionList.value = [];
			emit("error", new Error("自定义接口缺少 url 配置"));
			return;
		}

		loading.value = true;
		emit("loading", true);
		try {
			const method = (props.customApi.method || "post").toLowerCase();
			const apiParams = {
				...props.customApi.params,
				...customParams,
			};

			let resp: any;
			const http = (await import("@/utils/request")).default;

			if (method === "get") {
				resp = await http.get(props.customApi.url, {
					params: apiParams,
					skipRepeatCheck: true,
				});
			} else {
				resp = await http.post(props.customApi.url, apiParams, {
					skipRepeatCheck: true,
				});
			}

			const rawList = extractResponseList(resp);
			rawResponse.value = rawList;
			optionList.value = normalizeOptions(rawList);
		} catch (error) {
			console.warn("[DispatchPopout] custom API load options failed", error);
			emit("error", error);
		} finally {
			loading.value = false;
			emit("loading", false);
		}
		return;
	}

	// 根据 requestSource 判断参数键名
	let requestParams: Record<string, any> = { ...customParams };
	if (source === "department") {
		// 使用 departmentCode
		if (!requestParams.departmentCode && props.workGroupCode) {
			requestParams.departmentCode = props.workGroupCode;
		}
	} else {
		// 使用 workGroupCode
		if (!requestParams.workGroupCode && props.workGroupCode) {
			requestParams.workGroupCode = props.workGroupCode;
		}
	}

	// 检查必要参数
	const requiredKey =
		source === "department" ? "departmentCode" : "workGroupCode";
	if (!requestParams[requiredKey]) {
		optionList.value = [];
		const msg = source === "department" ? "缺少部门信息" : "缺少派工班组信息";
		emit("error", new Error(msg));
		return;
	}

	loading.value = true;
	emit("loading", true);
	try {
		let rawList: any[] = [];
		if (source === "department") {
			const resp: any = await employeeQueryList(requestParams);
			rawList = extractResponseList(resp);
		} else {
			const resp: any = await selectWorkGroupPerson(requestParams);
			rawList = extractResponseList(resp);
		}
		rawResponse.value = rawList;
		optionList.value = normalizeOptions(rawList);
	} catch (error) {
		console.warn("[DispatchPopout] load options failed", error);
		emit("error", error);
	} finally {
		loading.value = false;
		emit("loading", false);
	}
}

function handleCheckboxChange(value: any) {
	const arrayValue = normalizeValueArray(value);
	innerValue.value = arrayValue;
	emitSelection(arrayValue);
}

function handleRadioChange(event: any) {
	const rawValue =
		event && event.detail && event.detail.value !== undefined
			? event.detail.value
			: event;
	const arrayValue = normalizeSingleValue(rawValue);
	innerValue.value = arrayValue;
	emitSelection(arrayValue);
}

function emitSelection(arrayValue: string[] | undefined) {
	const validArray = Array.isArray(arrayValue) ? arrayValue : [];

	const selectedOptions = validArray
		.map((val) => optionMap.value.get(val))
		.filter((item): item is OptionItem => !!item);
	emit("change", {
		value: arrayValue,
		options: selectedOptions,
	});
}

function normalizeOptions(raw: any[]): OptionItem[] {
	if (!Array.isArray(raw)) return [];
	const options = raw
		.map((item: any) => {
			if (
				item &&
				typeof item === "object" &&
				"value" in item &&
				"label" in item
			) {
				return {
					value: item.value != null ? String(item.value) : "",
					label: item.label != null ? String(item.label) : "",
					raw: item.raw ?? item,
				};
			}

			let value = "";
			let label = "";

			if (props.requestSource === "custom") {
				value = item?.userId + "" || "";
				label = item?.nickName || "";
			} else {
				value = item?.userName || item?.employeeNumber || "";
				label = item?.nickName || item?.employeeName || item?.userId || "";
			}
			return {
				value: value,
				label: label,
				raw: item,
			};
		})
		.filter((option: OptionItem) => option.value && option.label);
	return options;
}

function normalizeValueArray(value: any): string[] | undefined {
	if (
		value === undefined ||
		value === null ||
		value === "" ||
		value === false
	) {
		return undefined;
	}
	if (Array.isArray(value)) return value.map((v) => String(v));
	if (value.detail?.value !== undefined)
		return normalizeValueArray(value.detail.value);
	return [String(value)];
}

function normalizeSingleValue(value: any): string[] | undefined {
	if (
		value === undefined ||
		value === null ||
		value === "" ||
		value === false
	) {
		return undefined;
	}
	if (Array.isArray(value)) {
		return value.length ? [String(value[0])] : undefined;
	}
	return [String(value)];
}

function normalizeInputValue(value: any): string[] | undefined {
	if (Array.isArray(value)) return value.map((v) => String(v));
	if (
		value === undefined ||
		value === null ||
		value === "" ||
		value === false
	) {
		return undefined;
	}
	return [String(value)];
}

function resolveGroupCode(raw: unknown): string {
	if (raw === undefined || raw === null) return "";
	const text = String(raw).trim();
	return text;
}

function resolveRequestParams(ctx: RequestContext): Record<string, any> {
	const raw = props.requestParams;
	if (typeof raw === "function") {
		try {
			const result = raw(ctx);
			return result && typeof result === "object" ? { ...result } : {};
		} catch (error) {
			console.warn("[DispatchPopout] resolveRequestParams failed", error);
			return {};
		}
	}
	if (raw && typeof raw === "object") {
		return { ...raw };
	}
	return {};
}

function extractResponseList(resp: any): any[] {
	if (Array.isArray(resp?.data)) return resp.data;
	if (Array.isArray(resp?.records)) return resp.records;
	if (Array.isArray(resp?.list)) return resp.list;
	if (Array.isArray(resp)) return resp;
	return [];
}

function reload() {
	loadOptions();
}

defineExpose({ reload, loadOptions });
</script>
