<template>
	<PageLayout
		title="工作台"
		:showBack="false"
		:padding="'0 0 0 0'"
		:withTabbar="true"
	>
		<template #nav-right>
			<view class="msg-wrapper" @click="goMessage">
				<sar-icon name="/static/icons/svg/youjian.svg" size="48rpx" />
				<view v-if="showBadge" class="msg-badge">
					<text class="msg-badge__text">{{ badgeText }}</text>
				</view>
			</view>
		</template>
		<!-- 顶部融合渐变背景，用于与透明覆盖导航无缝连接 -->
		<view class="gradient-header" />
		<!-- 欢迎横幅 -->
		<view class="hero">
			<view class="hero-meta">
				<view class="hero-title">MOM 工作台</view>
				<view class="hero-sub">一站式进入设备、异常、检验、质检与工控模块</view>
				<!-- <view class="hero-actions">
					<CButton inline size="mini" type="primary" @click="openFirst"
						>设备管理</CButton
					>
				</view> -->
			</view>
		</view>

		<!-- 最近常用 -->
		<view v-if="recentActions.length" class="recent-wrapper">
			<view class="section-title">最近使用</view>
			<view class="recent-list">
				<view
					v-for="r in recentActions"
					:key="r.path"
					class="recent-item"
					@click="goPages(r.path, r.params || {})"
				>
					<text class="recent-item__text">{{ r.text }}</text>
				</view>
			</view>
		</view>

		<!-- 模块卡片栅格 -->
		<view class="modules-grid">
			<CCard
				v-for="m in displayBadgeList"
				:key="m.id"
				:class="['module-ccard', m.bgClass]"
				variant="elevated"
				body-layout="custom"
				:clickable="true"
				@click="onModuleCard(m)"
			>
				<template #default>
					<view class="module-card-inner">
						<view class="icon-col">
							<view :class="['icon-wrap', m.bgClass]">
								<sar-icon
									v-if="m.sarIcon"
									:name="m.sarIcon"
									:size="m.size || '48rpx'"
									color="#fff"
								/>
								<text v-else :class="['iconfont', m.iconClass]" />
							</view>
						</view>
						<view class="info-col">
							<view class="info-title">{{ m.title }}</view>
							<view class="info-sub" v-if="m.actions?.length">{{
								actionSummary(m)
							}}</view>
						</view>
						<view class="enter-col" @click.stop="openModuleDefault(m)">
							<sar-icon name="right" size="32rpx" :color="'#333'" />
						</view>
					</view>
				</template>
			</CCard>
		</view>

		<!-- 快速操作面板 -->
		<CQuickActionSheet
			v-model:visible="qasShow"
			:title="qasTitle"
			:items="qasItems"
			@select="onItemSelect"
			@cancel="onQasCancel"
			@after-hide="onQasAfterHide"
		/>

		<!-- 通过 PageLayout tabbar 插槽放置自定义 TabBar，避免滚动跟随 -->
		<template #tabbar>
			<AppTabbar :tabs="tabs" :blur="true" />
		</template>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck  先保留，后续统一去除
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { storeToRefs } from "pinia";
import { defaultTabs } from "@/config/tabbar";
import { useMessageStore } from "@/stores/message";
import { navigateToWithGuard } from "@/utils/navigation";
import { useUserStore } from "@/stores";
import { storage } from "@/utils/storage";
import { http } from "@/utils/request";
import { EP } from "@/api/endpoints";

const RECENT_KEY = "recent_actions_v1";
const MESSAGE_SOURCES = [6, 7, 8, 9];

const userStore = useUserStore() as any;
const { message, userInfo, haveOrderManagement, haveManagementCopy } =
	storeToRefs(userStore);
const messageStore = useMessageStore();
const tabs = computed(() =>
	defaultTabs.map((t) =>
		t.path.includes("/pages/message/")
			? { ...t, badge: messageStore.unreadCount }
			: t
	)
);

console.log("[home] tabs", message.value);

function toCount(val: unknown) {
	const num = Number(val);
	if (!Number.isFinite(num) || num <= 0) return 0;
	return Math.floor(num);
}

const badgeCount = computed(() => {
	const storeCount = toCount(messageStore.unreadCount);
	if (storeCount > 0) return storeCount;
	return toCount(message.value);
});

const badgeText = computed(() =>
	badgeCount.value > 99 ? "99+" : String(badgeCount.value)
);

