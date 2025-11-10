<script lang="ts" setup>
// @ts-nocheck
import { ref, reactive, watch, provide, useSlots, computed } from "vue";
import { fetchDict } from "./dict";
import * as FieldComponents from "./fields";
import { resolvePresets } from "./presets";
import { getFormComponent } from "./registry";
import {
	splitPropPath,
	getModelValueByProp,
	setModelValueByProp,
	resolveFieldName,
} from "./utils/fieldHelpers";
import type {
	CFormSchema,
	CFormSchemaField,
	CFormExpose,
	InternalFieldState,
} from "./types";
const props = defineProps<{
	schema: CFormSchema;
	modelValue: Record<string, any>;
	errorBannerMax?: number;
}>();
const emits = defineEmits<{
	(e: "update:modelValue", v: Record<string, any>): void;
	(e: "submit", v: Record<string, any>): void;
	(e: "change", prop: string, value: any): void;
	(e: "validated", ok: boolean): void;
}>();
const fieldStates: Record<string, InternalFieldState> = reactive({});
const fieldOptionsStore: Record<string, any[]> = reactive({});
const formRef = ref<any>();
const rules = ref<Record<string, any[]>>({});
const slots = useSlots();
const hasActionsSlot = computed(() => Boolean(slots.actions));
const hasBodySlot = computed(() => Boolean(slots.body));
const shouldShowActions = computed(() => {
	if (props.schema.showActions === false) return false;
	if (props.schema.readonly && !hasActionsSlot.value) return false;
	return true;
});
const initialSnapshot: Record<string, any> = {};
// 选项缓存（key: field.prop）
const asyncOptionCache: Record<string, { ts: number; data: any[] }> = reactive(
	{}
);

function ensureFieldState(prop: string): InternalFieldState {
	if (!fieldStates[prop])
		fieldStates[prop] = reactive({
			value: undefined,
			errors: [],
			validating: false,
			touched: false,
		}) as InternalFieldState;
	return fieldStates[prop];
}

// 规范化：根据简写 type 映射到 component（仅一次）
const typeMap: Record<string, string> = {
	input: "Input",
	text: "Textarea",
	textarea: "Textarea",
	number: "Number",
	select: "Dict",
	picker: "PickerPopout",
	radio: "RadioPopout",
	"radio-input": "RadioInput",
	scan: "Scan",
	uploader: "Uploader",
	image: "Image",
	date: "Date",
	datetime: "DateTime",
	dict: "Dict",
	normal: "Normal",
	dispatch: "DispatchPerson",
	"dispatch-person": "DispatchPerson",
};

function isSlotField(field: CFormSchemaField) {
	return field?.component === "Slot" || !!(field as any)?.slotName;
}

function shouldWrapSlotField(field: CFormSchemaField) {
	if (!isSlotField(field)) return false;
	if (field.slotFormItem === true) return true;
	if (field.slotFormItem === false) return false;
	return typeof field.label === "string" && field.label.trim().length > 0;
}

// ==== 初始化字段（支持 groupTitle）====
let __autoGroupSeq = 0;
props.schema.fields.forEach((f: any) => {
	if (f.groupTitle && !f.component) f.component = "GroupTitle";
	if (f.component === "GroupTitle" && !f.prop)
		f.prop = `_g_${__autoGroupSeq++}`;
	if (!f.component && f.type) {
		const mapped = typeMap[f.type.toLowerCase?.()] || typeMap[f.type];
		if (mapped) (f as any).component = mapped as any;
	}
	if (f.dict && !f.component) (f as any).component = "Dict";
	if (f.component === "GroupTitle" || isSlotField(f)) return; // 分组/Slot 不做值初始化
	fieldOptionsStore[f.prop] = Array.isArray(f.options) ? f.options : [];
	const st = ensureFieldState(f.prop);
	const currentValue = getModelValueByProp(props.modelValue, f.prop);
	// 当前值为 undefined/null/空字符串 且有 defaultValue 时，使用默认值
	const shouldUseDefault =
		(currentValue === undefined ||
			currentValue === null ||
			currentValue === "") &&
		f.defaultValue !== undefined;

	if (shouldUseDefault) {
		// 支持函数形式的 defaultValue
		const resolvedDefault =
			typeof f.defaultValue === "function"
				? f.defaultValue({ field: f, model: props.modelValue })
				: f.defaultValue;
		st.value =
			typeof f.transformIn === "function"
				? f.transformIn(resolvedDefault, props.modelValue)
				: resolvedDefault;
		setModelValueByProp(props.modelValue, f.prop, st.value);
	} else {
		st.value = currentValue;
	}

	initialSnapshot[f.prop] = st.value;
});

