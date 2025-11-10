<template>
	<!-- 全新 CCard：极简结构 + 高级样式分层 -->
	<view
		:class="['c-card', `c-card--${variant}`, { 'is-clickable': clickable }]"
		@tap="handleRootInteraction"
		@click="handleRootInteraction"
	>
		<!-- Header -->
		<div v-if="showHeader" class="c-card__header">
			<div class="c-card__header-left">
				<div v-if="icon" class="c-card__icon">
					<slot name="icon"
						><text class="c-card__icon-text">{{ icon }}</text></slot
					>
				</div>
				<div class="c-card__titles">
					<div
						v-if="title"
						class="c-card__title"
						:class="{ 'is-clamp': titleClamp > 0 }"
						:style="titleClampStyle"
					>
						{{ title }}
					</div>
					<div v-if="subtitle" class="c-card__subtitle">{{ subtitle }}</div>
					<div v-if="tags && tags.length" class="c-card__tags">
						<span
							v-for="(t, i) in tags"
							:key="i"
							class="c-card__tag"
							:data-type="t.type"
							>{{ t.text }}</span
						>
					</div>
				</div>
			</div>
			<div v-if="extra" class="c-card__extra">
				<slot name="extra">{{ extra }}</slot>
			</div>
		</div>

		<!-- Body -->
		<div v-if="hasBody" class="c-card__body">
			<template v-if="hasContent">
				<div
					ref="contentRef"
					class="c-card__content"
					:class="{ 'is-clamp': shouldClamp }"
					:style="contentStyle"
				>
					<slot>
						<text v-if="content" class="c-card__text">{{ content }}</text>
					</slot>
				</div>
			</template>

			<div v-if="hasLines" class="c-card__lines">
				<div
					v-for="(line, idx) in visibleLines"
					:key="idx"
					class="c-card__line"
				>
					<span class="c-card__line-label">{{ line?.label ?? "" }}</span>
					<template v-if="line?.type === 'image-list'">
						<div class="c-card__line-images">
							<span v-if="line?.value" class="c-card__line-value is-caption">{{
								formatLineValue(line?.value)
							}}</span>
							<div class="c-card__line-images-list">
								<image
									v-for="(img, imgIdx) in extractLineImages(line)"
									:key="img.id ?? img.src ?? imgIdx"
									class="c-card__line-image"
									mode="aspectFill"
									:src="img.src"
									@tap.stop="handleLineImageClick(line, imgIdx, $event)"
									@click.stop="handleLineImageClick(line, imgIdx, $event)"
								/>
							</div>
						</div>
					</template>
					<span
						v-else
						:class="['c-card__line-value', line?.className]"
						:data-state="line?.state ? line.state : null"
						:style="line?.style || undefined"
						>{{ formatLineValue(line?.value) }}</span
					>
				</div>
			</div>

			<div v-if="hasMedia" class="c-card__media">
				<div
					v-for="(mediaItem, mediaIndex) in props.media"
					:key="mediaItem.id ?? mediaItem.src ?? mediaIndex"
					class="c-card__media-item"
					@tap.stop="handleMediaClick(mediaItem, mediaIndex, $event)"
					@click.stop="handleMediaClick(mediaItem, mediaIndex, $event)"
				>
					<template v-if="!mediaItem.type || mediaItem.type === 'image'">
						<image
							class="c-card__media-image"
							mode="aspectFill"
							:src="mediaItem.thumbnail || mediaItem.src"
						/>
					</template>
					<slot
						v-else-if="mediaItem.type === 'custom'"
						name="media"
						:item="mediaItem"
						:index="mediaIndex"
					/>
					<video
						v-else-if="mediaItem.type === 'video'"
						class="c-card__media-video"
						:src="mediaItem.src"
						controls
					/>
				</div>
			</div>
			<span
				v-if="showMoreButton"
				class="c-card__more"
				@click.stop="toggleExpand"
			>
				{{ expanded ? "收起" : "查看更多" }}
			</span>
		</div>

		<!-- Footer / Actions -->
		<div v-if="hasActions" class="c-card__footer">
			<slot name="actions" v-if="$slots.actions" />
			<template v-else>
				<!-- 按钮组：可自定义 slot 或通过 actions prop 传入 -->

				<div
					v-for="(btn, idx) in actions"
					:key="btn.code ?? idx"
					class="c-card__action-col"
				>
					<sar-button
						inline
						size="small"
						:theme="btn.type || 'default'"
						:disabled="btn.disabled"
						@tap.stop="onAction(btn, idx, $event)"
						@click.stop="onAction(btn, idx, $event)"
					>
						<text v-if="btn.icon" class="c-card__action-icon">{{
							btn.icon
						}}</text>
						{{ btn.name }}
					</sar-button>
				</div> 
			</template>
		</div>
	</view>
