<template>
	<PageLayout title="选择备件" :show-back="true">
		<view class="spare-picker">
			<view v-if="isLoading" class="spare-picker__loading">加载中...</view>
			<view v-else-if="!options.length" class="spare-picker__empty">
				暂无备件数据
			</view>
			<template v-else>
				<view class="spare-picker__search">
					<sar-search
						v-model="searchKeyword"
						placeholder="搜索备件名称"
						shape="round"
						clearable
					/>
				</view>
				<view class="spare-picker__list">
					<view
						v-for="item in filteredOptions"
						:key="item.spareId"
						class="spare-picker__item"
					>
						<view class="spare-picker__item-main">
							<sar-checkbox
								:model-value="isSelected(item.spareId)"
								@update:model-value="(val) => toggleSelect(item.spareId, val)"
							>
								<view class="spare-picker__item-info">
									<text class="spare-picker__item-name">{{ item.spareName }}</text>
									<text class="spare-picker__item-qty"
										>可用: {{ item.quantity }}</text
									>
								</view>
							</sar-checkbox>
						</view>
						<view class="spare-picker__item-input">
							<sar-input
								type="number"
								inputmode="numeric"
								placeholder="数量"
								:model-value="String(quantities[item.spareId] || '')"
								@update:model-value="(val) => updateQuantity(item.spareId, val)"
								@focus="ensureSelected(item.spareId)"
							/>
						</view>
					</view>
				</view>
			</template>
		</view>

		<view class="spare-picker__footer">
			<sar-button block theme="primary" @tap="handleConfirm">
				确定 (已选{{ selectedCount }}件)
			</sar-button>
		</view>
	</PageLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref, onMounted } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { getPartsManagementlist } from "@/api/order";
import { toast } from "sard-uniapp";

interface SpareOption {
	spareId: string;
	spareName: string;
	quantity: number;
}

const options = ref<SpareOption[]>([]);
const isLoading = ref(false);
const searchKeyword = ref("");
const selected = ref<Set<string>>(new Set());
const quantities = ref<Record<string, string>>({});
const initialData = ref<any[]>([]);

const filteredOptions = computed(() => {
	if (!searchKeyword.value) return options.value;
	const keyword = searchKeyword.value.toLowerCase();
	return options.value.filter((item) =>
		item.spareName.toLowerCase().includes(keyword)
	);
});

const selectedCount = computed(() => selected.value.size);

function isSelected(spareId: string) {
	return selected.value.has(spareId);
}

function toggleSelect(spareId: string, checked: boolean) {
	if (checked) {
		selected.value.add(spareId);
		// 如果还没有数量，设置默认数量为1
		if (!quantities.value[spareId]) {
			quantities.value[spareId] = "1";
		}
	} else {
		selected.value.delete(spareId);
		delete quantities.value[spareId];
	}
	// 触发响应式更新
	selected.value = new Set(selected.value);
	quantities.value = { ...quantities.value };
}

function ensureSelected(spareId: string) {
	if (!selected.value.has(spareId)) {
		selected.value.add(spareId);
		selected.value = new Set(selected.value);
	}
}

function updateQuantity(spareId: string, value: string) {
	const sanitized = String(value || "").replace(/[^0-9]/g, "");
	const option = options.value.find((opt) => opt.spareId === spareId);
	if (!option) return;

	const num = Number(sanitized);
	const maxAvailable = Number(option.quantity || 0);

	if (sanitized && num > maxAvailable) {
		toast(`最大可选数量为 ${maxAvailable}`);
		quantities.value[spareId] = String(maxAvailable);
	} else {
		quantities.value[spareId] = sanitized;
	}
	quantities.value = { ...quantities.value };
}

async function loadOptions() {
	isLoading.value = true;
	try {
		const resp = await getPartsManagementlist({});
		options.value = resp
			.map((item: any) => {
				const spareId = String(item?.id || item?.materialCode || "");
				if (!spareId) return null;
				const spareName = item?.spareName || item?.materialName || "";
				if (!spareName) return null;
				const baseQty = Number(item?.spareNum || item?.quantity || 0);
				const quantity = Number.isFinite(baseQty) && baseQty > 0 ? baseQty : 0;
				return { spareId, spareName, quantity };
			})
			.filter(Boolean);
	} catch (error) {
		console.error("[SparePartPicker] 加载失败", error);
		toast("备件数据加载失败");
		options.value = [];
	} finally {
		isLoading.value = false;
	}
}

function restoreSelection() {
	if (!initialData.value || !initialData.value.length) return;

	initialData.value.forEach((item) => {
		if (!item?.spareId) return;
		const spareId = String(item.spareId);
		selected.value.add(spareId);
		if (item.spareNum) {
			quantities.value[spareId] = String(item.spareNum);
		}
	});
	selected.value = new Set(selected.value);
	quantities.value = { ...quantities.value };
}

function handleConfirm() {
	if (!selected.value.size) {
		toast("请选择备件");
		return;
	}

	// 验证所有选中项都有数量
	const invalidItems: string[] = [];
	const result: any[] = [];

	selected.value.forEach((spareId) => {
		const option = options.value.find((opt) => opt.spareId === spareId);
		if (!option) return;

		const qty = Number(quantities.value[spareId] || 0);
		if (qty <= 0) {
			invalidItems.push(option.spareName);
			return;
		}

		result.push({
			spareId: option.spareId,
			spareName: option.spareName,
			quantity: option.quantity,
			spareNum: qty,
		});
	});

	if (invalidItems.length > 0) {
		toast(`请填写以下备件的数量：${invalidItems.join("、")}`);
		return;
	}

	if (!result.length) {
		toast("请选择备件并填写数量");
		return;
	}

	// 通过 eventChannel 返回数据
	const eventChannel = uni.getOpenerEventChannel?.();
	if (eventChannel) {
		eventChannel.emit("selectSpares", result);
	}

	uni.navigateBack();
}

onLoad((options: any) => {
	// 接收初始数据
	const eventChannel = uni.getOpenerEventChannel?.();
	if (eventChannel) {
		eventChannel.on?.("initialData", (data: any) => {
			console.log("[SparePartPicker] 接收初始数据:", data);
			initialData.value = Array.isArray(data) ? data : [];
		});
	}

	loadOptions().then(() => {
		restoreSelection();
	});
});
</script>

<style scoped lang="scss">
.spare-picker {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	background: #f5f5f5;
	padding-bottom: 120rpx;
}

.spare-picker__loading,
.spare-picker__empty {
	text-align: center;
	padding: 80rpx 32rpx;
	color: #999;
	font-size: 28rpx;
}

.spare-picker__search {
	padding: 20rpx 32rpx;
	background: #fff;
	border-bottom: 1rpx solid #eee;
}

.spare-picker__list {
	flex: 1;
	padding: 20rpx 0;
}

.spare-picker__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 32rpx;
	background: #fff;
	border-bottom: 1rpx solid #f0f0f0;
	gap: 24rpx;
}

.spare-picker__item-main {
	flex: 1;
	min-width: 0;
}

.spare-picker__item-info {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.spare-picker__item-name {
	font-size: 30rpx;
	color: #333;
	font-weight: 500;
}

.spare-picker__item-qty {
	font-size: 24rpx;
	color: #999;
}

.spare-picker__item-input {
	width: 160rpx;
	flex-shrink: 0;
}

.spare-picker__footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 24rpx 32rpx;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	background: #fff;
	border-top: 1rpx solid #eee;
	z-index: 100;
}
</style>
