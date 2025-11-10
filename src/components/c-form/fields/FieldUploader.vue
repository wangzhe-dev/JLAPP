<script setup lang="ts">
// @ts-nocheck
import { ref, computed, watch, nextTick } from "vue";
import type { UploadFileItem } from "sard-uniapp";
import { minioBaseUrl, imgUrl, requestUrl, apiPrefix } from "@/config";
import { useUserStore } from "@/stores/user";

const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	readonly: boolean;
	setValue: (v: any) => void;
}>();
const limit = computed(
	() => props.field.limit * 1 || props.field.componentProps?.limit * 1 || 6
);
const componentProps = computed(() => props.field.componentProps || {});
const uploadProps = computed(() => {
	const { showUpload, onRemove, ...rest } = componentProps.value || {};
	return rest;
});
const disabledState = computed(() => props.disabled || props.readonly);
const userStore = useUserStore();

function normalizeUploadStatus(
	raw: any
): "pending" | "uploading" | "failed" | "done" {
	const status = typeof raw === "string" ? raw.toLowerCase() : "";
	switch (status) {
		case "uploading":
			return "uploading";
		case "failed":
		case "fail":
		case "error":
			return "failed";
		case "pending":
			return "pending";
		case "done":
		case "success":
		case "complete":
			return "done";
		default:
			return "done";
	}
}

function normalizeApiPrefix() {
	if (!apiPrefix) return "";
	return String(apiPrefix).replace(/^\/+/, "").replace(/\/+$/, "");
}

function pickFirstBase(
	...bases: Array<string | undefined | null>
): string | undefined {
	for (const base of bases) {
		if (typeof base !== "string") continue;
		const trimmed = base.trim();
		if (trimmed) return trimmed;
	}
	return undefined;
}

function getUploadBase(): string {
	const cp = componentProps.value || {};
	const explicit = pickFirstBase(cp.uploadBaseUrl);
	if (explicit) return explicit;
	const normalizedPrefix = normalizeApiPrefix();
	if (typeof import.meta !== "undefined" && normalizedPrefix) {
		return `/${normalizedPrefix}`;
	}
	return pickFirstBase(requestUrl) || "";
}

function resolveUploadUrl(raw: any): string | undefined {
	if (!raw) return undefined;
	const url = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
	if (!url) return undefined;
	if (/^(?:https?:|wss?:|ftp:|data:|blob:)/i.test(url)) return url;
	if (/^\/\//.test(url)) {
		const base = getUploadBase();
		const protocol = base.match(/^[a-z]+:/i)?.[0] || "https:";
		return `${protocol}${url}`;
	}
	const base = getUploadBase();
	if (!base) return url;
	const normalizedBase = base.replace(/\/+$/, "");
	const normalizedPath = url.replace(/^\/+/, "");
	return `${normalizedBase}/${normalizedPath}`;
}

function getUrlBase(): string {
	const cp = componentProps.value || {};
	console.log("FieldUploader getUrlBase", minioBaseUrl);
	const override = pickFirstBase(cp.urlBase, cp.baseUrl, cp.previewBaseUrl);
	if (override) return override;
	return pickFirstBase(minioBaseUrl, imgUrl, requestUrl) || "";
}

function ensureAbsoluteUrl(raw: any): string {
	if (!raw) return "";
	const url = typeof raw === "string" ? raw.trim() : "";
	if (!url) return "";
	if (/^(?:https?:|wss?:|ftp:|data:|blob:)/i.test(url)) return url;
	const base = getUrlBase();
	console.log("ensureAbsoluteUrl base", base);
	if (base) {
		const normalizedBase = base.replace(/\/+$/, "");
		if (url.startsWith(normalizedBase)) return url;
	}
	if (/^\/\//.test(url)) {
		const base = getUrlBase();

		if (!base) return `https:${url}`;
		const protocol = base.match(/^[a-z]+:/i)?.[0] || "https:";
		return `${protocol}${url}`;
	}
	if (!base) return url;
	const normalizedBase = base.replace(/\/+$/, "");
	const normalizedPath = url.replace(/^\/+/, "");
	return `${normalizedBase}/${normalizedPath}`;
}

function detectMediaFlag(url?: string, file?: { type?: string | undefined }) {
	const mediaUrl = url?.split("?")[0] || "";
	const fileType = file?.type || "";
	const IMAGE_EXT =
		/\.(?:jpg|jpeg|png|gif|svg|bmp|webp|tiff|tif|heic|heif|ico)$/i;
	const VIDEO_EXT =
		/\.(?:avi|mp4|mov|wmv|flv|mkv|mpeg|mpg|3gp|webm|swf|rmvb|vob|ts|mts|m2ts|divx|asf|ogv|f4v)$/i;
	const isImage =
		fileType === "image" || (!!mediaUrl && IMAGE_EXT.test(mediaUrl));
	const isVideo =
		(!isImage && fileType === "video") ||
		(!!mediaUrl && VIDEO_EXT.test(mediaUrl));
	return { isImage, isVideo };
}

