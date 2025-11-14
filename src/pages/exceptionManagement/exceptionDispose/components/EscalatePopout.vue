<template>
	<sar-popout
		v-model:visible="visible"
		:title="title"
		:before-close="handleBeforeClose"
	>
		<view class="escalate-popout">
			<CForm
				v-if="visible"
				ref="formRef"
				v-model="formModel"
				:schema="schemaRef"
				class="escalate-popout__form"
			/>
		</view>
	</sar-popout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch } from "vue";
import { CForm } from "@/components/c-form";
import type {
	CFormExpose,
	CFormSchema,
	CFormSchemaField,
} from "@/components/c-form/types";
import { useUserStore } from "@/stores/user";
import { storeToRefs } from "pinia";
import { queryDictList } from "@/api/dict";

type BeforeCloseHandler = (
	type: "confirm" | "cancel" | "close",
	payload?: EscalateForm
) => boolean | Promise<boolean>;

const props = withDefaults(
	defineProps<{
		visible?: boolean;
		title?: string;
		recordId?: string | number | null;
		beforeClose?: BeforeCloseHandler;
	}>(),
	{
		visible: false,
		title: "异常升级",
	}
);

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
	(e: "submit", value: EscalateForm): void;
}>();

const visible = computed({
	get: () => !!props.visible,
	set: (value) => emit("update:visible", value),
});
type EscalateForm = {
	handleGroupCode: string;
	handleGroupName: string;
	handleP: string;
	handlePName: string;
	handleEdcCode: string;
	id: string;
	noticeContent: string;
	noticeType: string[];
};

const formRef = ref<CFormExpose | null>(null);
const formModel = ref<EscalateForm>(createDefaultForm());
const title = computed(() => props.title ?? "异常升级");

const userStore = useUserStore();
const { departmentTree } = storeToRefs(userStore);

if (!departmentTree.value?.length) {
	userStore.fetchDepartmentTree?.().catch(() => {});
}

const departmentOptions = computed(() =>
	flattenDepartments(departmentTree.value)
);

watch(
	departmentOptions,
	() => {
		ensureDeptFallback();
	},
	{ immediate: true, deep: true }
);

watch(
	() => visible.value,
	(value) => {
		if (value) {
			resetForm();
		}
	},
	{
		deep: true,
		immediate: true,
	}
);

function resetForm() {
	formModel.value = {
		handleGroupCode: "",
		handleGroupName: "",
		handleP: "",
		handlePName: "",
		handleEdcCode: "",
		id: props.recordId,
		noticeContent: "",
		noticeType: [],
	};
}
const resolvedDeptCode = computed(() => {
	const code = formModel.value.handleGroupCode;
	return code ? String(code).trim() : "";
});
const schemaRef = computed<CFormSchema>(() => ({
	labelWidth: "220rpx",
	layout: "vertical",
	showActions: false,
	fields: buildFields(),
}));

function buildFields(): CFormSchemaField[] {
	return [
		{
			label: "部门",
			prop: "handleGroupCode",
			component: "Dict",
			required: true,
			placeholder: "请选择升级部门",
			onChange: ({ value, model }) => {
				const option = departmentOptions.value.find(
					(opt) => opt.value === value
				);
				const name = option?.label || "";
				formModel.value.handleGroupName = name;
				formModel.value.handleGroupCode = value;
				if (Array.isArray(departmentOptions.value) && !option) {
					formModel.value.handleGroupName = "";
				}
				clearAssignedPerson();
			},
			componentProps: {
				placeholder: "请选择升级部门",
				options: () => departmentOptions.value,
			},
		},
		{
			label: "指派人员",
			prop: "handleP",
			component: "DispatchPerson",
			required: true,
			componentProps: {
				placeholder: "请选择指派人员",
				title: "选择指派人员",
				labelProp: "handlePName",
				extraMap: {
					// handlePName 已经由 labelProp 自动处理，不需要在这里重复定义
					handleEdcCode: "raw.perField1",
				},
				onError: handleDispatchError,
				multiple: false,
				requestSource: "department",
				// 使用 prop 来指定从哪里获取参数值
				departmentCodeProp: "handleGroupCode",
			},
			disabled: ({ model }) => !model.handleGroupCode,
			onChange: ({ value, prev, model }) => {
				formModel.value.handlePName = model.handlePName || "";
				formModel.value.handleEdcCode = model.handleEdcCode || "";
			},
		},

		{
			label: "通知内容",
			prop: "noticeContent",
			component: "Textarea",
			required: false,
			componentProps: {
				placeholder: "请输入通知内容",
				autosize: { minHeight: "120rpx", maxHeight: 220 },
				maxlength: 200,
			},
		},
		{
			label: "通知方式",
			prop: "noticeType",
			component: "CheckboxGroup",
			required: true,
			componentProps: () => ({
				direction: "horizontal",
				options: noticeOptions.value,
			}),
		},
	];
}

