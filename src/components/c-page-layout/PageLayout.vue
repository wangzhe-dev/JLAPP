<template>
	<view
		class="page-layout"
		:class="{
			'is-nav-transparent': navTransparent,
			'is-nav-overlay': navOverlay,
		}"
		:style="rootStyle"
	>
		<!-- 顶部导航：简化为官方 root-style 变量方式 -->
		<sar-navbar
			v-if="!hideNav"
			:title="title"
			:show-back="showBack"
			:back-text="backText"
			:fixed="true"
			:placeholder="!navTransparent && !navOverlay"
			:safe-area-inset-top="navSafeArea"
			:border="false"
			:z-index="110"
			:background="navTransparent ? 'transparent' : navBg"
			:root-style="navbarRootStyle"
			:style="{
				background: navTransparent ? 'transparent' : navBg,
				paddingTop: navPaddingTop,
				minHeight: navMinHeight,
				'--pl-navbar-safe-top': navPaddingTop,
				'--pl-navbar-min-height': navMinHeight,
			}"
			@back="onBack"
		>
			<template #right>
				<slot name="nav-right" />
			</template>
		</sar-navbar>

		<!-- 工具栏 -->
		<view
			v-if="$slots.toolbar"
			:class="['pl-toolbar', { 'pl-toolbar--sticky': stickyToolbar }]"
		>
			<slot name="toolbar" />
		</view>

		<!-- 主体内容容器（使用页面原生滚动，支持下拉刷新 / 触底加载） -->
		<view class="pl-content" :style="contentStyle" ref="contentRef">
			<slot />
			<view v-if="safeBottom" class="pl-safe-bottom" :style="safeBottomStyle">
				<slot name="bottom" />
			</view>
		</view>

		<!-- 固定底部 Tabbar 插槽（避免随内容滚动） -->
		<view v-if="$slots.tabbar" class="pl-fixed-tabbar">
			<slot name="tabbar" />
		</view>

		<!-- 统一弹层插槽 -->
		<slot name="overlays" />
	</view>
</template>
<script setup lang="ts">
// @ts-nocheck
// 说明：uni-app + volar 在内置标签 (view/text/scroll-view) 上的类型合成会与 defineProps 交织导致
// 大量 "参数不能赋给类型 ComponentPublicInstanceConstructor" 报错。
// 为加速组件落地，先整体关闭，再分阶段：
// 1) 抽离内部计算 style 到函数返回普通对象
// 2) 增加一个 global.d.ts 声明，放宽内置标签 props 定义
// 3) 移除此行
import {
	ref,
	withDefaults,
	defineProps,
	defineEmits,
	computed,
	onMounted,
	onBeforeUnmount,
	provide,
	nextTick,
} from "vue";
import {
	PAGE_LAYOUT_CONTENT_REF,
	PAGE_LAYOUT_GO_BACK,
	PAGE_LAYOUT_SCROLL_MANAGER,
} from "./tokens";

type ScrollBehaviorMode = "auto" | "smooth";

const props = withDefaults(
	defineProps<{
		title?: string;
		showBack?: boolean;
		hideNav?: boolean;
		/** 初始透明导航（滚动后渐变为实色） */
		navTransparent?: boolean;
		/** 滚动阈值，超过后完全不透明 */
		navTransitionThreshold?: number;
		/** 滚动后文字颜色（如果需要由浅 -> 深） */
		navColorScrolled?: string; // Updated to use CSS variable
		/** 导航是否覆盖内容（不插入 placeholder） */
		navOverlay?: boolean;
		/** 顶部安全区内边距，覆盖模式且自行处理头图时可关闭 */
		navSafeArea?: boolean;
		safeBottom?: boolean;
		stickyToolbar?: boolean;
		bottomOffset?: string;
		navColor?: string;
		navBg?: string;
		/** 背景色 */
		background?: string;
		/** 内容内边距 */
		padding?: string;
		/** 是否为自定义 Tabbar 预留底部空间 */
		withTabbar?: boolean;
		tabbarReserve?: string;
		/** 返回按钮文字（传入则显示文字） */
		backText?: string;
		/** 是否自动执行 navigateBack，false 时仅触发 back 事件 */
		autoNavigateBack?: boolean;
	}>(),
	{
		title: "",
		showBack: false,
		hideNav: false,
		navTransparent: false,
		navTransitionThreshold: 120,
		navColorScrolled: "var(--app-primary, #0B3D91)",
		navOverlay: false,
		navSafeArea: true,
		safeBottom: true,
		stickyToolbar: true,
		bottomOffset: "0px",
		navColor: "#fff",
		navBg: "var(--app-primary, #0B3D91)",
		background: "#f6f8fa",
		padding: "0",
		withTabbar: false,
		tabbarReserve: "70px",
		backText: "",
		autoNavigateBack: true,
	},
);