</template>
<script setup lang="ts">
// @ts-nocheck  (初始重构阶段，后续可加 d.ts)
import {
	computed,
	getCurrentInstance,
	onMounted,
	onBeforeUnmount,
	onUpdated,
	nextTick,
	ref,
	useSlots,
} from "vue";
import { ensurePicturePreviewUrl } from "@/utils/picture";
import { minioBaseUrl } from "@/config";

const runtimeMinioBase = (() => {
	try {
		return (import.meta as any)?.env?.VITE_MINIO_BASE;
	} catch (_) {
		return undefined;
	}
})();

const MINIO_BASE =
	(runtimeMinioBase ??
		(typeof process !== "undefined" ? (process.env as any)?.VITE_MINIO_BASE : undefined) ??
		minioBaseUrl ??
		"") as string;

function ensureMinioPreviewUrl(value: any): string {
	const ensured = ensurePicturePreviewUrl(value);
	const ensuredStr = typeof ensured === "string" ? ensured.trim() : "";
	if (ensuredStr && ensuredStr !== value) return ensuredStr;
	const raw =
		typeof value === "string"
			? value
			: value && typeof value === "object"
			? value.src || value.url || value.path || ""
			: String(value ?? "");
	const trimmed = String(raw).trim();
	if (!trimmed) return "";
	if (/^(?:data:|blob:|file:|wxfile:|https?:|wss?:|ftp:)/i.test(trimmed)) return trimmed;
	if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
	const base = typeof MINIO_BASE === "string" ? MINIO_BASE.replace(/\/+$/, "") : "";
	if (!base) return trimmed;
	const path = trimmed.startsWith("/") ? trimmed : `/${trimmed.replace(/^\/+/, "")}`;
	return `${base}${path}`;
}

interface CardAction {
	name: string;
	code?: string | number;
	type?: string;
	disabled?: boolean;
	icon?: string;
}

interface CardTag {
	text: string;
	type?: string;
}

interface CardLine {
	label?: string;
	value?: unknown;
	state?: string;
	className?: string;
	style?: any;
	collapsible?: boolean;
	type?: "text" | "image-list" | string;
	images?: Array<
		| string
		| {
				src: string;
				thumbnail?: string;
				id?: string | number;
		  }
	>;
}

interface CardMedia {
	type?: "image" | "video" | "custom";
	src: string;
	thumbnail?: string;
	previewUrls?: string[];
	id?: string | number;
	onTap?: (payload: { item: CardMedia; index: number; ev?: any }) => void;
}

const props = withDefaults(
	defineProps<{
		title?: string;
		subtitle?: string;
		extra?: string;
		icon?: string;
		variant?: "plain" | "elevated" | "outline" | "soft";
		tags?: CardTag[];
		actions?: CardAction[];
		content?: string;
		lineClamp?: number; // body 文本行数裁剪（仅默认 slot 无自定义时有效）
		titleClamp?: number; // 标题裁剪行数
		clickable?: boolean;
		lines?: CardLine[];
		media?: CardMedia[];
		mediaPreview?: boolean;
	}>(),
	{
		title: "",
		subtitle: "",
		extra: "",
		icon: "",
		variant: "plain",
		tags: () => [],
		actions: () => [],
		content: "",
		lineClamp: 0,
		titleClamp: 0,
		clickable: false,
		lines: () => [],
		media: () => [],
		mediaPreview: true,
	}
);

