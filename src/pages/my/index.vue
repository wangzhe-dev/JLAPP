<template>
	<PageLayout
		title="我的"
		:showBack="true"
		:withTabbar="true"
		:navTransparent="true"
		:navOverlay="true"
		:hideNav="true"
	>
		<template #nav-right>
			<view class="nav-icon" @click="goMessage">
				<sar-icon name="bell" size="20" color="#fff" />
				<view v-if="msgCount" class="nav-badge">{{ msgCount }}</view>
			</view>
		</template>
		<view class="my-wrapper fade-in">
			<view class="gradient-header" />
			<CCard class="profile-card" variant="elevated" body-layout="custom">
				<template #default>
					<view class="user-info">
						<view class="avatar">
							<view class="avatarIcon">
								<image
									v-if="avatarUrl"
									:src="avatarUrl"
									mode="cover"
									class="avatar-img"
								/>
								<view v-else class="avatar-fallback">
									{{ displayName?.charAt(0) }}
								</view>
							</view>
						</view>
						<!-- <view class="name-block">
							<view class="app-badge">内部应用</view>
						</view> -->
						<view class="info-items">
							<view class="info-item">
								<view class="info-label">
									<sar-icon name="user" size="16" />
									<text>用户名</text>
								</view>
								<view class="info-value">{{ displayName }}</view>
							</view>
							<view class="info-item">
								<view class="info-label">
									<sar-icon name="friends" size="16" />
									<text>所属角色</text>
								</view>
								<view class="info-value">{{ roleName }}</view>
							</view>
						</view>
					</view>
				</template>
			</CCard>

			<view class="actions">
				<view class="action-item" @click="onClearCache">
					<text class="action-label">清理缓存</text>
					<view class="action-right">
						<sar-icon name="right" size="16" />
					</view>
				</view>
			</view>

			<view class="outlog-btn">
				<sar-button round theme="primary" @tap="outlog">
					退出当前账号
				</sar-button>
			</view>
		</view>
		<template #tabbar>
			<AppTabbar :tabs="tabs" :blur="true" />
		</template>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck 暂时保留
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { defaultTabs } from "@/config/tabbar";
import { useMessageStore } from "@/stores/message";
import { useUserStore } from "@/stores";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import CCard from "@/components/c-card/CCard.vue";
import AppTabbar from "@/components/app-tabbar/AppTabbar.vue";
import { minioBaseUrl } from "@/config";
import { navigateToWithGuard } from "@/utils/navigation";

const userStore = useUserStore() as any;
const { userInfo, message } = storeToRefs(userStore);
const messageStore = useMessageStore();

const tabs = computed(() =>
	defaultTabs.map((t) =>
		t.path.includes("/pages/message/")
			? { ...t, badge: messageStore.unreadCount }
			: t
	)
);

const rawUser = computed(() => (userInfo.value || {}) as any);
const msgCount = computed(() => message.value ?? "");

function buildAssetUrl(url?: string | null) {
	if (!url) return "";
	const trimmed = `${url}`.trim();
	if (!trimmed) return "";
	if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
		return trimmed;
	}
  console.log('bbb',minioBaseUrl);

	const base = (minioBaseUrl || "").replace(/\/+$/, "");
	const path = trimmed.replace(/^\/+/, "");
	if (base && trimmed.startsWith(base)) return trimmed;
	return base ? `${base}/${path}` : `/${path}`;
}

const avatarUrl = computed(() => {
	const info = rawUser.value;
	return buildAssetUrl(info?.avatar || info?.avatarUrl || "");
});

const accountName = computed(() => {
	const info = rawUser.value;
	return (
		info?.userName ||
		info?.loginName ||
		info?.account ||
		info?.employeeNumber ||
		info?.remark ||
		"--"
	);
});

const displayName = computed(() => {
	const info = rawUser.value;
	return info?.userName || "用户";
});

const roleName = computed(() => {
	const info = rawUser.value;
	const roles = Array.isArray(info?.roles) ? info.roles : [];
	const names = roles
		.map((role: any) =>
			typeof role === "string" ? role : role?.roleName || role?.name || role?.label
		)
		.filter(Boolean);
	if (names.length) return names.join("、");
	return info?.remark || "";
});

function onClearCache() {
	try {
		uni.removeStorageSync("__options_cache__");
		uni.showToast({ title: "已清理", icon: "success" });
	} catch {
		uni.showToast({ title: "失败", icon: "none" });
	}
}

function outlog() {
	userStore.logoutAction?.();
}

function goMessage() {
	navigateToWithGuard("/pages/message/index");
}

onMounted(() => {
	if (!userInfo.value) userStore.fetchUserInfo?.();
});
</script>

<style scoped lang="scss">
/* 基础过渡 */
.fade-in {
	animation: fade 0.4s ease both;
}