// errorBanner 逻辑已移除：统一使用内置校验滚动与用户自定义 errorDisplay 方式
function getInlineError(_prop: string) {
	return ""; // 保留占位，若后续需要自定义 inline 错误可在此扩展
}

function buildRules() {
	const out: Record<string, any[]> = {};
	props.schema.fields.forEach((f: any) => {
		if (f.component === "GroupTitle" || isSlotField(f)) return; // 跳过标题及插槽字段
		const arr: any[] = [];
		if (f.required)
			arr.push({
				required: true,
				message: `${f.label || f.noLabel || f.prop}不能为空`,
				trigger: f.validateTrigger || "blur",
			});
		const presetRules = resolvePresets(f.preset, {
			model: props.modelValue,
			field: f,
		});
		if (presetRules?.length)
			arr.push(
				...presetRules.map((r) => ({
					trigger: f.validateTrigger || r.trigger || "blur",
					...r,
				}))
			);
		if (f.rules?.length)
			arr.push(
				...f.rules.map((r) => ({
					trigger: r.trigger || f.validateTrigger || "blur",
					...r,
				}))
			);
		if (arr.length) out[f.prop] = arr;
	});
	rules.value = out;
}
buildRules();
watch(
	() => props.schema.fields.map((f) => [f.prop, f.required, f.preset, f.rules]),
	() => buildRules(),
	{ deep: true }
);

async function validateDetail(propsList?: string[]) {
	if (props.schema.hooks?.beforeValidate) {
		const pass = await props.schema.hooks.beforeValidate(props.modelValue);
		if (pass === false) return { ok: false, errors: [] };
	}
	let ok = true;
	let errorsAgg: { prop: string; message: string }[] = [];
	try {
		await formRef.value?.validate();
	} catch (err: any) {
		ok = false;
		if (Array.isArray(err)) {
			errorsAgg = err
				.map((e: any) => ({
					prop: e.name || e.field || e.prop,
					message: e.message || e.msg || "校验失败",
				}))
				.filter((e) => e.prop);
		} else if (err?.errors && Array.isArray(err.errors)) {
			errorsAgg = err.errors.map((e: any) => ({
				prop: e.name || e.field || e.prop,
				message: e.message || e.msg || "校验失败",
			}));
		} else if (err && typeof err === "object") {
			errorsAgg = Object.keys(err).map((k) => ({
				prop: k,
				message: (err as any)[k],
			}));
		}
	}
	if (propsList?.length) {
		errorsAgg = errorsAgg.filter((e) => propsList.includes(e.prop));
		ok = errorsAgg.length === 0;
	}
	const mode = props.schema.errorDisplay;
	// banner 模式已删除，仅保留 toast/first 的首条提示
	if ((mode === "toast" || mode === "first") && errorsAgg.length) {
		uni.showToast({ title: errorsAgg[0].message, icon: "none" });
	}
	// 如果用户关闭了内置 scrollToFirstError (schema.scrollToFirstError === false) 仍可手动滚动
	if (errorsAgg.length && props.schema.scrollToFirstError === false) {
		const first = errorsAgg[0];
		// 使用 selectorQuery 滚动
		const id = `#cform-item-${first.prop}`;
		try {
			uni
				.createSelectorQuery()
				.select(id)
				.boundingClientRect((rect) => {
					if (rect) {
						uni.pageScrollTo({
							duration: 200,
							scrollTop: rect.top + (rect.top > 60 ? rect.top - 60 : 0),
						});
					}
				})
				.exec();
		} catch (e) {}
	}
	emits("validated", ok);
	if (props.schema.hooks?.afterValidate) {
		try {
			await props.schema.hooks.afterValidate({ ok, errors: errorsAgg });
		} catch (e) {}
	}
	return { ok, errors: errorsAgg };
}

