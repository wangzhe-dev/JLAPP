<template>
	<view class="change-parts">
		<view v-if="!items.length" class="change-parts__empty">暂无备件记录</view>
		<sar-list v-else card>
			<sar-list-item
				v-for="item in items"
				:key="item.spareId || item.spareName"
				style="padding: 0"
			>
				<sar-swipe-action>
					<view class="change-parts__item">
						<text class="change-parts__name">{{ item.spareName }}</text>
						<text class="change-parts__qty">x{{ item.spareNum }}</text>
					</view>
					<template #right="{ hide }">
						<sar-button
							theme="danger"
							square
							inline
							style="height: 100%"
							:loading="loading"
							@click="onRemove(item, hide)"
						>
							删除
						</sar-button>
						<sar-button
							theme="primary"
							square
							inline
							style="height: 100%"
							@click="hide"
						>
							取消
						</sar-button>
					</template>
				</sar-swipe-action>
			</sar-list-item>
		</sar-list>
	</view>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref } from "vue";
import { dialog } from "sard-uniapp";

const props = defineProps<{
	items: Array<{
		spareId: string;
		spareName: string;
		spareNum: number | string;
	}>;
}>();

const emit = defineEmits<{
	(
		e: "remove",
		item: { spareId: string; spareName: string; spareNum: number | string }
	): void;
}>();

const loading = ref(false);

const asyncWait = (ms = 0) =>
	new Promise((resolve) => {
		if (!ms) resolve(void 0);
		else setTimeout(resolve, ms);
	});

async function onRemove(item: any, hide?: () => void) {
	console.log(item, "aaaaaaaaaaaa");
	// try {
	//   await dialog.confirm("确定删除该备件？");
	// } catch {
	//   hide?.();
	//   return;
	// }
	loading.value = true;
	emit("remove", item);
	await asyncWait(50);
	loading.value = false;
	hide?.();
}
</script>

<style scoped lang="scss">
.change-parts {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.change-parts__hint {
	font-size: 12px;
	color: #6b7280;
}

.change-parts__empty {
	padding: 32rpx;
	font-size: 28rpx;
	color: #9ca3af;
	background: #f9fafb;
	border-radius: 16rpx;
	text-align: center;
}

.change-parts__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 32rpx;
	border-radius: 16rpx;
	background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
	border: 1rpx solid #e5e7eb;
	transition: all 0.3s ease;
}

.change-parts__name {
	font-size: 30rpx;
	font-weight: 600;
	color: #1f2937;
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.change-parts__qty {
	font-size: 28rpx;
	font-weight: 500;
	color: #10b981;
	background: rgba(16, 185, 129, 0.1);
	padding: 8rpx 16rpx;
	border-radius: 8rpx;
	margin-left: 16rpx;
	flex-shrink: 0;
}
</style>