const emit = defineEmits<{
	(e: "click"): void;
	(
		e: "action",
		payload: {
			item: CardAction;
			index: number;
			code?: string | number;
			ev: any;
		}
	): void;
}>();

let suppressRootClick = false;
let suppressResetTimer: any = null;
let lastRootEventTs = 0;

const showHeader = computed(
	() =>
		!!(
			props.icon ||
			props.title ||
			props.subtitle ||
			props.extra ||
			(props.tags && props.tags.length)
		)
);

const slots = useSlots();
const hasDefaultSlot = computed(() => !!slots?.default);
const hasContent = computed(() => !!(props.content || hasDefaultSlot.value));
const hasLines = computed(
	() => Array.isArray(props.lines) && props.lines.length > 0
);
const hasMedia = computed(
	() => Array.isArray(props.media) && props.media.length > 0
);
const hasBody = computed(
	() => hasContent.value || hasLines.value || hasMedia.value
);

const expanded = ref(false);

const hasCollapsibleLines = computed(
	() => hasLines.value && props.lines.some((line) => line?.collapsible)
);

const visibleLines = computed(() => {
	const lines = props.lines ?? [];
	if (!hasCollapsibleLines.value || expanded.value) return lines;
	const staticLines = lines.filter((line) => !line?.collapsible);
	return staticLines.length ? staticLines : lines.slice(0, 1);
});

const hasActions = computed(
	() => (props.actions && props.actions.length > 0) || !!slots?.actions
);

// 修复 "查看更多" 按钮的显示逻辑，确保仅在内容被截断时显示
const contentRef = ref<HTMLElement | null>(null);
const isContentClamped = ref(false);
const shouldClamp = computed(() => props.lineClamp > 0 && !expanded.value);
const lineHeight = ref(0);
const contentStyle = computed(() => {
	if (!shouldClamp.value) return {};
	const style: Record<string, string | number> = {
		WebkitLineClamp: props.lineClamp,
	};
	if (lineHeight.value > 0) {
		style.maxHeight = `${lineHeight.value * props.lineClamp}px`;
	}
	return style;
});
let resizeObserver: ResizeObserver | null = null;

const showMoreButton = computed(
	() =>
		(props.lineClamp > 0 && isContentClamped.value) || hasCollapsibleLines.value
);

onMounted(() => {
	nextTick(() => {
		updateClampState();
		if (typeof ResizeObserver !== "undefined" && contentRef.value) {
			resizeObserver = new ResizeObserver(() => {
				if (!expanded.value) updateClampState();
			});
			resizeObserver.observe(contentRef.value);
		}
	});
});

onUpdated(() => {
	if (!expanded.value) updateClampState();
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
});

function updateClampState() {
	if (!hasContent.value || !contentRef.value || props.lineClamp <= 0) {
		isContentClamped.value = false;
		return;
	}

	updateLineHeight();

	const el = contentRef.value;
	const fullHeight = el.scrollHeight;
	const clampHeight =
		lineHeight.value > 0 ? lineHeight.value * props.lineClamp : el.clientHeight;
	isContentClamped.value = fullHeight - clampHeight > 1;
}

function updateLineHeight() {
	if (!contentRef.value || typeof window === "undefined") return;
	const style = window.getComputedStyle(contentRef.value);
	let lh = parseFloat(style.lineHeight);
	if (Number.isNaN(lh) || !lh) {
		const fontSize = parseFloat(style.fontSize);
		lh = Number.isNaN(fontSize) || !fontSize ? 18 : fontSize * 1.4;
	}
	lineHeight.value = lh;
}

function toggleExpand() {
	expanded.value = !expanded.value;
	if (!expanded.value) {
		nextTick(() => updateClampState());
	}
}