async function validate(propsList?: string[]) {
	return (await validateDetail(propsList)).ok;
}

function reset(propsList?: string[]) {
	const targets = propsList
		? props.schema.fields.filter((f) => propsList.includes(f.prop))
		: props.schema.fields;
	targets.forEach((f) => {
		const st = ensureFieldState(f.prop);
		// 支持函数形式的 defaultValue
		const resolvedDefault =
			f.defaultValue !== undefined
				? typeof f.defaultValue === "function"
					? f.defaultValue({ field: f, model: props.modelValue })
					: f.defaultValue
				: undefined;
		st.value = resolvedDefault;
		st.errors = [];
		setModelValueByProp(props.modelValue, f.prop, resolvedDefault);
	});
	emitModel();
}

function clearValidate(propsList?: string[]) {
	if (Array.isArray(propsList) && propsList.length) {
		const targets = propsList
			.map((prop) => {
				const field = props.schema.fields.find((f) => f.prop === prop);
				if (!field) return undefined;
				return resolveFieldName(field);
			})
			.filter(Boolean);
		if (targets.length) formRef.value?.clearValidate?.(targets as any);
	} else {
		formRef.value?.clearValidate?.();
	}
	if (!propsList || !propsList.length) {
		Object.values(fieldStates).forEach((st) => {
			if (st) st.errors = [];
		});
		return;
	}
	propsList.forEach((prop) => {
		const st = fieldStates[prop];
		if (st) st.errors = [];
	});
}

function clearFieldValidate(prop?: string) {
	if (!prop) {
		clearValidate();
		return;
	}
	clearValidate([prop]);
}

function getValues() {
	const out: Record<string, any> = {};
	props.schema.fields.forEach((f: any) => {
		if (f.component === "GroupTitle") return; // 标题不返回值
		let v = fieldStates[f.prop]?.value;
		if (typeof f.transformOut === "function")
			v = f.transformOut(v, props.modelValue);
		out[f.prop] = v;
	});
	return out;
}

function setValue(prop: string, value: any) {
	const field = props.schema.fields.find((f) => f.prop === prop);
	const st = ensureFieldState(prop);
	st.value = value;
	setModelValueByProp(props.modelValue, prop, value);

	emits("change", prop, value);
	emitModel();
	if (hasFieldValue(value)) {
		clearFieldValidate(prop);
	}
	// 使用官方触发，不在此手动调用校验
}
function hasFieldValue(value: any) {
	if (value === undefined || value === null) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value === "boolean") return value;
	if (value instanceof Date) return !Number.isNaN(value.getTime());
	return true;
}

function getFieldState(prop: string) {
	return fieldStates[prop] || ensureFieldState(prop);
}

function emitModel() {
	emits("update:modelValue", { ...props.modelValue });
}

// 级联快速清空：给定一个 root 字段，递归清空其 cascadeTo 链上所有子字段
function clearCascade(rootProp: string, includeRoot = false) {
	const cleared: string[] = [];
	const map = new Map<string, CFormSchemaField>();
	props.schema.fields.forEach((f) => map.set(f.prop, f));
	function dfs(prop: string, isRoot = false) {
		const field = map.get(prop);
		if (!field) return;
		if (!isRoot || includeRoot) {
			setValue(prop, undefined);
			cleared.push(prop);
		}
		if (field.cascadeTo?.length) field.cascadeTo.forEach((c) => dfs(c));
	}
	dfs(rootProp, true);
	emitModel();
	return cleared;
}

function getDiffValues(all: Record<string, any>) {
	if (!props.schema.diffSubmit) return all;
	const diff: Record<string, any> = {};
	Object.keys(all).forEach((k) => {
		if (all[k] !== initialSnapshot[k]) diff[k] = all[k];
	});
	return diff;
}

async function handleSubmit() {
	const res = await validateDetail();
	if (!res.ok) {
		uni.showToast({ title: "请填必填项", icon: "none" });
		return;
	}
	const all = getValues();
	const diff = getDiffValues(all);
	if (props.schema.hooks?.beforeSubmit) {
		const pass = await props.schema.hooks.beforeSubmit({
			model: props.modelValue,
			diff,
			all,
		});
		if (pass === false) return;
	}
	emits("submit", props.schema.diffSubmit ? diff : all);
}

