<template>
	<PageLayout title="异常知识库" :show-back="true" :sticky-toolbar="true">
		<template #toolbar>
			<div class="wo-toolbar">
				<sar-search
					v-model="formData.keyword"
					shape="square"
					placeholder="请输入关键词搜索"
					:clearable="true"
					@update:model-value="onModelUpdate"
					@change="onChange"
					@search="onConfirm"
					@confirm="onConfirm"
					@cancel="onCancel"
					@clear="onClear"
				/>
			</div>
		</template>
		<CTabs
			v-model="activeRange"
			:tabs="rangeTabs"
			type="line"
			:scrollable="'auto'"
			:lazy-render="true"
			:animated="true"
			:duration="0.25"
			@change="onRangeChangeTab"
		/>
		<PullList
			ref="listRef"
			class="exl-list"
			:request="request"
			:query="query"
			:page-size="formData.pageSize"
			:auto-more="true"
			:height="listHeight"
			@loaded="onLoaded"
			@error="onError"
		>
			<template #first-loading>
				<div class="exl-loading">加载中...</div>
			</template>
			<template #item="{ item, index }">
				<CCard
					:key="item.__key || index"
					class="exl-card"
					:title="item.title || '-'"
					:subtitle="item.callPName || ''"
					:extra="formatTime(item.handleTime)"
					:variant="'elevated'"
					:content="
						item.exceptionDesc + (item.solution ? '--' + item.solution : '')
					"
					:line-clamp="0"
					:title-clamp="1"
					clickable
					@click="viewDetail(item)"
				/>
			</template>
		</PullList>
	</PageLayout>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, onBeforeUnmount } from "vue";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import CTabs from "@/components/c-tabs/CTabs.vue";
import PullList from "@/components/pull-list/PullList.vue";
import CCard from "@/components/c-card/CCard.vue";
// import cSearch from '@/components/c-form/fields/Search.vue';
import { knowledgeSearch } from "@/api/exception";

const rangeTabs = ref([
	{ name: "", title: "全部" },
	{ name: "day", title: "当天" },
	{ name: "week", title: "近一周" },
	{ name: "month", title: "近一月" },
	{ name: "year", title: "近一年" },
]);
const activeRange = ref("");
const showAction = ref(false);
const listRef = ref<any>();
const listHeight = "auto";

const formData = reactive({
	dateRange: "",
	highlight: 1,
	keyword: "",
	pageNum: 0,
	pageSize: 10,
});
const query = ref<{ dateRange: string; keyword?: string }>({ dateRange: "" });

function updateKeyword(next: string) {
	const normalized = next ?? "";
	if (normalized === formData.keyword) return false;
	formData.keyword = normalized;
	return true;
}

function triggerReload() {
	nextTick(() => {
		if (listRef.value?.reload) listRef.value.reload();
		else if (listRef.value?.refresh) listRef.value.refresh();
	});
}

// 统一的搜索逻辑 - 立即更新query并重新加载
function performSearch() {
	query.value = {
		dateRange: formData.dateRange,
		keyword: formData.keyword,
	};
	triggerReload();
}

// 页签切换 - 立即执行搜索，不需要防抖
function onRangeChangeTab(payload: { name: string; index: number }) {
	formData.dateRange = payload.name;
	performSearch();
}

function onFocus() {
	showAction.value = false;
}

// 统一的防抖定时器
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE_MS = 300;

// 防抖搜索函数 - 用于输入过程中的搜索
function debouncedSearch() {
	if (searchTimer) clearTimeout(searchTimer);
	searchTimer = setTimeout(() => {
		performSearch();
		searchTimer = null;
	}, SEARCH_DEBOUNCE_MS);
}

// 点击搜索/回车确认 - 立即执行
function onConfirm(value: string) {
	updateKeyword(value ?? "");
	// 取消防抖，立即执行
	if (searchTimer) {
		clearTimeout(searchTimer);
		searchTimer = null;
	}
	performSearch();
}

// 点击清除按钮 - 立即执行
function onClear() {
	updateKeyword("");
	// 取消防抖，立即执行
	if (searchTimer) {
		clearTimeout(searchTimer);
		searchTimer = null;
	}
	performSearch();
}