function formatLineValue(value: CardLine["value"]) {
	if (value === null || value === undefined) return "";
	if (Array.isArray(value)) {
		return value
			.filter((item) => item !== null && item !== undefined && item !== "")
			.map((item) => String(item))
			.join(" / ");
	}
	if (typeof value === "object") {
		try {
			return JSON.stringify(value);
		} catch (err) {
			return String(value);
		}
	}
	return String(value);
}

const titleClampStyle = computed(() =>
	props.titleClamp > 0 ? { WebkitLineClamp: props.titleClamp } : {}
);

function extractLineImages(line?: CardLine | null) {
	if (!line)
		return [] as Array<{
			src: string;
			thumbnail?: string;
			id?: string | number;
		}>;

	let source: any[] = [];
	if (Array.isArray(line.images)) {
		source = line.images;
	} else if (typeof line.images === "string") {
		source = line.images
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	} else if (Array.isArray(line.value)) {
		source = line.value;
	}

	const result: Array<{
		src: string;
		thumbnail?: string;
		id?: string | number;
	}> = [];
	for (const item of source) {
		if (!item) continue;
		if (typeof item === "string") {
			const src = ensureMinioPreviewUrl(item);
			if (!src) continue;
			result.push({ src, id: item });
			continue;
		}
		const rawSrc =
			(item as any)?.src ?? (item as any)?.url ?? (item as any)?.path;
		const src = ensureMinioPreviewUrl(rawSrc);
		if (!src) continue;
		const rawThumb = (item as any)?.thumbnail ?? (item as any)?.thumb;
		const thumbnail = rawThumb ? ensureMinioPreviewUrl(rawThumb) : undefined;
		result.push({
			src,
			thumbnail,
			id: (item as any)?.id ?? (item as any)?.key ?? src,
		});
	}
	return result;
}

function handleLineImageClick(line: CardLine, index: number, ev?: any) {
	stopEvent(ev);
	const images = extractLineImages(line);
	
	if (!images.length) return;
	const urls = images.map((item) => item.src).filter(Boolean);
	if (!urls.length) return;
	const current = urls[index] ?? urls[0];
	if (typeof uni !== "undefined" && typeof uni.previewImage === "function") {
		uni.previewImage({ urls, current });
		return;
	}
	if (typeof window !== "undefined" && current) {
		window.open(current, "_blank");
	}
}

function handleRootInteraction(ev?: any) {
	if (suppressRootClick) {
		return;
	}
	const now = Date.now();
	if (ev?.type === "click" && now - lastRootEventTs < 100) return;
	lastRootEventTs = now;
	if (props.clickable) {
		emit("click");
		return;
	}
	// 兜底：如果用户绑定了 @click 但忘了加 clickable，则在开发环境仍触发并给出提示
	if (import.meta.env.DEV) {
		const ins = getCurrentInstance();
		const hasListener = !!ins?.vnode?.props?.onClick;
		if (hasListener) {
			console.warn(
				"[CCard] 检测到使用 @click 但未设置 clickable。已临时放行，建议加上 :clickable=true 以获得正确的可点击样式。"
			);
			emit("click");
		}
	}
}

function onAction(item: CardAction, index: number, ev: any) {
	suppressRootClick = true;
	stopEvent(ev);
	emit("action", { item, index, code: item.code, ev });
	if (suppressResetTimer) clearTimeout(suppressResetTimer);
	suppressResetTimer = setTimeout(() => {
		suppressRootClick = false;
		suppressResetTimer = null;
	}, 180);
}

function handleMediaClick(item: CardMedia, index: number, ev?: any) {
	if (!item) return;
	if (item.onTap) {
		try {
			item.onTap({ item, index, ev });
		} catch (error) {
			if (import.meta.env.DEV) {
				console.warn("[CCard] media onTap error", error);
			}
		}
		return;
	}

	if (!props.mediaPreview) return;

	if (!item.type || item.type === "image") {
		previewImage(item, index);
	}
}

