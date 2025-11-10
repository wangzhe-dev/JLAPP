<template>
	<!-- 极简包装：完全遵循 sard 官方 API，只增加 v-model 名称与 after-hide 事件别名 -->
	<sar-action-sheet
		v-model:visible="visibleProxy"
		:cancel="cancelTextResolved"
		:item-list="itemsResolved"
		:close-on-click-action="closeOnClickItem"
		:overlay-closable="overlayClosable"
		:safe-area-inset-bottom="safeAreaInsetBottom"
		@cancel="onCancelInternal"
		@closed="onAfterHide"
		@select="onNativeSelect"
	/>
</template>

<script setup lang="ts">
// @ts-nocheck  先保留，后续统一去除
/**
 * CQuickActionSheet (简化版)
 * 仅做最小包装：
 * - v-model:show -> v-model:visible 透传
 * - 事件：select / cancel / after-hide
 * - props 命名对齐项目习惯（items / cancelText / overlayClosable / closeOnClickItem）
 */
import { defineProps, defineEmits, computed } from "vue";

export interface ActionSheetItem {
	name: string;
	value?: string;
	icon?: string;
	color?: string;
	disabled?: boolean;
}

const props = defineProps<{
	show: boolean;
	title?: string;
	items?: ActionSheetItem[];
	cancelText?: string;
	overlayClosable?: boolean;
	closeOnClickItem?: boolean;
	safeAreaInsetBottom?: boolean;
}>();

const emit = defineEmits<{
	(e: "update:show", v: boolean): void;
	(e: "select", item: ActionSheetItem, index: number): void;
	(e: "cancel"): void;
	(e: "after-hide"): void;
}>();

const visibleProxy = computed({
	get: () => props.show,
	set: (v) => emit("update:show", v),
});
const itemsResolved = computed(() => props.items || []);
const cancelTextResolved = computed(() => props.cancelText ?? "取消");
const overlayClosable = computed(() => props.overlayClosable || true);
const closeOnClickItem = computed(() => props.closeOnClickItem !== false);
const safeAreaInsetBottom = computed(() => props.safeAreaInsetBottom !== false);
const title = computed(() => props.title || "");

function onNativeSelect(e: any) {
	const item = e?.detail?.item || e?.item || e;
	const index =
		e?.detail?.index ?? itemsResolved.value.findIndex((i) => i === item);
	emit("select", item, index);
	if (closeOnClickItem.value) emit("update:show", false);
}
function onCancelInternal() {
	emit("cancel");
	emit("update:show", false);
}
function onAfterHide() {
	emit("after-hide");
}
</script>

<style lang="scss">
/* 使用全局样式避免 teleport 时 scoped 失效（App 端需要如此处理） */
.sar-action-sheet {
	border-top-left-radius: 16px !important;
	border-top-right-radius: 16px !important;
	z-index: 9999 !important; /* 提高层级，防止被自定义导航 / TabBar 覆盖 */
}


.sar-action-sheet__cancel {
	font-weight: 600 !important;
	color: var(--color-primary, #0b3d91) !important;
}
</style>