const safeAreaTop = ref(0);
const safeAreaBottom = ref(0);

const emit = defineEmits<{
	(e: "back"): void;
}>();

const rootStyle = computed(() => `background:${props.background};`);
// 统一使用官方 root-style 变量:
// --sar-navbar-bg / --sar-navbar-item-color / --sar-navbar-title-color
const navPaddingTop = computed(() => {
	if (!props.navSafeArea) return "0px";
	if (safeAreaTop.value > 0) return `${safeAreaTop.value}px`;
	return "env(safe-area-inset-top, 0px)";
});

const navMinHeight = computed(() => {
	const base = 44;
	if (!props.navSafeArea) return `${base}px`;
	if (safeAreaTop.value > 0) {
		return `${base + safeAreaTop.value}px`;
	}
	return `calc(${base}px + env(safe-area-inset-top, 0px))`;
});

const navbarRootStyle = computed(() => {
	// 兼容 sard 可能的不同变量命名，统一都塞进去，保证主题色可控
	const bg = props.navTransparent ? "transparent" : props.navBg;
	return [
		`--sar-navbar-bg: var(--app-primary, ${bg})`,
		`--sar-navbar-background:${bg}`,
		`--sar-navbar-background-color:${bg}`,
		`--sar-navbar-item-color:${props.navColor}`,
		`--sar-navbar-title-color:${props.navColor}`,
		`--pl-navbar-bg:${bg}`,
		`--pl-navbar-color:${props.navColor}`,
	].join(";");
});
const contentStyle = computed(() => {
	const safeBottom = safeAreaBottom.value > 0
		? `${safeAreaBottom.value}px`
		: "env(safe-area-inset-bottom, 0px)";
	let paddingBottom: string;
	if (props.withTabbar) {
		paddingBottom = `calc(${props.tabbarReserve} + ${safeBottom})`;
	} else if (props.safeBottom) {
		paddingBottom = props.bottomOffset;
	} else {
		paddingBottom = safeBottom;
	}
	return `padding:${props.padding};padding-bottom:${paddingBottom};`;
});
const safeBottomStyle = computed(() => {
	const safeBottom = safeAreaBottom.value > 0
		? `${safeAreaBottom.value}px`
		: "env(safe-area-inset-bottom, 0px)";
	if (props.withTabbar) {
		return `padding-bottom:${props.bottomOffset};`;
	}
	return `height:${safeBottom};padding-bottom:${props.bottomOffset};`;
});

const contentRef = ref();
const lastScrollTop = ref(0);

function getScrollTarget(): any {
	const target = contentRef.value;
	if (!target) return null;
	const el = target.$el ?? target;
	return el || null;
}

function readScrollTop(): number {
	const el = getScrollTarget();
	if (!el) return 0;
	const top = Number(el.scrollTop ?? 0);
	return Number.isFinite(top) ? top : 0;
}

function applyScrollTop(top: number, behavior: ScrollBehaviorMode = "auto") {
	const el = getScrollTarget();
	if (!el) return;
	if (typeof el.scrollTo === "function") {
		try {
			el.scrollTo({ top, behavior });
			return;
		} catch {
			/* ignore */
		}
	}
	try {
		el.scrollTop = top;
	} catch {
		/* ignore */
	}
}

const scrollManager = {
	capture(options?: { immediate?: boolean }) {
		const top = readScrollTop();
		lastScrollTop.value = top;
		if (options?.immediate === true) {
			applyScrollTop(top);
		}
		return top;
	},
	restore(options?: {
		top?: number;
		behavior?: ScrollBehaviorMode;
		delay?: number;
		force?: boolean;
	}) {
		const targetTop =
			typeof options?.top === "number" ? options!.top : lastScrollTop.value;
		if (!options?.force && targetTop === undefined) return;
		const behavior = options?.behavior ?? "auto";
		const delay = options?.delay ?? 0;
		const exec = () => applyScrollTop(targetTop ?? 0, behavior);
		if (delay > 0) setTimeout(exec, delay);
		else nextTick(exec);
	},
	getLast() {
		return lastScrollTop.value;
	},
};