function previewImage(item: CardMedia, index: number) {
	const urls =
		Array.isArray(item?.previewUrls) && item.previewUrls.length
			? item.previewUrls
			: props.media
					.filter((media) => !media?.type || media.type === "image")
					.map((media) => media.src)
					.filter(Boolean);
	const current = item?.src;
	if (typeof uni !== "undefined" && typeof uni.previewImage === "function") {
		if (urls.length) {
			uni.previewImage({ urls, current: current || urls[index] });
		}
		return;
	}
	if (typeof window !== "undefined" && current) {
		window.open(current, "_blank");
	}
}

function stopEvent(ev: any) {
	if (!ev) return;
	try {
		if (typeof ev.stopPropagation === "function") ev.stopPropagation();
		if (typeof ev.preventDefault === "function") ev.preventDefault();
		if (ev.cancelable && typeof ev.stopImmediatePropagation === "function")
			ev.stopImmediatePropagation();
		// uni-app 某些端的事件包装在 detail 内
		if (ev.detail && typeof ev.detail === "object") {
			if (typeof ev.detail.stopPropagation === "function")
				ev.detail.stopPropagation();
			if (typeof ev.detail.preventDefault === "function")
				ev.detail.preventDefault();
		}
		if (typeof ev.mp === "object" && ev.mp) {
			if (typeof ev.mp.stopPropagation === "function") ev.mp.stopPropagation();
			if (typeof ev.mp.preventDefault === "function") ev.mp.preventDefault();
		}
	} catch {}
}

