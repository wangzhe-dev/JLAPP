<script setup lang="ts">
// @ts-nocheck
// 加工单选择字段组件 (使用 sar-popout-input)
import { computed, ref, inject } from "vue";
import { pickWorkOrder } from "@/utils/picker";
import { PAGE_LAYOUT_SCROLL_MANAGER } from "@/components/c-page-layout/tokens";
const props = defineProps({
	field: Object,
	state: Object,
	disabled: Boolean,
	readonly: Boolean,
	setValue: Function,
});
const formCtx: any = inject("CFormContext", null);
const scrollManager: any = inject(PAGE_LAYOUT_SCROLL_MANAGER, null);
const WORK_ORDER_FIELDS = [
	"workOrder",
	"processCode",
	"processName",
	"batchNumber",
	"materialsCode",
	"materialsName",
	"projectNumber",
	"segmentNumber",
	"specifications",
	"equipId",
	"equipName",
];
const WORK_ORDER_VALUE_KEYS = [
	"workOrder",
	"workOrderNo",
	"workOrderCode",
	"taskNumber",
	"orderNo",
	"number",
	"code",
	"id",
];
const WORK_ORDER_PICK_SOURCE_KEY = "WORK_ORDER_PICK_SOURCE";

function extractWorkOrderValue(record: any): string {
	if (!record || typeof record !== "object") return "";
	for (const key of WORK_ORDER_VALUE_KEYS) {
		const raw = record[key];
		if (raw !== undefined && raw !== null && raw !== "") return String(raw);
	}
	return "";
}

// 未来如果需要预加载可在此设置 loading
const loading = ref(false);

async function handleClick() {
	if (props.disabled || props.readonly || loading.value) return;
	const current = props.state?.value;
	const scrollSnapshot =
		typeof scrollManager?.capture === "function"
			? scrollManager.capture()
			: undefined;
	loading.value = true;
	let flagSet = false;
	try {
		try {
			uni.setStorageSync(WORK_ORDER_PICK_SOURCE_KEY, {
				ts: Date.now(),
			});
			flagSet = true;
		} catch {}
		const multiple = (props.field as any)?.multiple === true;
		const res = await pickWorkOrder({ initial: current, multiple });
		if (res) {
			const model = (props.field as any)?.model || {};
			const listProp =
				(props.field as any)?.listProp ||
				((props.field as any)?.prop
					? (props.field as any).prop + "List"
					: "workOrderList");
			if (Array.isArray(res)) {
				model[listProp] = res;
				const joined = res
					.map((r) => extractWorkOrderValue(r))
					.filter(Boolean)
					.join(",");
				if (joined) props.setValue?.(joined);
				else props.setValue?.("");
				if (res.length) handlePicked(res[0]);
			} else {
				model[listProp] = [res];
				handlePicked(res);
			}
		} else {
			try {
				uni.removeStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
			} catch {}
		}
	} catch (err) {
		if (flagSet) {
			try {
				uni.removeStorageSync(WORK_ORDER_PICK_SOURCE_KEY);
			} catch {}
		}
		console.warn("[FieldWorkOrderSelect] pickWorkOrder failed", err);
	} finally {
		if (typeof scrollManager?.restore === "function") {
			if (typeof scrollSnapshot === "number") {
				scrollManager.restore({ top: scrollSnapshot });
			} else {
				scrollManager.restore();
			}
		}
		loading.value = false;
	}
}

function handleClear() {
	props.setValue?.(null);
	const model = (props.field as any)?.model || {};
	const listProp =
		(props.field as any)?.listProp ||
		((props.field as any)?.prop
			? (props.field as any).prop + "List"
			: "workOrderList");
	model[listProp] = [];
	WORK_ORDER_FIELDS.forEach((k) => {
		if (k === "workOrder") return;
		setLinkedField(k, "");
	});
}

const display = computed(() => {
	const v = props.state?.value;
	if (!v) return "";
	const multiple = (props.field as any)?.multiple === true;
	if (!multiple) return v;
	return String(v).length > 40 ? String(v).slice(0, 40) + "…" : v;
});

function setLinkedField(prop: string, value: any) {
	const model = (props.field as any)?.model || {};
	if (formCtx?.setValue) {
		formCtx.setValue(prop, value ?? "");
	} else {
		model[prop] = value ?? "";
	}
}

function handlePicked(data: any) {
	if (!data) return;
	const workOrderValue = extractWorkOrderValue(data);
	if (workOrderValue) props.setValue?.(workOrderValue);
	else props.setValue?.("");
	const hasOwn = Object.prototype.hasOwnProperty;
	WORK_ORDER_FIELDS.forEach((field) => {
		if (field === "workOrder") return;
		if (hasOwn.call(data, field)) setLinkedField(field, data[field] ?? "");
		else setLinkedField(field, "");
	});
}
</script>
<template>
  <sar-popout-input
    :model-value="display"
    :placeholder="loading ? '加载中...' : (props.field.placeholder || '请选择')"
    clearable
    :readonly="props.readonly"
    :disabled="props.disabled || loading"
    @click="handleClick"
    @tap="handleClick"
    @clear="handleClear"
  />
</template>
<style scoped>
/* 自定义补充样式（如需） */
.sar-popout-input { cursor: pointer; }
</style>