function isFieldVisible(f: CFormSchemaField) {
	let base = true;
	if (typeof f.visible === "function")
		base = f.visible({
			model: props.modelValue,
			values: props.modelValue,
			field: f,
		});
	else if (typeof f.visible === "boolean") base = f.visible;
	if (base && f.showWhen) {
		for (const key in f.showWhen) {
			const expect = (f as any).showWhen[key];
			const actual = getModelValueByProp(props.modelValue, key);
			if (Array.isArray(expect)) {
				if (!expect.includes(actual)) return false;
			} else {
				if (actual !== expect) return false;
			}
		}
	}
	return base;
}

function isFieldDisabled(f: CFormSchemaField) {
	if (typeof f.disabled === "function")
		return f.disabled({
			model: props.modelValue,
			values: props.modelValue,
			field: f,
		});
	return !!f.disabled;
}

function isFieldReadonly(f: CFormSchemaField) {
	const global = props.schema.readonly;
	const local =
		typeof f.readonly === "function"
			? f.readonly({
					model: props.modelValue,
					values: props.modelValue,
					field: f,
			  })
			: f.readonly;
	return !!(local ?? global);
}

// 依赖字段监听（异步选项或级联）
props.schema.fields.forEach((f) => {
	if (isSlotField(f)) return;
	if (f.cascadeTo?.length) {
		f.cascadeTo.forEach((childProp) => {
			watch(
				() => fieldStates[f.prop]?.value,
				(newVal, oldVal) => {
					if (newVal === oldVal || oldVal === undefined) return;
					const childField = props.schema.fields.find(
						(ff) => ff.prop === childProp
					);
					if (childField) {
						setValue(childField.prop, undefined);
						loadAsyncOptions(childField);
					}
				}
			);
		});
	}
	if (f.asyncOptions?.dependOn?.length) {
		f.asyncOptions.dependOn.forEach((dep) => {
			watch(
				() => fieldStates[dep]?.value,
				(newVal, oldVal) => {
					if (newVal === oldVal || oldVal === undefined) return;
					if (f.clearOnDependChange) setValue(f.prop, undefined);
					loadAsyncOptions(f);
				}
			);
		});
	}
});

// 监听 visible 变化：当一个字段由可见 -> 不可见 并且配置 clearWhenHidden 则清空其值
props.schema.fields.forEach((f) => {
	if (isSlotField(f)) return;
	if (f.visible || f.clearWhenHidden) {
		watch(
			() => isFieldVisible(f),
			(visible, prev) => {
				if (prev === true && visible === false && f.clearWhenHidden) {
					setValue(f.prop, undefined);
				}
			},
			{ immediate: false }
		);
	}
});

function getOptions(field: CFormSchemaField) {
	// 若字段原生 options 是函数（动态计算），直接调用，不缓存
	if (typeof field.options === "function") {
		try {
			return (
				field.options({
					model: props.modelValue,
					values: props.modelValue,
					field,
				}) || []
			);
		} catch (e) {
			return [];
		}
	}
	return fieldOptionsStore[field.prop] || [];
}

function resolveOptionLabel(option: any) {
	if (option == null) return "";
	if (typeof option === "string" || typeof option === "number")
		return String(option);
	return (
		option.label ??
		option.text ??
		option.name ??
		option.title ??
		option.value ??
		""
	);
}

function matchOptionLabel(options: any[], value: any) {
	if (!Array.isArray(options) || !options.length) return undefined;
	const target = options.find((opt: any) => {
		const val =
			typeof opt === "object"
				? opt.value ?? opt.id ?? opt.key ?? opt.code ?? opt
				: opt;
		if (val === value) return true;
		if (typeof value === "string") {
			const label = resolveOptionLabel(opt);
			if (label === value) return true;
		}
		return false;
	});
	if (target === undefined) return undefined;
	return resolveOptionLabel(target);
}