const showBadge = computed(() => badgeCount.value > 0);

interface ActionMeta {
	text: string;
	path: string;
	icon?: string; // 旧的 vant 风格 icon 名称
	emphasis?: boolean;
	default?: boolean;
	params?: Record<string, any>;
}
// QuickActionItem 供 CQuickActionSheet 使用
interface ActionSheetItem {
	name: string;
	value: string;
	icon?: string;
	payload?: Record<string, any>;
}
interface BadgeItem {
	id: number;
	iconClass: string; // 旧字体图标 class 备用
	sarIcon?: string; // 新 sard icon 名称
	title: string;
	bgClass: string;
	content?: string;
	urlPath?: string;
	actions?: ActionMeta[];
}

const badgeList: BadgeItem[] = [
	{
		id: 0,
		iconClass: "icon-sb",
		sarIcon: "/static/icons/svg/shebei.svg",
		title: "设备管理",
		bgClass: "bg-a",
		actions: [
			{
				text: "在线报修",
				path: "/pages/eqManagement/repair/index",
				icon: "add-o",
				emphasis: true,
				default: true,
			},
			{
				text: "工单管理",
				path: "/pages/orderList/index",
				icon: "orders-o",
				params: { source: "1" },
			},
			{
				text: "我的工单",
				path: "/pages/orderList/index",
				icon: "orders-o",
				params: { source: "2" },
			},
		],
	},
	{
		id: 1,
		iconClass: "icon-yc",
		sarIcon: "/static/icons/svg/yichang.svg",
		title: "异常管理",
		bgClass: "bg-b",
		size: "68rpx",
		actions: [
			{
				text: "异常呼叫",
				path: "/pages/exceptionManagement/exceptionCall/index",
				icon: "warning-o",
			},
			{
				text: "异常上报",
				path: "/pages/exceptionManagement/exceptionReport/index",
				icon: "warning-o",
			},
			{
				text: "异常处理",
				path: "/pages/exceptionManagement/exceptionDispose/index",
				icon: "passed",
			},
			{
				text: "异常库",
				path: "/pages/exceptionManagement/exceptionLibrary/index",
				icon: "notes-o",
			},
		],
	},
	// {
	// 	id: 2,
	// 	iconClass: "icon-jy",
	// 	sarIcon: "/static/icons/svg/jianyanjihua.svg",
	// 	title: "检验计划",
	// 	bgClass: "bg-c",

	// 	actions: [
	// 		{
	// 			text: "检验计划",
	// 			path: "/pages/inspectionPlan/index",
	// 			icon: "calendar-o",
	// 		},
	// 		{
	// 			text: "下达派发",
	// 			path: "/pages/inspectionDispatch/index",
	// 			icon: "guide-o",
	// 		},
	// 		{
	// 			text: "检验明细",
	// 			path: "/pages/inspectionDetail/index",
	// 			icon: "orders-o",
	// 		},
	// 	],
	// },
	{
		id: 3,
		iconClass: "icon-zl",
		sarIcon: "/static/icons/svg/zhijian.svg",
		title: "质检填报",
		size: "72rpx",
		bgClass: "bg-d",
		actions: [
			// {
			// 	text: "质量检测",
			// 	path: "/pages/quality/qualityTest/index",
			// 	icon: "edit",
			// },
			// {
			// 	text: "精度检测",
			// 	path: "/pages/quality/qualityjdList/index",
			// 	icon: "edit",
			// },
			{
				text: "探伤检测",
				path: "/pages/quality/qualitytsList/index",
				icon: "edit",
			},
			// { text: "质检填报", path: "/pages/qualityControl/index", icon: "edit" },
			// {
			// 	text: "质检明细",
			// 	path: "/pages/qualityControlDetail/index",
			// 	icon: "notes-o",
			// },
		],
	},
	// {
	// 	id: 4,
	// 	iconClass: "icon-gk",
	// 	sarIcon: "/static/icons/svg/jianyanjihua.svg",
	// 	title: "工控管理",
	// 	bgClass: "bg-e",
	// 	actions: [
	// 		{
	// 			text: "工控管理",
	// 			path: "/pages/controlManagement/index",
	// 			icon: "setting-o",
	// 		},
	// 	],
	// },
];