@keyframes fade {
	from {
		opacity: 0;
		transform: translateY(6px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.my-wrapper {
	padding-bottom: 24px;
}

.gradient-header {
	/* 顶部加入状态栏 + 导航高度的额外填充使其与透明导航融合 */
	--nav-height: 52px; /* 估算实际导航高度（含 safe area 占位后可调） */
	padding-top: calc(var(--nav-height) + env(safe-area-inset-top));
	height: 150px; /* 原 90 增高拉出更平滑的过渡 */
	background: linear-gradient(135deg, #0b3d91 0%, #00b3a6 65%);
	border-bottom-left-radius: 32% 28%;
	border-bottom-right-radius: 32% 28%;
	filter: saturate(118%) brightness(1.02);
	position: relative;
	overflow: hidden;
	box-shadow: 0 12px 28px -6px rgba(11, 61, 145, 0.35),
		0 4px 12px rgba(0, 0, 0, 0.18);
}
.gradient-header::before {
	content: "";
	position: absolute;
	inset: 0;
	background: radial-gradient(
			circle at 24% 18%,
			rgba(255, 255, 255, 0.28),
			rgba(255, 255, 255, 0) 55%
		),
		radial-gradient(
			circle at 78% 30%,
			rgba(255, 255, 255, 0.18),
			rgba(255, 255, 255, 0) 60%
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
	height: 42px;
	background: linear-gradient(
		180deg,
		rgba(255, 255, 255, 0.15),
		rgba(255, 255, 255, 0)
	);
	mix-blend-mode: soft-light;
}

.nav-icon {
	position: relative;
	width: 36px;
	height: 36px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav-badge {
	position: absolute;
	top: -4px;
	right: -4px;
	background: #ff3b30;
	color: #fff;
	font-size: 10px;
	line-height: 16px;
	padding: 0 5px;
	border-radius: 10px;
}

.profile-card {
	margin: -60px 12px 0;
	padding-top: 8px;
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.avatar {
	display: flex;
	justify-content: center;
	margin-top: 8px;
}

.avatarIcon {
	width: 100px;
	height: 100px;
	border-radius: 50%;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #0b3d91, #00b3a6);
	color: #fff;
	font-size: 34px;
	font-weight: 600;
}

.avatar-img {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	display: block;
}

.avatar-fallback {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
}

.name-block {
	text-align: center;
	margin: 8px 0 12px;
}

.app-badge {
	display: inline-flex;
	margin-top: 8px;
	padding: 4px 10px;
	font-size: 12px;
	background: rgba(11, 61, 145, 0.08);
	color: #0b3d91;
	border: 1px solid rgba(11, 61, 145, 0.18);
	border-radius: 999px;
}
.info-items {
	margin: 8px 12px 4px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.info-item {
	position: relative;
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 12px;
	padding: 10px 12px 10px 16px;
	background: linear-gradient(180deg, #ffffffb8, #ffffff94);
	backdrop-filter: blur(10px);
	border: 1px solid rgba(17, 24, 39, 0.08);
	border-radius: 14px;
	box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.info-item::before {
	content: "";
	position: absolute;
	left: 0;
	top: 8px;
	bottom: 8px;
	width: 3px;
	border-radius: 2px;
	background: linear-gradient(180deg, #0b3d91, #00b3a6);
	opacity: 0.55;
}

.info-label {
	display: flex;
	align-items: center;
	font-size: 13px;
	font-weight: 600;
	gap: 4px;
	color: #111827;
}

.info-value {
	font-size: 13px;
	color: #555;
	flex: 1;
	min-width: 0;
	text-align: right;
	word-break: break-all;
	white-space: normal;
}

.actions {
	margin: 18px 12px 0;
	display: flex;
	flex-direction: column;
}

.action-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	margin-bottom: 12px;
	background: linear-gradient(180deg, #ffffffc4, #ffffff98);
	border: 1px solid rgba(17, 24, 39, 0.08);
	border-radius: 16px;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
	transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.action-item:active {
	transform: translateY(1px);
	box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
}

.action-label {
	font-size: 14px;
	font-weight: 600;
	color: #111827;
}

.action-right {
	display: flex;
	align-items: center;
	gap: 6px;
}

.outlog-btn {
	padding: 24px 12px 32px;
}

/* 暗色模式 */
[data-theme="dark"] .profile-card {
	background: linear-gradient(180deg, #1f2937, #111827);
	box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
}

[data-theme="dark"] .info-item {
	background: linear-gradient(180deg, #1f2937cc, #111827cc);
	border-color: #374151;
}

[data-theme="dark"] .action-item {
	background: linear-gradient(180deg, #1f2937cc, #111827cc);
	border-color: #374151;
}

[data-theme="dark"] .action-label {
	color: #f3f4f6;
}
</style>