function formatArrayValue(field: CFormSchemaField, value: any[]) {
	const options = getOptions(field);
	const labels = value
		.map((val) => {
			const label = matchOptionLabel(options, val);
			if (label !== undefined && label !== "") return label;
			if (val == null) return "";
			if (typeof val === "object") return val.label ?? val.name ?? "";
			return String(val);
		})
		.filter((label) => label !== "");
	return labels.length ? labels.join("，") : "";
}

function formatDisplayValue(field: CFormSchemaField) {
	const state = getFieldState(field.prop);
	let rawValue = state?.value;
	if (rawValue === undefined)
		rawValue = getModelValueByProp(props.modelValue, field.prop);
	const placeholder =
		(field.componentProps &&
			typeof field.componentProps === "object" &&
			(field.componentProps as any).emptyText) ||
		props.schema?.readonlyPlaceholder ||
		"-";

	if (typeof field.readonlyFormatter === "function") {
		try {
			const formatted = field.readonlyFormatter({
				value: rawValue,
				model: props.modelValue,
				field,
				options: () => getOptions(field),
			});
			if (formatted !== undefined && formatted !== null)
				return String(formatted);
		} catch (e) {}
	}

	if (rawValue === undefined || rawValue === null || rawValue === "")
		return placeholder;

	if (Array.isArray(rawValue)) {
		const label = formatArrayValue(field, rawValue);
		return label || placeholder;
	}

	const options = getOptions(field);
	const matched = matchOptionLabel(options, rawValue);
	if (matched) return matched;

	if (typeof rawValue === "object") {
		if (rawValue.label || rawValue.name || rawValue.title)
			return rawValue.label || rawValue.name || rawValue.title;
		return JSON.stringify(rawValue);
	}

	return String(rawValue);
}

async function loadAsyncOptions(field: CFormSchemaField, force = false) {
	if (!field.asyncOptions) return;
	if (field.asyncOptions.lazy && !field.asyncOptions.immediate) {
		// 懒加载：由字段点击时触发，这里直接返回（除非 force 指定刷新）
		if (!force) return;
	}
	const {
		api,
		cache,
		transform,
		labelKey = "label",
		valueKey = "value",
	} = field.asyncOptions;
	const cacheItem = asyncOptionCache[field.prop];
	const now = Date.now();
	if (!force && cache) {
		const ttl = cache === true ? 0 : cache; // true 表示 session 缓存（不判断过期）
		if (cacheItem && (ttl === 0 || now - cacheItem.ts < ttl)) {
			fieldOptionsStore[field.prop] = cacheItem.data;
			return;
		}
	}
	try {
		const dependValues: Record<string, any> = {};
		field.asyncOptions.dependOn?.forEach((d) => {
			dependValues[d] = fieldStates[d]?.value;
		});
		const raw = await api(dependValues, field);
		let list = transform ? transform(raw) : raw;
		// 标准化为 {label,value}
		if (Array.isArray(list) && list.length && typeof list[0] === "object") {
			list = list.map((it: any) => ({
				label: it[labelKey],
				value: it[valueKey],
				raw: it,
			}));
		}
		fieldOptionsStore[field.prop] = list;
		if (cache) asyncOptionCache[field.prop] = { ts: now, data: list };
	} catch (e) {
		// 失败不抛出，保持静默
	}
}

async function loadDict(field: CFormSchemaField, force = false) {
	if (!field.dict) return;
	let cfg: any =
		typeof field.dict === "string"
			? { type: field.dict, immediate: true }
			: field.dict;
	const { type, cache, labelKey, valueKey, transform, immediate = true } = cfg;
	if (!immediate && !field.options) return;
	try {
		const list = await fetchDict(type, {
			cache,
			labelKey,
			valueKey,
			transform,
		});
		if (
			force ||
			!fieldOptionsStore[field.prop] ||
			!fieldOptionsStore[field.prop].length
		)
			fieldOptionsStore[field.prop] = list;
	} catch (e) {}
}

// 初始需要 immediate 的字典 / 异步字段加载
props.schema.fields.forEach((f) => {
	if (isSlotField(f)) return;
	if (f.dict) loadDict(f);
	if (f.asyncOptions?.immediate) loadAsyncOptions(f, true);
});