const displayBadgeList = computed<BadgeItem[]>(() => {
	const info = userInfo.value as any;
	const userName = String(info?.userName ?? "").toLowerCase();
	const isAdmin = userName === "admin";
	const showOrderManagement = haveOrderManagement.value || isAdmin;
	const showManagementCopy = haveManagementCopy.value || isAdmin;
	return badgeList.map((item) => {
		if (!item.actions || item.id !== 0) {
			return {
				...item,
				actions: item.actions ? [...item.actions] : undefined,
			};
		}
		const actions = item.actions.filter((action) => {
			const source = action?.params?.source;
			if (source === "1") return showOrderManagement;
			if (source === "2") return true;
			if (source === "copy") return showManagementCopy;
			return true;
		});
		return { ...item, actions };
	});
});

let unreadRequestId = 0;
function pickNumeric(...candidates: any[]) {
	for (const item of candidates) {
		if (item === undefined || item === null) continue;
		const numeric = typeof item === "string" ? Number(item) : item;
		if (typeof numeric === "number" && Number.isFinite(numeric)) {
			return numeric;
		}
	}
	return undefined;
}

function resolveUnreadCount(payload: any) {
	if (!payload || typeof payload !== "object") return 0;
	const direct = pickNumeric(
		payload.unread,
		payload.unreadCount,
		payload.count,
		payload.total,
		payload.totalCount,
		payload.totalRow,
		payload.totalRows,
		payload.totalNum,
		payload.totalElements,
		payload?.page?.total,
		payload?.page?.totalCount
	);
	if (typeof direct === "number") {
		return Math.max(0, Math.floor(direct));
	}
	if (Array.isArray(payload.records)) return payload.records.length;
	if (Array.isArray(payload.rows)) return payload.rows.length;
	if (Array.isArray(payload.list)) return payload.list.length;
	const inner = payload?.data;
	if (inner && typeof inner === "object" && inner !== payload) {
		return resolveUnreadCount(inner);
	}
	return 0;
}

async function refreshUnreadCount() {
	// const requestId = ++unreadRequestId;
	try {
		const resp: any = await http.post(EP.USER_MESSAGE_PAGE, {
			sourceList: MESSAGE_SOURCES,
			beRead: 0,
		});
		// if (requestId !== unreadRequestId) return;
		const data = resp?.data || resp;
		const count = resolveUnreadCount(data);
		syncUnread(count);
	} catch (error) {
		// if (requestId !== unreadRequestId) return;
		console.warn("[home] refreshUnreadCount failed", error);
	}
}

onMounted(() => {
	loadRecent();
	refreshUnreadCount();
});

onShow(() => {
	refreshUnreadCount();
});

function syncUnread(source: unknown) {
	const count = toCount(source);
	if (messageStore.unreadCount !== count) {
		messageStore.setUnread(count);
	}
}

syncUnread(message.value);

watch(message, (val) => {
	syncUnread(val);
});

watch(
	() => messageStore.unreadCount,
	(val) => {
		const count = toCount(val);
		if (toCount(message.value) !== count) {
			userStore.setMessage(count);
		}
	},
	{ immediate: true }
);

// 最近使用
const recentActions = ref<ActionMeta[]>([]);

function findActionByPath(path: string | null | undefined): ActionMeta | null {
	if (!path) return null;
	const key = String(path).trim();
	if (!key) return null;
	for (const module of displayBadgeList.value) {
		const hit = module.actions?.find((action) => action.path === key);
		if (hit) return hit;
	}
	return null;
}

function loadRecent() {
	try {
		const stored = storage.get<any>(RECENT_KEY);
		let path = "";
		if (typeof stored === "string") {
			path = stored;
		} else if (stored && typeof stored === "object") {
			if (typeof stored.path === "string") {
				path = stored.path;
			}
			if (!path) {
				for (const value of Object.values(stored)) {
					if (typeof value === "string" && value) {
						path = value;
						break;
					}
				}
			}
		}
		const action = findActionByPath(path);
		recentActions.value = action ? [action] : [];
	} catch {
		recentActions.value = [];
	}
}

watch(
	() =>
		displayBadgeList.value.map((item) => ({
			id: item.id,
			actions: item.actions?.map((a) => a.path) || [],
		})),
	() => {
		loadRecent();
	},
	{ deep: true }
);

// 快速操作面板状态（保持 ref，不要在 update:show 中直接覆盖 ref 本身）
const qasShow = ref(false);
const qasTitle = ref("");
// 传给 CQuickActionSheet 的结构
const qasItems = ref<ActionSheetItem[]>([]);

