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
	padding: 12px;
	font-size: 13px;
	color: #9ca3af;
	background: #f9fafb;
	border-radius: 10px;
}

.change-parts__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	border-radius: 10px;
	background: #f9fafb;
}

.change-parts__name {
	font-size: 14px;
	font-weight: 600;
	color: #1f2937;
}

.change-parts__qty {
	font-size: 12px;
	color: #6b7280;
}
</style>