// 编辑/查看场景回显：若字段已经有值，但其选项是 lazy（未立即加载），需要强制加载一次以便显示 label
props.schema.fields.forEach((f) => {
	if (isSlotField(f)) return;
	const currentVal = getModelValueByProp(props.modelValue, f.prop);
	if (currentVal !== undefined && currentVal !== null && currentVal !== "") {
		// 异步 lazy 且 immediate 为 false -> 强制拉取一次（force=true 跳过缓存）
		if (
			f.asyncOptions &&
			(f.asyncOptions.lazy || f.asyncOptions.immediate === false)
		) {
			loadAsyncOptions(f, true);
		}
		// 字典：若 dict.immediate === false 但已有值，需要加载字典项
		if (f.dict && typeof f.dict === "object" && f.dict.immediate === false) {
			loadDict(f);
		}
	}
});

// 初始：对被 showWhen/visible 判定为隐藏且设置 clearWhenHidden 的字段清空一次，适用于“编辑/详情”载入旧数据但当前条件不满足的场景
(function initialVisibilityCleanup() {
	props.schema.fields.forEach((f) => {
		if (isSlotField(f)) return;
		if (f.clearWhenHidden) {
			const visible = isFieldVisible(f);
			if (!visible) {
				setValue(f.prop, undefined);
				initialSnapshot[f.prop] = undefined; // diffSubmit 时不误判
			}
		}
	});
})();

async function refreshOptions(propsList?: string[]) {
	const targets = propsList
		? props.schema.fields.filter((f) => propsList.includes(f.prop))
		: props.schema.fields;
	for (const f of targets) {
		if (f.dict) await loadDict(f);
		if (f.asyncOptions) await loadAsyncOptions(f);
	}
}

const exposeObj: CFormExpose = {
	validate,
	validateDetail,
	getValues,
	refreshOptions,
	reset,
	clearValidate,
	setValue,
	getFieldState,
	clearCascade,
	formRef,
};
// Provide for child form items or custom components to inject if needed
provide("CFormContext", {
	setValue,
	getFieldState,
	isFieldDisabled,
	isFieldReadonly,
	clearValidate: clearFieldValidate,
});

function resolveFieldComponent(field: CFormSchemaField) {
	const compMap: Record<string, string> = {
		Input: "FieldInput",
		Number: "FieldInput",
		Textarea: "FieldTextarea",
		Scan: "FieldScan",
		DateTime: "FieldDateTime",
		Uploader: "FieldUploader",
		Dict: "FieldDict",
		Normal: "FieldNormal",
		WorkOrderSelect: "FieldWorkOrderSelect",
		DispatchPerson: "FieldDispatchPerson",
		CheckboxGroup: "FieldCheckboxGroup",
		RadioGroup: "FieldRadioGroup",
	};
	const local = compMap[field.component];
	if (local && (FieldComponents as any)[local])
		return (FieldComponents as any)[local];
	if (getFormComponent(field.component))
		return getFormComponent(field.component)?.(field, {
			setValue,
			getValue: (p: string) => getFieldState(p).value,
		});
	return null;
}

function buildFieldProps(
	field: CFormSchemaField,
	overrides?: {
		disabled?: boolean;
		readonly?: boolean;
		setValue?: (value: any) => void;
	}
) {
	const state = getFieldState(field.prop);
	// 事件回调需要访问实时 model，可在运行期附加一个非响应引用（不影响序列化）
	(field as any).model = props.modelValue;
	const disabled = overrides?.disabled ?? isFieldDisabled(field);
	const readonly = overrides?.readonly ?? isFieldReadonly(field);
	const setter = overrides?.setValue
		? overrides.setValue
		: (v: any) => {
				if (!readonly && !disabled) setValue(field.prop, v);
		  };
	return {
		field,
		state,
		disabled,
		readonly,
		setValue: setter,
		getOptions: () => getOptions(field),
		loadOptions: async (force = false) => {
			if (field.dict) await loadDict(field, force);
			if (field.asyncOptions) await loadAsyncOptions(field, force);
		},
		clearCascade: (includeSelf = false) =>
			clearCascade(field.prop, includeSelf),
	};
}

function getGroupSlotName(field: CFormSchemaField) {
	if (field.groupSlot) return field.groupSlot;
	if (field.slotName) return field.slotName;
	if (field.prop) return `group:${field.prop}`;
	return "";
}