const onBack = () => {
	// 始终返回上一级：保留事件，忽略 showBack 与 autoNavigateBack 条件
	emit("back");
	uni.navigateBack({ delta: 1 });
};
function updateSafeArea() {
	try {
		const info = uni.getSystemInfoSync();
		const toNumber = (val: unknown): number => {
			const num = Number(val);
			return Number.isFinite(num) && num > 0 ? num : 0;
		};
		const safeInsets = info.safeAreaInsets || {};
		const safeArea = info.safeArea || {};
		const windowHeight = toNumber((info as any).windowHeight);
		const screenHeight = toNumber((info as any).screenHeight);
		const statusBar = toNumber(info.statusBarHeight);

		let top = toNumber((safeInsets as any).top);
		if (!top) {
			top = toNumber((safeArea as any).top);
		}
		if (!top) {
			top = statusBar;
		}

		let bottom = toNumber((safeInsets as any).bottom);
		if (!bottom && safeArea) {
			const safeBottom = toNumber((safeArea as any).bottom);
			const safeTop = toNumber((safeArea as any).top);
			if (windowHeight && safeBottom) {
				bottom = Math.max(0, windowHeight - safeBottom);
			} else if (screenHeight && safeBottom) {
				const safeHeight = toNumber((safeArea as any).height);
				if (safeHeight) {
					bottom = Math.max(0, screenHeight - safeHeight - safeTop);
				} else {
					bottom = Math.max(0, screenHeight - safeBottom);
				}
			}
		}

		safeAreaTop.value = top;
		safeAreaBottom.value = bottom;
	} catch (error) {
		console.warn('[PageLayout] updateSafeArea error:', error);
	}
}

onMounted(() => {
	updateSafeArea();

	// Listen for window resize events (including orientation changes)
	uni.onWindowResize(() => {
		updateSafeArea();
	});
});

onBeforeUnmount(() => {
	// Clean up window resize listener
	uni.offWindowResize(() => {
		updateSafeArea();
	});
});

provide(PAGE_LAYOUT_CONTENT_REF, contentRef);
provide(PAGE_LAYOUT_GO_BACK, onBack);
provide(PAGE_LAYOUT_SCROLL_MANAGER, scrollManager);

defineExpose({ contentRef });
</script>
<style scoped lang="scss">
.page-layout {
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	/* 允许页面使用原生滚动（下拉刷新、触底加载） */
	overflow-x: hidden;
}

/* 主题色兜底：非透明 / 非覆盖模式 */
:deep(.sar-navbar.is-fixed) {
	background-color: var(
		--sar-navbar-bg,
		var(--sar-navbar-background, var(--sar-navbar-background-color, #0b3d91))
	) !important;
	padding-top: var(--pl-navbar-safe-top, 0px);
	min-height: var(--pl-navbar-min-height, 44px);
	box-sizing: border-box;
}

:deep(.sar-navbar__wrapper) {
	min-height: var(--pl-navbar-min-height, 44px);
	padding-top: var(--pl-navbar-safe-top, 0px);
	box-sizing: border-box;
}

:deep(.sar-navbar__content) {
	min-height: calc(var(--pl-navbar-min-height, 44px) - var(--pl-navbar-safe-top, 0px));
	align-items: center;
	padding-inline: 16px;
	box-sizing: border-box;
}

:deep(.sar-navbar__left),
:deep(.sar-navbar__right) {
padding-top: var(--pl-navbar-safe-top, 0px);
	min-height: var(--pl-navbar-min-height, 44px);
	display: flex;
	align-items: center;
	box-sizing: border-box;
}

/* 透明模式 + 覆盖模式：完全融入下方头图 */
.is-nav-transparent.is-nav-overlay :deep(.sar-navbar.is-fixed) {
	background: transparent !important;
	box-shadow: none !important;
}

/* 仅透明但未 overlay：可能仍需要保留占位背景，可加半透明渐变（按需） */
.is-nav-transparent:not(.is-nav-overlay) :deep(.sar-navbar.is-fixed) {
	background: linear-gradient(
		to bottom,
		rgba(11, 61, 145, 0.7),
		rgba(11, 61, 145, 0.15)
	) !important;
}

.pl-nav {
	position: relative;
	display: flex;
	align-items: flex-end;
	padding: 0 12px 6px;
	box-sizing: border-box;
}

.pl-nav__left {
	width: 40px;
	height: 40px;
	display: flex;
	align-items: center;
	justify-content: flex-start;
}

.pl-back-icon {
	font-size: 26px;
	line-height: 1;
	font-weight: 500;
}

.pl-nav__title {
	font-size: 18px;
	font-weight: 600;
	flex: 1;
}

.pl-nav__right {
	margin-left: auto;
	display: flex;
	align-items: center;
}

.pl-toolbar {
	width: 100%;
}

.pl-toolbar--sticky {
	position: sticky;
	top: 0;
	z-index: 9;
}

.pl-content {
	flex: 1 1 auto;
	min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
}

.pl-fixed-tabbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 500; // 高于普通内容
}

.pl-safe-bottom {
	width: 100%;
}
</style>
