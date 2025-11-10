<script setup lang="ts">
// @ts-nocheck
// 纯展示组件：用于在表单布局中占位显示只读文本/格式化内容
// 用法：schema 字段配置 component: 'Normal' 或 type: 'normal'
// 可选 props:
//   field.format?(value, model, field) => string | number | VNode
//   field.componentProps: { placeholder?: string; emptyText?: string; lines?: number; copyable?: boolean }
//   field.dict / options 同样可用于将值映射成 label（与 CForm formatDisplayValue 类似）

import { computed } from "vue";

const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	readonly: boolean;
	getOptions?: () => any[];
}>();

const emptyText = computed(
	() => props.field.componentProps?.emptyText || props.field.placeholder || "-",
);

function mapLabel(value: any) {
	const opts = props.getOptions?.() || [];
	if (Array.isArray(value)) {
		return value.map((v) => labelOf(v, opts)).join("，");
	}
	return labelOf(value, opts);
}
function labelOf(v: any, opts: any[]) {
	if (v === undefined || v === null || v === "") return emptyText.value;
	if (
		opts &&
		opts.length &&
		typeof opts[0] === "object" &&
		"value" in opts[0]
	) {
		const hit = opts.find((o) => o.value === v);
		if (hit) return hit.label ?? v;
	}
	return v;
}

const display = computed(() => {
	let val = props.state?.value;
	if (typeof props.field?.format === "function") {
		try {
			return props.field.format(val, (props.field as any).model, props.field);
		} catch {
			/* ignore */
		}
	}
	return mapLabel(val);
});

const textClass = computed(() => {
	return display.value === emptyText.value
		? "c-form-normal__text is-empty"
		: "c-form-normal__text";
});

function handleCopy() {
	if (!props.field?.componentProps?.copyable) return;
	try {
		const txt = String(display.value ?? "");
		// #ifdef H5
		navigator?.clipboard?.writeText?.(txt);
		// #endif
		// 其它平台统一尝试 setClipboardData
		// @ts-ignore
		uni.setClipboardData({
			data: txt,
			success: () => uni.showToast({ title: "已复制", icon: "none" }),
			fail: () => uni.showToast({ title: "复制失败", icon: "none" }),
		});
	} catch {
		uni.showToast({ title: "复制失败", icon: "none" });
	}
}
</script>

<template>
	<view class="c-form-normal">
		<view :class="textClass">{{ display }}</view>
		<view
			v-if="field.componentProps?.copyable"
			class="c-form-normal__copy"
			@tap="handleCopy"
			>复制</view
		>
	</view>
</template>

<style scoped>
.c-form-normal {
	min-height: 40rpx;
	line-height: 40rpx;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
}

.c-form-normal__text {
	font-size: 28rpx;
	color: #333;
	word-break: break-all;
}

.c-form-normal__text.is-empty {
	color: #999;
}

.c-form-normal__copy {
	margin-left: 12rpx;
	font-size: 24rpx;
	color: var(--primary-color, #ff6e26);
}
</style>