// 开发提示：移除旧 API 后可在控制台辅助定位
if (import.meta.env.DEV) {
	const legacyProps = [
		"bodyLayout",
		"rows",
		"rowsLimit",
		"text",
		"textLimit",
		"record",
		"rowFields",
		"titleField",
		"titleIcon",
		"titleCopyable",
		"gridMin",
		"gridGap",
	];
	legacyProps.forEach((p) => {
		if ((props as any)[p] !== undefined) {
			console.warn(`[CCard] prop '${p}' 已废弃，不再生效。`);
		}
	});
}
</script>
<style scoped lang="scss">
.c-card__more {
	display: block;
	color: #1e87f3;
	font-size: 13px;
	cursor: pointer;
	margin-top: 6px;
	text-align: right;
}
.c-card {
	position: relative;
	display: flex;
	flex-direction: column;
	background: #fff;
	border-radius: 10px;
	padding: 8px 14px;
	box-sizing: border-box;
	transition: box-shadow 0.2s, transform 0.2s;
	min-height: 100px;
}
.c-card.is-clickable {
	cursor: pointer;
}
.c-card.is-clickable:active {
	transform: translateY(1px);
}
.c-card--elevated {
	box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.08),
		0 2px 4px -1px rgba(0, 0, 0, 0.04);
}
.c-card--outline {
	border: 1px solid var(--card-outline-color, #d0d7de);
}
.c-card--soft {
	background: linear-gradient(180deg, #f8fafc, #f1f5f9);
}

.c-card__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 14px;
	margin-top: 6px;
}
.c-card__header-left {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	flex: 1;
}
.c-card__icon {
	width: 32px;
	height: 32px;
	border-radius: 8px;
	background: var(--card-icon-bg, #0b3d91);
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	font-size: 14px;
	flex-shrink: 0;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}
.c-card__titles {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.c-card__title {
	font-size: 15px;
	font-weight: 600;
	color: #1f2937;
	line-height: 1.3;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.c-card__subtitle {
	font-size: 12px;
	color: #64748b;
	line-height: 1.2;
}
.c-card__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}
.c-card__tag {
	font-size: 11px;
	padding: 2px 6px;
	border-radius: 999px;
	background: var(--tag-bg, #eef2f7);
	color: #475569;
	line-height: 1;
	border: 1px solid rgba(0, 0, 0, 0.05);
}
.c-card__tag[data-type="primary"] {
	background: #e0edff;
	color: #0b3d91;
}
.c-card__tag[data-type="info"] {
	background: #f1f5f9;
	color: #475569;
}
.c-card__tag[data-type="danger"] {
	background: #fee2e2;
	color: #b91c1c;
}
.c-card__extra {
	font-size: 11px;
	color: #6b7280;
	white-space: nowrap;
}

.c-card__body {
	font-size: 13px;
	color: #374151;
	line-height: 1.5;
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.c-card__lines {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.c-card__line {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	color: #111827;
}
.c-card__lines > .c-card__line {
	border-bottom: 1px dashed #ebedf0;
	padding: 6px 0;
}
.c-card__line-label {
	width: 100px;
	color: #303133;
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.c-card__line-value {
	flex: 1;
	color: #1f2326;
	font-size: 13px;
	line-height: 1.4;
	word-break: break-all;
}

.c-card__line-value.is-caption {
	font-size: 12px;
	color: #9ca3af;
	text-align: right;
}

.c-card__line-images {
	flex: 1;
	display: flex;
	flex-wrap: wrap;
	// flex-direction: column;
	// align-items: flex-end;
	gap: 4px;
}

.c-card__line-images-list {
	display: flex;
	flex-wrap: wrap;
	// justify-content: flex-end;
	gap: 4px;
}

.c-card__line-image {
	width: 68px;
	height: 68px;
	border-radius: 8px;
	overflow: hidden;
	background: #f3f4f6;
	display: block;
	object-fit: cover;
}

.c-card__line-value[data-state] {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	width: fit-content;
	min-height: 22px;
	padding: 2px 8px;
	border-radius: 999px;
	font-weight: 600;
	border: 1px solid rgba(17, 24, 39, 0.1);
	flex: initial !important;
}

.c-card__line-value[data-state="pending"] {
	background: #fef3c7;
	color: #b45309;
	border-color: rgba(180, 83, 9, 0.25);
}

.c-card__line-value[data-state="processing"] {
	background: #e0f2fe;
	color: #0369a1;
	border-color: rgba(3, 105, 161, 0.25);
}

.c-card__line-value[data-state="warning"] {
	background: #fde68a;
	color: #92400e;
	border-color: rgba(146, 64, 14, 0.25);
}

.c-card__line-value[data-state="success"] {
	background: #dcfce7;
	color: #15803d;
	border-color: rgba(21, 128, 61, 0.25);
}
.c-card__line-value[data-state="done"] {
	background: #dcfce7;
	color: #15803d;
	border-color: rgba(21, 128, 61, 0.25);
}
 .c-card__line-value[data-state="cancel"] {
	background: #e5e7eb;
	color: #4b5563;
	border-color: rgba(75, 85, 99, 0.25);
}
.c-card__line-value[data-state="fail"] {
	background: #fee2e2;
	color: #b91c1c;
	border-color: rgba(185, 28, 28, 0.25);
}

.c-card__media {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	margin-top: 10px;
}

.c-card__media-item {
	position: relative;
	width: 88px;
	height: 88px;
	border-radius: 8px;
	overflow: hidden;
	background: #f2f4f7;
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.c-card__media-item:active {
	transform: scale(0.98);
	transition: transform 0.15s ease;
}

.c-card__media-image,
.c-card__media-video {
	width: 100%;
	height: 100%;
	display: block;
	object-fit: cover;
}

.c-card__content {
	display: block;
	overflow: visible;
}

.c-card__content.is-clamp {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.c-card__text {
	white-space: pre-wrap;
	word-break: break-word;
}

.c-card__footer {
	width: 100%;
	margin-top: 12px;
	display: flex;
	justify-content: flex-end;
	margin-bottom: 12px;
}
.c-card__action-row {
	width: 100%;
}
.c-card__action-col {
	margin-left: 20px;
}
.c-card__action-icon {
	margin-right: 2px;
}

/* clamp 支持 */
.c-card__title.is-clamp {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

/* 交互细节 */
.c-card:hover.c-card--elevated {
	box-shadow: 0 6px 18px -3px rgba(0, 0, 0, 0.12);
}
</style>