function getGroupTitleClass(field: CFormSchemaField) {
	const props = field.componentProps || {};
	const style = props.style || "default";

	const classes = [];

	if (style === "card") {
		classes.push("c-form-group-title--card");
	} else if (style === "line") {
		classes.push("c-form-group-title--line");
	}

	return classes;
}

function getGroupTitleStyle(field: CFormSchemaField) {
	const props = field.componentProps || {};
	const customStyle = props.customStyle || {};
	const style = props.style || "default";

	const styles: Record<string, any> = { ...customStyle };

	// 卡片样式的额外配置
	if (style === "card" && props.card) {
		const cardConfig = props.card;
		if (cardConfig.background) {
			styles.background = cardConfig.background;
		}
		if (cardConfig.showBorder !== false) {
			styles.border = "1rpx solid #ebedf0";
		}
		if (cardConfig.showShadow) {
			styles.boxShadow = "0 2rpx 8rpx rgba(0, 0, 0, 0.06)";
		}
	}

	return styles;
}

// 安全返回/重置：避免在某些非页面容器 (H5 内嵌或特殊场景) 下 uni.navigateBack 未注入导致报错
function handleResetClick() {
	if (props.schema.resetBehavior === "back") {
		try {
			// @ts-ignore
			if (typeof uni?.navigateBack === "function") {
				// @ts-ignore
				uni.navigateBack();
				return;
			}
		} catch (e) {}
		// fallback：若无 navigateBack，则触发一个自定义事件或直接不操作
		// 这里可以加 emits('back') 若后续需要外层监听
		return;
	}
	reset();
}

// Expose
// @ts-ignore
defineExpose(exposeObj);
</script>

<template>
	<view class="c-form-wrapper">
		<sar-form
			ref="formRef"
			class="c-form"
			:model="modelValue"
			:rules="rules"
			:label-width="schema.labelWidth || '240rpx'"
			:layout="schema.layout || 'vertical'"
			:scroll-to-first-error="schema.scrollToFirstError !== false"
			:scroll-into-view-options="schema.scrollIntoViewOptions"
		>
			<!-- 自定义主体插槽 -->
			<template v-if="hasBodySlot">
				<slot name="body" :fields="schema.fields" :model="modelValue" />
			</template>
			<template v-else>
				<template
					v-for="(field, index) in schema.fields"
					:key="field.prop || field.slotName || index"
				>
					<template v-if="isSlotField(field) && isFieldVisible(field)">
						<sar-form-item
							v-if="shouldWrapSlotField(field)"
							:id="'cform-item-' + (field.prop || field.slotName || index)"
							:name="resolveFieldName(field)"
							:label="field.label"
							:required="field.required"
							:error="
								schema.errorDisplay === 'inline'
									? getInlineError(field.prop || '')
									: ''
							"
							class="c-form-item-wrapper c-form-item-wrapper--slot"
						>
							<slot
								v-if="field.slotName && slots[field.slotName]"
								:name="field.slotName"
								:field="field"
								:model="modelValue"
								:set-value="setValue"
							/>
							<view v-if="field.help" class="c-form-item__help">
								{{ field.help }}
							</view>
						</sar-form-item>
						<view v-else class="c-form-slot">
							<slot
								v-if="field.slotName && slots[field.slotName]"
								:name="field.slotName"
								:field="field"
								:model="modelValue"
								:set-value="setValue"
							/>
							<view v-if="field.help" class="c-form-item__help">
								{{ field.help }}
							</view>
						</view>
					</template>
					<!-- 分组标题 -->
					<view
						v-else-if="
							field.component === 'GroupTitle' && isFieldVisible(field)
						"
						:class="['c-form-group-title', getGroupTitleClass(field)]"
						:style="getGroupTitleStyle(field)"
					>
						<view class="c-form-group-title__label">
							<text class="c-form-group-title__text">{{
								field.groupTitle || field.label
							}}</text>
						</view>
						<view
							v-if="getGroupSlotName(field) && slots[getGroupSlotName(field)]"
							class="c-form-group-title__actions"
						>
							<slot
								:name="getGroupSlotName(field)"
								:field="field"
								:model="modelValue"
							/>
						</view>
					</view>
					<sar-form-item
						v-else-if="isFieldVisible(field)"
						:id="'cform-item-' + field.prop"
						:name="resolveFieldName(field)"
						:label="field.label"
						:required="field.required"
						:error="
							schema.errorDisplay === 'inline'
								? getInlineError(field.prop || '')
								: ''
						"
						class="c-form-item-wrapper"
					>
						<template v-if="!isFieldReadonly(field)">
							<component
								:is="resolveFieldComponent(field)"
								v-if="resolveFieldComponent(field)"
								v-bind="buildFieldProps(field)"
							/>
							<view v-else class="c-form-unknown">{{ field.component }}</view>
						</template>
						<template v-else>
							<component
								v-if="
									field.component === 'Uploader' && resolveFieldComponent(field)
								"
								:is="resolveFieldComponent(field)"
								v-bind="
									buildFieldProps(field, {
										readonly: true,
										disabled: true,
									})
								"
							/>
							<view v-else class="c-form-readonly-value">{{
								formatDisplayValue(field)
							}}</view>
						</template>
						<view v-if="field.help" class="c-form-item__help">{{
							field.help
						}}</view>
					</sar-form-item>
				</template>
				<sar-form-item v-if="shouldShowActions" class="c-form__actions">
					<template v-if="hasActionsSlot">
						<slot
							name="actions"
							:submit="handleSubmit"
							:reset="handleResetClick"
							:model="modelValue"
							:validate="validate"
						/>
					</template>
					<template v-else>
						<sar-row :gap="30" v-if="schema.showReset">
							<sar-col :span="4">
								<sar-button round theme="warning" @tap="handleResetClick">{{
									schema.resetText || "返回"
								}}</sar-button>
							</sar-col>
							<sar-col :span="8">
								<sar-button round theme="primary" @tap="handleSubmit">{{
									schema.submitText || "保存"
								}}</sar-button>
							</sar-col>
						</sar-row>
						<sar-row v-if="!schema.showReset">
							<sar-col :span="24">
								<sar-button round theme="primary" @tap="handleSubmit">{{
									schema.submitText || "保存"
								}}</sar-button>
							</sar-col>
						</sar-row>
					</template>
				</sar-form-item>
			</template>
		</sar-form>
	</view>