const noticeOptionsSource = ref<Array<{ label: string; value: string }>>([]);
const noticeOptions = computed(() => noticeOptionsSource.value);
const noticeLoaded = ref(false);
const noticeLoading = ref(false);

if (!noticeLoaded.value && !noticeLoading.value) {
	loadNoticeOptions();
}

async function loadNoticeOptions() {
	if (noticeLoaded.value || noticeLoading.value) return;
	noticeLoading.value = true;
	try {
		const data = await queryDictList(["notice_type"]);
		const list = Array.isArray(data?.notice_type) ? data.notice_type : [];
		noticeOptionsSource.value = list
			.map((item: any) => ({
				label: item?.dictLabel ?? item?.dictName ?? "",
				value:
					item?.dictValue !== undefined && item?.dictValue !== null
						? String(item.dictValue)
						: "",
			}))
			.filter((option) => option.label && option.value);
		noticeLoaded.value = true;
	} catch (error) {
		console.warn("[EscalatePopout] load notice options failed", error);
		uni.showToast({ title: "通知方式加载失败", icon: "none" });
	} finally {
		noticeLoading.value = false;
	}
}

function createDefaultForm(): EscalateForm {
	return {
		handleGroupCode: "",
		handleGroupName: "",
		handleP: "",
		handlePName: "",
		handleEdcCode: "",
		id: "",
		noticeContent: "",
		noticeType: [],
	};
}

function normalizeForm(raw?: any): EscalateForm {
	const base = createDefaultForm();
	if (!raw || typeof raw !== "object") return base;
	return {
		handleGroupCode: safeString(raw.handleGroupCode),
		handleGroupName: safeString(raw.handleGroupName),
		handleP: safeString(raw.handleP),
		handlePName: safeString(raw.handlePName),
		handleEdcCode: safeString(raw.handleEdcCode),
		id: safeString(raw.id),
		noticeContent: safeString(raw.noticeContent),
		noticeType: Array.isArray(raw.noticeType)
			? Array.from(
					new Set(
						raw.noticeType
							.map((item: any) => String(item))
							.filter((item) => !!item)
					)
			  )
			: [],
	};
}

function safeString(value: unknown): string {
	if (value === undefined || value === null) return "";
	return String(value);
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
		let news = JSON.parse(JSON.stringify(formModel.value));
		createDefaultForm();
		const result = await props.beforeClose({
			...news,
			id: safeString(props.recordId),
		});
		if (result === false) return false;
		return result ?? true;
	}
	return true;
}

function ensureDeptFallback() {
	const currentCode = formModel.value.handleGroupCode;
	if (!currentCode && departmentOptions.value.length === 1) {
		const option = departmentOptions.value[0];
		formModel.value.handleGroupCode = option.value;
		formModel.value.handleGroupName = option.label;
		clearAssignedPerson();
		return;
	}
	if (currentCode) {
		const option = departmentOptions.value.find(
			(opt) => opt.value === currentCode
		);
		if (option && formModel.value.handleGroupName !== option.label) {
			formModel.value.handleGroupName = option.label;
		}
	}
}

function clearAssignedPerson() {
	formModel.value.handleP = "";
	formModel.value.handlePName = "";
	formModel.value.handleEdcCode = "";
}

function handleDispatchError(error: any) {
	if (!error) return;
	const msg =
		typeof error === "string"
			? error
			: error?.msg || error?.message || "派工人员加载失败";
	if (msg) uni.showToast({ title: msg, icon: "none" });
}

function flattenDepartments(
	tree: any[]
): Array<{ label: string; value: string; raw: any }> {
	const result: Array<{ label: string; value: string; raw: any }> = [];
	if (!Array.isArray(tree) || !tree.length) return result;
	const stack: Array<{ node: any; parentCode?: string | null }> = tree.map(
		(node) => ({ node, parentCode: null })
	);
	while (stack.length) {
		const { node, parentCode } = stack.pop()!;
		if (!node || typeof node !== "object") continue;
		const code = safeString(node.costCenterCode);
		const name = safeString(node.fullName);
		if (code && name) {
			result.push({ label: name, value: code, raw: { ...node, parentCode } });
		}
		const children = node.children || node.childList || node.childrenList;
		if (Array.isArray(children) && children.length) {
			for (let i = children.length - 1; i >= 0; i--) {
				stack.push({
					node: children[i],
					parentCode: code || parentCode || null,
				});
			}
		}
	}
	return result;
}
</script>

<style scoped lang="scss">
.escalate-popout {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px 20px 24px 20px;
	box-sizing: border-box;
}

.escalate-popout__form {
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