function normalizeList(raw: any): UploadFileItem[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((item, index) => {
		if (typeof item === "string") {
			const absoluteUrl = ensureAbsoluteUrl(item);
			return {
				url: absoluteUrl,
				name: item.split("/").pop() || `文件${index + 1}`,
				status: "done",
				...detectMediaFlag(absoluteUrl),
			} as UploadFileItem;
		}
		const name =
			item?.name || item?.url?.split("/").pop() || `文件${index + 1}`;
		const absoluteUrl = ensureAbsoluteUrl(
			item?.url || item?.resultUrl || item?.originUrl
		);
		return {
			status: normalizeUploadStatus(item?.status),
			message: item?.message,
			...item,
			name,
			url: absoluteUrl,
			...detectMediaFlag(absoluteUrl, item?.file),
		} as UploadFileItem;
	});
}

const fileList = ref<UploadFileItem[]>(normalizeList(props.state.value));
let syncingToField = false;

const showSelectButton = computed(() => {
	const cp = componentProps.value || {};
	const explicit = cp.showUpload;
	const base = explicit !== undefined ? !!explicit : !disabledState.value;
	if (!base) return false;
	return fileList.value.length < limit.value;
});

const syncToField = () => {
	syncingToField = true;
	props.setValue(
		fileList.value.map((item) => {
			const absoluteUrl = ensureAbsoluteUrl(
				item.url || item.resultUrl || item.originUrl
			);
			const mediaFlag = detectMediaFlag(absoluteUrl, item.file);
			return {
				...item,
				url: absoluteUrl,
				...mediaFlag,
				status: (() => {
					const normalized = item.status
						? normalizeUploadStatus(item.status)
						: undefined;
					const hasUrl = !!(item.url || item.resultUrl || item.originUrl);
					const progress = (item as any).progress;
					if (hasUrl || progress === 100) return "done";
					if (normalized) return normalized;
					return "pending";
				})(),
			};
		})
	);
	nextTick(() => {
		syncingToField = false;
	});
};

const applyFileList = (next: UploadFileItem[] | undefined | null) => {
	fileList.value = Array.isArray(next) ? [...next] : [];
	syncToField();
};

watch(
	() => props.state.value,
	(val) => {
		if (syncingToField) return;
		fileList.value = normalizeList(val);
	},
	{ deep: true }
);

const runAfterReadHook = (payload: UploadFileItem | UploadFileItem[]) => {
	const hook = componentProps.value?.afterRead;
	if (!hook) return false;
	try {
		const result = hook(payload, {
			fileList: fileList.value,
			setFileList: (next: UploadFileItem[]) => {
				applyFileList(next);
			},
		});
		if (result && typeof (result as Promise<any>).then === "function") {
			(result as Promise<any>).then(() => syncToField()).catch(() => {});
			return true;
		}
		if (result !== false) syncToField();
		return result !== false;
	} catch (err) {
		console.warn("[FieldUploader] afterRead hook error", err);
		return false;
	}
};

function notifyUploadError(error: any, fileItem: UploadFileItem) {
	const cp = componentProps.value || {};
	if (typeof cp.onUploadError === "function") {
		try {
			cp.onUploadError(error, {
				file: fileItem,
				fileList: fileList.value,
				setFileList: applyFileList,
			});
		} catch (hookErr) {
			console.warn("[FieldUploader] onUploadError hook error", hookErr);
		}
	}
	const message = error?.message || "上传失败，请稍后重试";
	try {
		// @ts-ignore
		if (typeof uni?.showToast === "function") {
			// @ts-ignore
			uni.showToast({ title: message, icon: "none", duration: 2000 });
		}
	} catch (toastErr) {
		console.warn("[FieldUploader] showToast error", toastErr);
	}
}

function resolveUploadHeaders(fileItem: UploadFileItem): Record<string, any> {
	const cp = componentProps.value || {};
	const baseHeaders = cp.uploadHeaders || cp.headers || cp.header || {};
	let headers: Record<string, any> = {};
	if (typeof baseHeaders === "function") {
		try {
			headers = baseHeaders({ file: fileItem, field: props.field }) || {};
		} catch (err) {
			console.warn("[FieldUploader] uploadHeaders fn error", err);
			headers = {};
		}
	} else if (baseHeaders && typeof baseHeaders === "object") {
		headers = { ...baseHeaders };
	}
	if (cp.attachToken !== false && userStore.token && !headers.Authorization) {
		headers.Authorization = `Bearer ${userStore.token}`;
	}
	return headers;
}

