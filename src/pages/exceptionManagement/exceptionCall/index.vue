<template>
	<PageLayout title="异常呼叫" :showBack="true">
		<view class="exception-call-page">
			<view v-if="loading" class="loading">加载中...</view>
			<sar-accordion
				v-else
				v-model="activeNames"
				:multiple="true"
				class="ex-accordion"
			>
				<sar-accordion-item
					v-for="(group, gi) in typeList"
					:key="groupKey(group, gi)"
					:title="groupKey(group, gi)"
					:name="groupKey(group, gi)"
					class="ex-accordion-item"
				>
					<view class="item-body">
						<view class="cards">
							<view
								class="card"
								v-for="(it, idx) in group.children || []"
								:key="it.code || idx"
								@click="goExceptionReport(group, it)"
							>
								<view
									class="card-content"
									:class="`theme--${themeKey(group, gi)}`"
								>
									<text class="card-title">{{ it.name }}</text>
								</view>
							</view>
						</view>
						<view
							v-if="!group.children || group.children.length === 0"
							class="empty"
							>暂无子类目</view
						>
					</view>
				</sar-accordion-item>
			</sar-accordion>
			<view v-if="!loading && typeList.length === 0" class="empty-root">
				暂无异常类型数据
			</view>
		</view>
	</PageLayout>
</template>
<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted, getCurrentInstance, nextTick } from "vue";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { http } from "@/utils/request";

// 类型声明（可根据真实接口调整）
interface ExceptionChild {
	code?: string | number;
	name?: string;
	parentCode?: string | number;
	parentName?: string;
	noticeType?: string | number; // 2: 紧急 3: 重要 其它: 提示
}
interface ExceptionGroup {
	code?: string | number;
	name?: string;
	noticeType?: string | number;
	children?: ExceptionChild[];
}

const typeList = ref<ExceptionGroup[]>([]);
// sar-accordion 允许数组以支持多开
const activeNames = ref<string[]>([]);
const loading = ref(false);

function groupKey(group: ExceptionGroup, gi: number) {
	return group?.name;
}

