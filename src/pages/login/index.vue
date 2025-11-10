<template>
	<div class="wrapper">
		<div class="content-forms-box-bg">
			<div class="content-forms">
				<div class="content-forms-title">
					<div class="content-title-bg" />
					<div class="content-forms-title-text">
						<span class="title-main">MOM系统</span>
					</div>
				</div>
				<div class="content-forms-center">
					<sar-form :model="form" ref="formRef" :rules="rules">
						<sar-form-item label="用户名" name="userName">
							<sar-input
								v-model="form.userName"
								placeholder="请输入用户名"
								clearable
							/>
						</sar-form-item>
						<sar-form-item label="密码" name="password">
							<sar-input
								v-model="form.password"
								placeholder="请输入密码"
								type="password"
								clearable
							/>
						</sar-form-item>
					</sar-form>
					<div class="privacy-rememberPassword">
						<sar-checkbox
							v-model:checked="rememberMeBool"
							type="circle"
						>
							记住密码
						</sar-checkbox>
					</div>
					<div class="submit-btn">
						<sar-button
							class="primary-btn"
							:loading="loading"
							:disabled="loading"
							type="default"
							@click="submit"
							block
							round
						>
							登 录
						</sar-button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, nextTick } from "vue";
import { useUserStore } from "@/stores";
import type { Credentials as LoginParams } from "@/stores/user";
import { storage } from "@/utils/storage";
import { prefetchCrypto } from "@/utils/cryptoLazy";
const REMEMBER_KEY = "login:remember";

function setPersist(key: string, value: any, mode: "raw" | "json" = "json") {
	try {
		storage.set(key, value, mode);
	} catch {}
	if (typeof plus !== "undefined" && plus?.storage) {
		try {
			if (mode === "raw") plus.storage.setItem(key, String(value ?? ""));
			else plus.storage.setItem(key, JSON.stringify(value ?? null));
		} catch {}
	}
}

function getPersist<T = any>(
	key: string,
	mode: "raw" | "json" = "json"
): T | null {
	let result: any = null;
	try {
		result = storage.get<T>(key, mode);
	} catch {}
	if (
		(result === null || result === undefined) &&
		typeof plus !== "undefined" &&
		plus?.storage
	) {
		try {
			const raw = plus.storage.getItem(key);
			if (raw !== null && raw !== undefined) {
				result = mode === "raw" ? (raw as any) : JSON.parse(raw);
			}
		} catch {}
	}
	return result ?? null;
}

function removePersist(key: string) {
	try {
		storage.remove(key);
	} catch {}
	if (typeof plus !== "undefined" && plus?.storage) {
		try {
			plus.storage.removeItem(key);
		} catch {}
	}
}
import type { FormRules, FormExpose } from "sard-uniapp";

const userStore = useUserStore();
const loading = ref(false);
const formRef = ref<FormExpose>();
const form = reactive<LoginParams>({ userName: "", password: "" });
const parseRememberFlag = (value: unknown, fallback = false) => {
	if (value === null || value === undefined || value === "") return fallback;
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value === "string") {
		const lowered = value.toLowerCase().trim();
		return lowered === "1" || lowered === "true";
	}
	return fallback;
};
const rememberMeBool = ref(false);
const rememberMeValue = () => (rememberMeBool.value ? "1" : "0");

const rules = reactive<FormRules>({
	userName: [{ required: true, message: "请输入用户名", trigger: "blur" }],
	password: [{ required: true, message: "请输入密码", trigger: "blur" }],
});

 
async function doLogin() {
	loading.value = true;
	try {
		await userStore.loginAction({ ...form });
		// 记住密码逻辑
		setPersist("rememberMe", rememberMeValue(), "raw");
		setPersist("lastUserName", form.userName, "raw");

		if (rememberMeBool.value) {
			setPersist(
				REMEMBER_KEY,
				{
					remember: "1",
					userName: form.userName,
					password: form.password,
				},
				"json"
			);
			setPersist("password", form.password, "raw"); // 兼容旧逻辑
		} else {
			removePersist(REMEMBER_KEY);
			removePersist("password");
		}
		uni.showToast({ title: "登录成功", icon: "success" });
		// loginAction 已处理页面跳转
	} catch (e: any) {
		const msg = e?.raw?.data?.msg || e?.message || "登录失败";
		uni.showToast({ title: msg, icon: "none" });
	} finally {
		loading.value = false;
	}
}

const submit = () => {
	if (!formRef.value) return doLogin();
	formRef.value
		.validate()
		.then(doLogin)
		.catch(() => {});
};

onMounted(() => {
	// 如果已经登录（刷新后仍持久化），直接跳首页（双保险：守卫已做拦截）
	if (userStore.token) {
		setTimeout(() => uni.switchTab({ url: "/pages/index/index" }), 0);
		return;
	}
	nextTick(() => {
		const rememberPayload = getPersist<{
			remember?: string;
			userName?: string;
			password?: string;
		}>(REMEMBER_KEY);
		if (rememberPayload) {
			rememberMeBool.value = parseRememberFlag(
				rememberPayload.remember,
				true
			);
			if (rememberPayload.userName) form.userName = rememberPayload.userName;
			if (rememberPayload.password) form.password = rememberPayload.password;
		} else {
			const rm = getPersist<string>("rememberMe", "raw");
			rememberMeBool.value = parseRememberFlag(rm, false);
			const lastUser = getPersist<string>("lastUserName", "raw");
			if (lastUser) form.userName = lastUser;
			const plain = getPersist<string>("password", "raw");
			if (plain) form.password = plain;
		}
	});
	prefetchCrypto();
});
</script>