</template>

<style scoped>
.c-form-wrapper {
	min-height: 100vh;
	box-sizing: border-box;
	background: var(--app-page-bg, #fff);
	padding-bottom: env(safe-area-inset-bottom, 0px);
}
.c-form {
	/* 统一表单内边距 */
	padding: 16rpx 24rpx 60rpx;
}
.c-form-group-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 40rpx 0 20rpx;
	padding: 8rpx 0; /* 去除左右背景块感，仅保留垂直留白 */
	background: transparent; /* 去除背景，避免与父容器形成小尖角 */
	border-radius: 0;
}
.c-form-group-title:first-child {
	margin-top: 0;
}
.c-form-group-title::before {
	content: "";
	display: inline-block;
	width: 8rpx;
	height: 34rpx;
	background: linear-gradient(180deg, #2d8cf0, #1a73e8);
	border-radius: 4rpx;
	margin-right: 16rpx;
}
/* 卡片样式分组 */
.c-form-group-title--card {
	padding: 24rpx 32rpx;
	margin: 24rpx 0 16rpx;
	background: #f7f8fa;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}
.c-form-group-title--card::before {
	display: none; /* 卡片样式不显示左侧竖线 */
}
.c-form-group-title--card .c-form-group-title__text {
	font-size: 32rpx;
	font-weight: 700;
}
/* 线条样式分组 */
.c-form-group-title--line {
	padding: 16rpx 0;
	margin: 32rpx 0 16rpx;
	border-bottom: 2rpx solid #ebedf0;
}
.c-form-group-title--line::before {
	display: none;
}
.c-form-group-title__label {
	display: flex;
	align-items: center;
	gap: 16rpx;
	width: 100%;
}
.c-form-group-title__text {
	font-size: 28rpx;
	font-weight: 600;
	line-height: 34rpx;
	color: #222;
}
.c-form-group-title__actions {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-left: 24rpx;
}
</style>