function parseUploadResponse(resp: UniApp.UploadFileSuccessCallbackResult) {
	const cp = componentProps.value || {};
	if (typeof cp.parseResponse === "function") {
		return cp.parseResponse(resp);
	}
	try {
		if (typeof resp.data === "string") {
			const json = JSON.parse(resp.data);
			if (json?.url) return json.url;
			if (json?.data?.url) return json.data.url;
			if (json?.data?.path) return json.data.path;
			if (json?.data) return json.data;
			if (json?.path) return json.path;
			if (json?.key) return json.key;
		}
	} catch (err) {
		console.warn("[FieldUploader] parse upload response error", err);
	}
	return resp.data;
}

async function performUpload(
	fileItem: UploadFileItem
): Promise<string | undefined> {
	const cp = componentProps.value || {};
	const customRequest = cp.uploadRequest;
	if (typeof customRequest === "function") {
		const result = await customRequest(fileItem, {
			field: props.field,
			fileList: fileList.value,
			setFileList: applyFileList,
		});
		return typeof result === "string"
			? result
			: ensureAbsoluteUrl(result?.url || result?.path || result);
	}
	const uploadUrl: string | undefined = cp.uploadUrl;
	const resolvedUploadUrl = resolveUploadUrl(uploadUrl);
	if (!resolvedUploadUrl) return undefined;
	const filePath =
		(fileItem as any).path ||
		(fileItem as any).tempFilePath ||
		fileItem.url ||
		fileItem.file?.path ||
		fileItem.file?.tempFilePath;
	if (!filePath) throw new Error("未获取到待上传文件路径");

	return await new Promise<string>((resolve, reject) => {
		uni.uploadFile({
			url: resolvedUploadUrl,
			filePath,
			name: cp.fieldName || "file",
			formData: cp.formData || {},
			header: resolveUploadHeaders(fileItem),
			success: (resp) => {
				const parsed = parseUploadResponse(resp);
				const finalUrl = ensureAbsoluteUrl(
					typeof parsed === "string"
						? parsed
						: parsed?.url || parsed?.path || parsed?.key || parsed
				);
				if (!finalUrl) {
					reject(new Error("上传成功但未返回文件地址"));
					return;
				}
				resolve(finalUrl);
			},
			fail: (err) => reject(err),
		});
	});
}

async function processSingleFile(fileItem: UploadFileItem) {
	fileItem.status = "uploading";
	fileItem.message = "正在上传";
	fileList.value = [...fileList.value];
	syncToField();
	try {
		const finalUrl = await performUpload(fileItem);
		if (finalUrl) {
			fileItem.url = finalUrl;
			(fileItem as any).resultUrl = finalUrl;
			(fileItem as any).originUrl = finalUrl;
			const mediaFlag = detectMediaFlag(finalUrl, fileItem.file);
			fileItem.isImage = mediaFlag.isImage;
			fileItem.isVideo = mediaFlag.isVideo;
		}
		fileItem.status = "done";
		fileItem.message = undefined;
		(fileItem as any).progress = 100;
		fileList.value = [...fileList.value];
		syncToField();
	} catch (err: any) {
		console.warn("[FieldUploader] upload fail", err);
		fileItem.status = "failed";
		fileItem.message = err?.message || "上传失败";
		fileList.value = [...fileList.value];
		syncToField();
		notifyUploadError(err, fileItem);
	}
}

async function handleAfterRead(payload: UploadFileItem | UploadFileItem[]) {
	const handledByHook = runAfterReadHook(payload);
	if (handledByHook) {
		fileList.value = [...fileList.value];
		return;
	}
	const items = Array.isArray(payload) ? payload : [payload];
	for (const item of items) {
		await processSingleFile(item);
	}
}

function handleRemove(index: number, item: UploadFileItem) {
	if (disabledState.value) return;
	const external = componentProps.value?.onRemove;
	if (typeof external === "function") {
		try {
			external(index, item);
		} catch (err) {
			console.warn("[FieldUploader] onRemove handler error", err);
		}
	}
	// 触发一次复制，确保 v-model 数组变化被感知
	fileList.value = [...fileList.value];
	syncToField();
}
</script>

<template>
	<sar-upload
		v-model="fileList"
		:max-count="limit"
		:readonly="disabledState"
		:disabled="disabledState"
		multiple
		v-bind="uploadProps"
		:after-read="handleAfterRead"
		@remove="handleRemove"
	>
		<template #select>
			<view
				v-if="showSelectButton"
				style="display: flex; flex-direction: column; align-items: center"
			>
				<sar-icon size="40rpx" name="/static/icons/svg/xiangji.svg" />
				<view style="font-size: 24rpx; margin-top: 8rpx">上传图片</view>
			</view>
		</template>
	</sar-upload>
</template>

<style scoped>
.flex {
	display: flex;
}
.items-center {
	align-items: center;
}
.flex-none {
	flex: none;
}
.flex-1 {
	flex: 1;
}
.ml-12 {
	margin-left: 12rpx;
}
.ml-auto {
	margin-left: auto;
}
.min-w-0 {
	min-width: 0;
}
.p-16 {
	padding: 16rpx;
}
.rounded {
	border-radius: 12rpx;
}
.truncate {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