<style lang="scss" scoped>
.wrapper {
	position: relative;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	min-height: 100vh;
	padding: 80rpx 48rpx;
	background: linear-gradient(135deg, #0b3d91 0%, #0f7cc7 40%, #061f45 100%);
	box-sizing: border-box;
	overflow: hidden;
}
.wrapper::before,
.wrapper::after {
	content: "";
	position: absolute;
	border-radius: 999px;
	filter: blur(0);
	pointer-events: none;
}
.wrapper::before {
	width: 520rpx;
	height: 520rpx;
	background: radial-gradient(
		circle at 30% 30%,
		rgba(255, 255, 255, 0.28),
		rgba(255, 255, 255, 0)
	);
	top: -140rpx;
	right: -180rpx;
	opacity: 0.65;
}
.wrapper::after {
	width: 360rpx;
	height: 360rpx;
	background: radial-gradient(
		circle at 60% 60%,
		rgba(0, 179, 166, 0.3),
		rgba(0, 179, 166, 0)
	);
	bottom: -160rpx;
	left: -120rpx;
	opacity: 0.7;
}
// .primary-btn 全局样式已改在 uni.scss 中内联定义（theme.scss 已移除）
.content-forms-box-bg {
	width: 100%;
	max-width: 640rpx;
	// background: rgba(255, 255, 255, 0.08);
	// border: 1rpx solid rgba(255, 255, 255, 0.18);
	// border-radius: 28rpx;
	// padding: 12rpx;
	box-shadow: 0 20rpx 60rpx rgba(7, 27, 67, 0.28);
	// backdrop-filter: blur(12rpx);
}
.content-forms {
	max-width: 640rpx;
	background: rgba(255, 255, 255, 0.94);
	border-radius: 32rpx;
	overflow: hidden;
	box-shadow: 0 24rpx 48rpx rgba(7, 27, 67, 0.22),
		inset 0 1rpx 0 rgba(255, 255, 255, 0.65);
}
.content-forms-title {
	position: relative;
	display: flex;
	justify-content: center;
	align-items: center;
	height: 220rpx;
	background: linear-gradient(
		135deg,
		rgba(11, 61, 145, 0.92),
		rgba(0, 179, 166, 0.72)
	);
}
.content-title-bg {
	position: absolute;
	inset: 0;
	background: transparent;
}
.content-forms-title-text {
	position: relative;
	width: 100%;
	max-width: 560rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	color: #fff;
	text-align: center;
}
.title-logo {
	width: 112rpx;
	height: 112rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 32rpx;
	background: rgba(255, 255, 255, 0.18);
	border: 1rpx solid rgba(255, 255, 255, 0.35);
	font-size: 44rpx;
	font-weight: 700;
	letter-spacing: 6rpx;
	box-shadow: 0 16rpx 32rpx rgba(6, 31, 69, 0.32);
}
.title-main {
	font-size: 44rpx;
	font-weight: 700;
	letter-spacing: 4rpx;
}
.title-sub {
	font-size: 26rpx;
	font-weight: 500;
	opacity: 0.85;
}
.content-forms-center {
	padding: 48rpx 52rpx 46rpx;
	background: #ffffff;
}
.content-welcome {
	text-align: center;
	margin-bottom: 36rpx;
	color: #1c2440;
}
.content-welcome h2 {
	font-size: 40rpx;
	font-weight: 700;
	margin: 0 0 10rpx;
}
.content-welcome p {
	font-size: 28rpx;
	margin: 0;
	color: #5a6a8f;
}
.privacy-rememberPassword {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 16rpx;
	font-size: 26rpx;
	color: #5a6a8f;
	margin: 0 20px;
}
.submit-btn {
	margin-top: 44rpx;
}
.submit-btn .primary-btn {
	border-radius: 999rpx;
	height: 96rpx;
	font-size: 32rpx;
	font-weight: 600;
	// background: linear-gradient(135deg, #0b6ad9, #00b3a6);
	color: #fff;
	border: none;
	box-shadow: 0 12rpx 24rpx rgba(11, 61, 145, 0.22);
}
.submit-btn .primary-btn:active {
	transform: scale(0.99);
	transition: transform 120ms ease;
}

:deep(.sar-form-item) {
	margin-bottom: 28rpx;
}
:deep(.sar-form__label) {
	color: #2e3c5e;
	font-weight: 600;
}
:deep(.sar-input__wrapper) {
	background: #f4f7fb;
	border-radius: 16rpx;
	border: 1rpx solid #e1e8fb;
	padding: 22rpx 26rpx;
}
:deep(.sar-input__input) {
	font-size: 28rpx;
}
:deep(.sar-checkbox__icon) {
	border-color: rgba(11, 61, 145, 0.42);
}
:deep(.sar-checkbox__icon--checked) {
	background: linear-gradient(135deg, #0b3d91, #00b3a6);
	border-color: transparent;
}

@media (max-width: 480px) {
	.wrapper {
		padding: 60rpx 32rpx;
	}
	.content-forms-center {
		padding: 44rpx 32rpx 36rpx;
	}
	.content-forms-title-text {
		width: auto;
		padding-right: 24rpx;
	}
}
</style>