// icon 名称映射（vant -> sard），缺失时用 plus 兜底
const ICON_MAP: Record<string, string> = {
	"add-o": "plus",
	"orders-o": "todo-list",
	"warning-o": "warning",
	passed: "check",
	"notes-o": "note",
	"calendar-o": "calendar",
	"guide-o": "guide",
	"setting-o": "setting",
};

function mapActionsForSheet(list: ActionMeta[]): ActionSheetItem[] {
	return list.map((a) => ({
		name: a.text,
		value: a.path,
		icon: a.icon ? ICON_MAP[a.icon] || "plus" : undefined,
		payload: a.params || {},
	}));
}

function goMessage() {
	navigateToWithGuard("/pages/message/index");
}

function goPages(path: string, params: Record<string, any> = {}) {
	if (path === "/pages/eqManagement/repair/index") {
		const merged = { mode: "add", ...params };
		navigateToWithGuard(path, { params: merged });
		return;
	}
	if (path === "/pages/exceptionManagement/exceptionReport/index") {
		const merged = { mode: "add", ...params };
		navigateToWithGuard(path, { params: merged });
		return;
	}
	navigateToWithGuard(path, { params });
}

function openFirst() {
	const firstModule = displayBadgeList.value[0];
	if (firstModule) openModuleCard(firstModule);
}

function actionSummary(m: BadgeItem) {
	const acts = m.actions || [];
	return acts.map((a) => a.text).join(" / ");
}

function openModuleDefault(m: BadgeItem) {
	const acts = m.actions || [];
	const def = acts.find((a) => a.default) || acts[0];
	if (def?.path) goPages(def.path, def.params || {});
}

function onModuleCard(m: BadgeItem) {
	const acts = m.actions || [];
	console.log("open module", m, acts);

	if (!acts.length) {
		if (m.urlPath) goPages(m.urlPath);
		return;
	}
	if (m.id === 2) {
		uni.showToast({ title: "该功能正在开发中", icon: "none" });
		return;
	}
	qasTitle.value = m.title;
	qasItems.value = mapActionsForSheet(acts);
	// 等待 items 更新 flush 后再展示，避免某些端同步赋值未触发内部计算
	nextTick(() => {
		qasShow.value = true;
	});
}

function onItemSelect(item: ActionSheetItem) {
	if (item?.value) {
		try {
			storage.set(RECENT_KEY, { path: item.value });
		} catch {}
		goPages(item.value, item.payload || {});
		loadRecent();
	}
	qasShow.value = false;
}
function onQasCancel() {
	qasShow.value = false;
}
function onQasAfterHide() {}
</script>

