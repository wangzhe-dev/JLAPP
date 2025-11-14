<script lang="ts" setup>
import { ref, reactive, watch, provide, useSlots, computed } from "vue";
import * as FieldComponents from "./fields";
import { resolvePresets } from "./presets";
import { getFormComponent } from "./registry";
import {
	splitPropPath,
	getModelValueByProp,
	setModelValueByProp,
	resolveFieldName,
} from "./utils/fieldHelpers";
import { useFormState } from "./core/useFormState";
import { useFormValidation } from "./core/useFormValidation";
import { useFormWatch } from "./core/useFormWatch";
import { useFormOptions } from "./core/useFormOptions";
import type {
	CFormSchema,
	CFormSchemaField,
	CFormExpose,
	InternalFieldState,
	OptionItem,
	FormRefType,
	CFormRule,
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

// 模型更新触发函数
function emitModel() {
	emits("update:modelValue", { ...props.modelValue });
}

// 使用状态管理Hook
const {
	fieldStates,
	fieldOptionsStore,
	initialSnapshot,
	ensureFieldState,
	getValue,
	getValues,
	setValue,
	setFieldValue,
	reset,
	hasFieldValue,
	isSlotField,
	shouldWrapSlotField,
} = useFormState(props, emits, emitModel);

const formRef = ref<FormRefType>();

// 使用验证逻辑Hook
const { validate, validateDetail, clearValidate } = useFormValidation(
	props,
	formRef,
	fieldStates,
	emits
);

// 使用选项管理Hook
const {
	asyncOptionCache,
	getOptions,
	loadAsyncOptions,
	loadDict,
	initializeOptions,
	refreshOptions,
} = useFormOptions(props, fieldStates, fieldOptionsStore, isSlotField);

const rules = ref<Record<string, CFormRule[]>>({});
const slots = useSlots();
const hasActionsSlot = computed(() => Boolean(slots.actions));
const hasBodySlot = computed(() => Boolean(slots.body));
const shouldShowActions = computed(() => {
	if (props.schema.showActions === false) return false;
	if (props.schema.readonly && !hasActionsSlot.value) return false;
	return true;
});

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

// ==== 字段配置规范化（支持 groupTitle）====
let __autoGroupSeq = 0;
props.schema.fields.forEach((f) => {
	// 类型规范化：运行时修改field配置
	const field = f as CFormSchemaField & { component?: string; prop?: string };
	if (field.groupTitle && !field.component) field.component = "GroupTitle";
	if (field.component === "GroupTitle" && !field.prop)
		field.prop = `_g_${__autoGroupSeq++}`;
	if (!field.component && field.type) {
		const mapped = typeMap[field.type.toLowerCase?.()] || typeMap[field.type];
		if (mapped) field.component = mapped;
	}
	if (field.dict && !field.component) field.component = "Dict";
});

// errorBanner 逻辑已移除：统一使用内置校验滚动与用户自定义 errorDisplay 方式
function getInlineError(_prop: string) {
	return ""; // 保留占位，若后续需要自定义 inline 错误可在此扩展
}

function buildRules() {
	const out: Record<string, CFormRule[]> = {};
	props.schema.fields.forEach((f) => {
		if (f.component === "GroupTitle" || isSlotField(f)) return; // 跳过标题及插槽字段
		const arr: CFormRule[] = [];
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

function clearFieldValidate(prop?: string) {
	if (!prop) {
		clearValidate();
		return;
	}
	clearValidate([prop]);
}

function getFieldState(prop: string) {
	return fieldStates[prop] || ensureFieldState(prop);
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
			const expect = f.showWhen[key];
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

function resolveOptionLabel(option: OptionItem | string | number | null | undefined): string {
	if (option == null) return "";
	if (typeof option === "string" || typeof option === "number")
		return String(option);
	// OptionItem或任意对象
	const opt = option as Record<string, any>;
	return (
		opt.label ??
		opt.text ??
		opt.name ??
		opt.title ??
		opt.value ??
		""
	);
}

function matchOptionLabel(options: (OptionItem | string | number)[], value: unknown): string | undefined {
	if (!Array.isArray(options) || !options.length) return undefined;
	const target = options.find((opt) => {
		const val =
			typeof opt === "object"
				? (opt as Record<string, any>).value ?? (opt as Record<string, any>).id ?? (opt as Record<string, any>).key ?? (opt as Record<string, any>).code ?? opt
				: opt;
		if (val === value) return true;
		if (typeof value === "string") {
			const label = resolveOptionLabel(opt as OptionItem);
			if (label === value) return true;
		}
		return false;
	});
	if (target === undefined) return undefined;
	return resolveOptionLabel(target as OptionItem);
}

function formatArrayValue(field: CFormSchemaField, value: unknown[]): string {
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
			(field.componentProps as Record<string, any>).emptyText) ||
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

// 初始化选项加载（immediate选项和编辑场景lazy选项回显）
initializeOptions();

// 初始：对被 showWhen/visible 判定为隐藏且设置 clearWhenHidden 的字段清空一次，适用于"编辑/详情"载入旧数据但当前条件不满足的场景
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

// 批量Watch设置（级联、异步选项依赖、可见性变化）
useFormWatch(
	props.schema,
	fieldStates,
	setValue,
	loadAsyncOptions,
	isFieldVisible,
	isSlotField
);

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
	if (local && (FieldComponents as Record<string, any>)[local])
		return (FieldComponents as Record<string, any>)[local];
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
		setValue?: (value: unknown) => void;
	}
) {
	const state = getFieldState(field.prop);
	// 事件回调需要访问实时 model，可在运行期附加一个非响应引用（不影响序列化）
	(field as CFormSchemaField & { model?: Record<string, any> }).model = props.modelValue;
	const disabled = overrides?.disabled ?? isFieldDisabled(field);
	const readonly = overrides?.readonly ?? isFieldReadonly(field);
	const setter = overrides?.setValue
		? overrides.setValue
		: (v: unknown) => {
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
			// uni-app全局对象，运行时可用
			if (typeof (globalThis as any).uni?.navigateBack === "function") {
				(globalThis as any).uni.navigateBack();
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