async function fetchExceptionTypeList(): Promise<ExceptionGroup[]> {
	try {
		const data: any = await http.post("/dispatch/exception/type/list", {});
		if (!Array.isArray(data)) return [];
		const ordered = data
			.filter((parent: any) => parent && parent.deleteFlag === 0)
			.sort((a: any, b: any) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
			.map((parent: any) => {
				const children = Array.isArray(parent.children)
					? parent.children
							.filter((child: any) => child && child.deleteFlag === 0)
							.sort((a: any, b: any) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
							.map((child: any) => ({
								code: child.code,
								name: child.name,
								parentCode: parent.code,
								parentName: parent.name,
								noticeType: child.noticeType,
							}))
					: [];
				return {
					code: parent.code,
					name: parent.name,
					noticeType: parent.noticeType,
					children,
				};
			});
		return ordered;
	} catch (err) {
		console.warn("[exceptionCall] fetchExceptionTypeList failed", err);
		return [];
	}
}

async function loadList() {
	try {
		loading.value = true;
		const raw = await fetchExceptionTypeList();
		typeList.value = Array.isArray(raw) ? raw : [];
		await nextTick();
		activeNames.value = typeList.value.map((g, idx) => groupKey(g, idx));
	} catch (err) {
		typeList.value = [];
		activeNames.value = [];
	} finally {
		loading.value = false;
	}
}

onMounted(() => {
	loadList();
});

function toggle(group: ExceptionGroup, gi: number) {
	const key = groupKey(group, gi);
	const idx = activeNames.value.indexOf(key);
	if (idx >= 0) {
		activeNames.value.splice(idx, 1);
	} else {
		activeNames.value.push(key);
	}
}

function isOpenKey(key: string) {
	return activeNames.value.includes(key);
}

function badgeText(t: any) {
	const v = String(t ?? "");
	if (v === "2") return "紧急";
	if (v === "3") return "重要";
	return "提示";
}

function themeKey(group: ExceptionGroup, gi: number) {
	const name = String(group?.name ?? "").toLowerCase();
	if (name.includes("物料")) return "sunset";
	if (name.includes("人工")) return "royal";
	if (name.includes("机械")) return "ocean";
	if (name.includes("自动化")) return "forest";
	if (name.includes("塔台")) return "slate";
	const keys = ["sunset", "ocean", "forest", "royal", "slate"];
	return keys[gi % keys.length];
}

function goExceptionReport(group: ExceptionGroup, item: ExceptionChild) {
	const instance: any = getCurrentInstance();
	const url = "/pages/exceptionManagement/exceptionReport/index";
	const parentCode = item?.parentCode;
	const parentName = item?.parentName;
	const childCode = item?.code;
	const childName = item?.name;

	const prefillPayload: Record<string, any> = {};
	if (parentCode !== undefined && parentCode !== null)
		prefillPayload.typeParentCode = parentCode;
	if (parentName)
		prefillPayload.typeParentName = parentName;
	if (childCode !== undefined && childCode !== null)
		prefillPayload.typeCode = childCode;
	if (childName)
		prefillPayload.typeName = childName;
	if (item?.noticeType !== undefined && item?.noticeType !== null)
		prefillPayload.noticeType = item.noticeType;

	const params: Record<string, any> = {
		mode: "create",
		// locks: "typeParentCode,typeCode",
	};
	if (Object.keys(prefillPayload).length) {
		params.prefill = JSON.stringify(prefillPayload);
	}
	if (childCode !== undefined && childCode !== null) {
		params.code = childCode;
	}
	if (childName) {
		params.name = childName;
	}
	if (parentCode !== undefined && parentCode !== null) {
		params.parentCode = parentCode;
	}
	if (parentName) {
		params.parentName = parentName;
	}

	const query = Object.entries(params)
		.filter(([, v]) => v != null)
		.map(
			([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
		)
		.join("&");
	if (instance?.proxy?.$navigateToWithGuard) {
		instance.proxy.$navigateToWithGuard(url, { params });
	} else {
		uni.navigateTo({ url: `${url}?${query}` });
	}
}
</script>
<style scoped lang="scss">
.exception-call-page {
	min-height: 100vh;
}

.loading {
	padding: 32px 0;
	text-align: center;
	color: #666;
	font-size: 14px;
}

/* Accordion 外层适配 */
// :deep(.ex-accordion) {
//   margin-left: 0 !important;
//   margin-right: 0 !important;
//   background: transparent;
// }
// :deep(.ex-accordion-item) {
//   background: transparent;
// }
// :deep(.ex-accordion-item > .sar-accordion-item__header) {
//   padding: 0; /* 自定义 header 已提供内边距 */
// }

// .collapse-title {
//   display: flex;
//   align-items: center;
//   justify-content: space-between;
//   padding: 12px 12px;
//   background: #fff;
//   border-bottom: 1px solid rgba(0, 0, 0, 0.06);
// }

// .title-text {
//   font-size: 16px;
//   font-weight: 600;
// }

.toggle {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.toggle-text {
	font-size: 12px;
}

.item-body {
	padding: 8px 8px 12px;
	background: #fff;
	overflow: visible;
}

/* 卡片布局 */
.cards {
	display: flex;
	flex-wrap: wrap;
	margin: 0 -6px;
}

.card {
	width: 33.3333%;
	padding: 6px;
	box-sizing: border-box;
}

.card-content {
	position: relative;
	height: 84px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 10px;
	color: #fff;
	background: linear-gradient(135deg, #ffd6b0 0%, #ffb892 100%);
	box-shadow: 0 6px 14px rgba(255, 122, 58, 0.16);
	overflow: hidden;
	transition: transform 0.08s ease, filter 0.08s ease;
}

.card-content::after {
	content: "";
	position: absolute;
	inset: 0;
	background: radial-gradient(
		120px 80px at 20% 15%,
		rgba(255, 255, 255, 0.22),
		transparent 60%
	);
	pointer-events: none;
}

.card-content:active {
	transform: translateY(1px) scale(0.99);
	filter: brightness(0.95);
}

.card-title {
	font-size: 13px;
	font-weight: 700;
	line-height: 1.25;
	letter-spacing: 0.2px;
}

/* 徽标 */
.badge {
	position: absolute;
	top: 6px;
	right: 6px;
	font-size: 10px;
	line-height: 1;
	padding: 3px 6px;
	border-radius: 999px;
	color: #fff;
	border: 1px solid rgba(255, 255, 255, 0.35);
	background: rgba(255, 255, 255, 0.18);
	backdrop-filter: blur(2px);
}

.badge--t2 {
	background: linear-gradient(90deg, #ff4d4f, #ff8844);
}

.badge--t3 {
	background: linear-gradient(90deg, #f4c430, #ff9500);
}

/* 分组主题色 */
.theme--sunset {
	background: linear-gradient(135deg, #ffd2a3 0%, #ffb48f 50%, #f58a6e 100%);
	box-shadow: 0 8px 18px rgba(239, 90, 60, 0.18);
}
.theme--ocean {
	background: linear-gradient(135deg, #a8e3ff 0%, #78b4ff 55%, #6f8dff 100%);
	box-shadow: 0 8px 18px rgba(43, 98, 255, 0.18);
}
.theme--forest {
	background: linear-gradient(135deg, #b6f0c1 0%, #6ddb8f 55%, #4fbe88 100%);
	box-shadow: 0 8px 18px rgba(34, 197, 94, 0.16);
}
.theme--royal {
	background: linear-gradient(135deg, #d1b8ff 0%, #a796ff 55%, #8a77f2 100%);
	box-shadow: 0 8px 18px rgba(90, 61, 238, 0.18);
}
.theme--slate {
	background: linear-gradient(135deg, #cfd6df 0%, #aab5c6 55%, #7b899f 100%);
	box-shadow: 0 8px 18px rgba(93, 107, 130, 0.18);
}

.empty,
.empty-root {
	text-align: center;
	color: #999;
	font-size: 12px;
	padding: 12px 0;
}
</style>