// v-model 同步回调 - 使用防抖
function onModelUpdate(v: string) {
	if (!updateKeyword(v ?? "")) return;
	debouncedSearch();
}

// 某些版本仅触发 change - 使用防抖
function onChange(v: string) {
	if (!updateKeyword(v ?? "")) return;
	debouncedSearch();
}

// 取消时重置为全部 - 立即执行
function onCancel() {
	if (!updateKeyword("")) return;
	if (searchTimer) {
		clearTimeout(searchTimer);
		searchTimer = null;
	}
	performSearch();
}

// 组件卸载时清理定时器
onBeforeUnmount(() => {
	if (searchTimer) {
		clearTimeout(searchTimer);
		searchTimer = null;
	}
})

function viewDetail(item: any) {
	const rawId = item.id;
	const id = rawId != null ? String(rawId) : "";
	if (!id) return;
	uni.navigateTo({
		url: `/pages/libraryDetail/index?id=${encodeURIComponent(id)}`,
	});
}
function formatTime(v?: string | number) {
	if (v === undefined || v === null || v === "") return "-";
	const d = new Date(
		typeof v === "number" || /^\d+$/.test(String(v))
			? Number(v)
			: String(v).replace(/-/g, "/")
	);
	if (isNaN(d.getTime())) return "-";
	const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
		d.getHours()
	)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
async function request(params: {
	page: number;
	pageSize: number;
	query?: { dateRange: string; keyword?: string };
	signal?: AbortSignal;
}) {
	const { page, pageSize, query: q } = params;
	const payload: any = {
		pageNum: page,
		pageSize,
		dateRange: q?.dateRange ?? formData.dateRange,
		keyword: formData.keyword,
		highlight: formData.highlight,
	};
	let res: any;
	try {
		// 只传 query，不传 body
		res = await knowledgeSearch(payload);
	} catch (e: any) {
		throw e;
	}
	const envelope = res && typeof res === "object" ? res : {};
	const data =
		envelope?.data && typeof envelope.data === "object"
			? envelope.data
			: envelope;
	const listCandidate = Array.isArray(data.list)
		? data.list
		: Array.isArray((data as any).records)
		? (data as any).records
		: [];
	const listSource = Array.isArray(listCandidate) ? listCandidate : [];
	const records: any[] = [];
	for (let idx = 0; idx < listSource.length; idx++) {
		const item = listSource[idx] ?? {};
		const docId =
			item && typeof item === "object"
				? item.documentId ?? item.id ?? null
				: null;
		const normalizedId =
			docId !== null && docId !== undefined ? `${docId}` : null;
		records.push({
			...item,
			documentId: normalizedId,
			__key: normalizedId ?? `${page}-${idx}`,
		});
	}
	const totalRaw =
		data?.total ??
		envelope?.total ??
		(Array.isArray(listSource) ? listSource.length : records.length);
	const total = typeof totalRaw === "number" ? totalRaw : records.length;
	const hasMore = total > page * pageSize;
	console.log("[exceptionLibrary] request result", {
		envelope,
		data,
		listSource,
		records,
		total,
		hasMore,
	});

	return { list: records, total, hasMore };
}
function onLoaded() {}
function onError(err: unknown) {
	console.error("[exceptionLibrary] pull-list error", err);
	try {
		const stack =
			err && typeof err === "object" && "stack" in err
				? String((err as any).stack ?? "")
				: "";
		if (stack) console.error("[exceptionLibrary] error stack\n", stack);
	} catch (stackErr) {
		console.warn("[exceptionLibrary] failed to print stack", stackErr);
	}
	const message =
		err && typeof err === "object" && "message" in err
			? String((err as any).message ?? "")
			: "";
	if (message) {
		uni.showToast({ title: message, icon: "none" });
	}
}
</script>

<style scoped>
.exl-toolbar {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-bottom: 4px;
}
.exl-search {
	margin: 8px 0;
}
.exl-loading {
	text-align: center;
	color: #666;
	font-size: 14px;
}
.exl-card :deep(.c-card__title) {
	font-weight: 600;
}
.exl-empty,
.exl-error,
.exl-finished {
	text-align: center;
	color: #999;
	font-size: 12px;
	padding: 16px 0;
}
</style>