<style scoped lang="scss">
.gradient-header {
	--nav-height: 52px;
	padding-top: calc(var(--nav-height) + env(safe-area-inset-top));
	height: 130px;
	background: linear-gradient(135deg, #0b3d91 0%, #00b3a6 65%);
	border-bottom-left-radius: 30% 26%;
	border-bottom-right-radius: 30% 26%;
	position: relative;
	overflow: hidden;
	filter: saturate(115%) brightness(1.02);
	box-shadow: 0 10px 24px -6px rgba(11, 61, 145, 0.35),
		0 4px 12px rgba(0, 0, 0, 0.16);
}
.gradient-header::before {
	content: "";
	position: absolute;
	inset: 0;
	background: radial-gradient(
			circle at 24% 20%,
			rgba(255, 255, 255, 0.28),
			rgba(255, 255, 255, 0) 55%
		),
		radial-gradient(
			circle at 78% 32%,
			rgba(255, 255, 255, 0.18),
			rgba(255, 255, 255, 0) 58%
		);
	mix-blend-mode: overlay;
	pointer-events: none;
}

.gradient-header::after {
	content: "";
	position: absolute;
	left: 0;
	right: 0;
	bottom: -1px;
	height: 40px;
	background: linear-gradient(
		180deg,
		rgba(255, 255, 255, 0.18),
		rgba(255, 255, 255, 0)
	);
	mix-blend-mode: soft-light;
}
.msg-wrapper {
	position: relative;
	display: flex;
	width: 36px;
	padding-right: 10px;
	height: 36px;
	align-items: center;
	justify-content: center;
}

.msg-badge {
	position: absolute;
	top: -1px;
	right: 0px;
	min-width: 16px;
	height: 16px;
	padding: 0 5px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #ff6a3d 0%, #ff3b30 100%);
	color: #fff;
	border-radius: 999px;
	border: 1px solid rgba(255, 255, 255, 0.65);
	box-shadow: 0 4px 10px rgba(255, 59, 48, 0.32);
	transform-origin: center;
	transition: transform 0.18s ease;
	backdrop-filter: blur(3px);
}

.msg-badge__text {
	font-size: 10px;
	font-weight: 600;
	line-height: 1;
	white-space: nowrap;
	letter-spacing: 0.2px;
}

.msg-wrapper:active .msg-badge {
	transform: scale(0.92);
}

.hero {
	margin: -70px 12px 0; /* 叠加到渐变底部获得卡片浮出效果 */
	padding: 12px 14px;
	border-radius: 16px;
	background: linear-gradient(
		135deg,
		rgba(11, 61, 145, 0.9) 0%,
		rgba(11, 61, 145, 0.72) 60%,
		rgba(0, 179, 166, 0.55) 100%
	);
	color: #fff;
	box-shadow: 0 8px 20px rgba(11, 61, 145, 0.2);
	position: relative;
	overflow: hidden;
}

.hero::after {
	content: "";
	position: absolute;
	right: -30px;
	top: -30px;
	width: 180px;
	height: 180px;
	background: radial-gradient(
		closest-side,
		rgba(255, 255, 255, 0.18),
		rgba(255, 255, 255, 0)
	);
	border-radius: 50%;
	filter: blur(2px);
}

.hero-title {
	font-size: 18px;
	font-weight: 700;
	letter-spacing: 0.5px;
}

.hero-sub {
	margin-top: 4px;
	font-size: 12px;
	opacity: 0.9;
}

.hero-actions {
	margin-top: 10px;
}

.recent-wrapper {
	margin: 18px 12px 4px;
}

.section-title {
	font-size: 14px;
	font-weight: 600;
	color: #374151;
	margin-bottom: 6px;
}

.recent-list {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.recent-item {
	background: #fff;
	border: 1px solid #e5e7eb;
	padding: 6px 10px;
	font-size: 12px;
	border-radius: 999px;
	color: #0b3d91;
	line-height: 1;
}

.modules-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 12px;
	padding: 12px;
}

.module-ccard.bg-a {
	background: linear-gradient(135deg, #eef6ff 0%, #f1f0ff 100%);
}

.module-ccard.bg-b {
	background: linear-gradient(135deg, #fff7eb 0%, #ffece5 100%);
}

.module-ccard.bg-c {
	background: linear-gradient(135deg, #ecfdf5 0%, #e6fffb 100%);
}

.module-ccard.bg-d {
	background: linear-gradient(135deg, #f8f5ff 0%, #f3eafe 100%);
}

.module-ccard.bg-e {
	background: linear-gradient(135deg, #fff5f5 0%, #ffe9ef 100%);
}

.module-ccard.bg-a .info-title {
	color: #0b3d91;
}

.module-ccard.bg-b .info-title {
	color: #c2410c;
}

.module-ccard.bg-c .info-title {
	color: #047857;
}

.module-ccard.bg-d .info-title {
	color: #6d28d9;
}

.module-ccard.bg-e .info-title {
	color: #be123c;
}

.module-card-inner {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 12px 4px;
}

.icon-col {
	width: 56px;
	display: flex;
	justify-content: center;
}

.icon-wrap {
	width: 40px;
	height: 40px;
	border-radius: 10px;
	display: flex;
	justify-content: center;
	align-items: center;
	color: #fff;
}

.icon-wrap .iconfont {
	font-size: 22px;
}

.info-col {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.info-title {
	font-size: 15px;
	font-weight: 600;
	color: #111827;
}

.info-sub {
	margin-top: 4px;
	font-size: 11px;
	color: #6b7280;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.enter-col {
	display: flex;
	align-items: center;
}

.icon-wrap.bg-a {
	background: linear-gradient(135deg, #5cb1ef 0%, #6f6cf3 100%);
}

.icon-wrap.bg-b {
	background: linear-gradient(135deg, #f7a62e 0%, #f25e1e 100%);
}

.icon-wrap.bg-c {
	background: linear-gradient(135deg, #50df9a 0%, #00acb7 100%);
}

.icon-wrap.bg-d {
	background: linear-gradient(135deg, #ba76ff 0%, #835af9 100%);
}

.icon-wrap.bg-e {
	background: linear-gradient(135deg, #e62828 0%, #ff557e 100%);
}
</style>
