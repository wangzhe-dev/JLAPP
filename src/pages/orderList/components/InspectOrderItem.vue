<template>
	<view class="wo-item" @click="emit('view', item)">
		<CCard
			:key="item.id"
			class="wo-card"
			:title="item.title || item.mtNo || item.code || '工单#' + (item.id || '')"
			:extra="statusText"
			:tags="tags"
			:content="item.summary || item.remark || ''"
			:line-clamp="4"
			:title-clamp="2"
		>
			<template #actions v-if="showAnyAction">
				<sar-button
					v-if="canView"
					size="mini"
					inline
					variant="outline"
					@click.stop="emit('view', item)"
					>查看</sar-button
				>
				<sar-button
					v-if="canAccept"
					size="mini"
					inline
					variant="mild"
					class="btn-success"
					@click.stop="emit('accept', item)"
					>接单</sar-button
				>
				<sar-button
					v-if="canTransfer"
					size="mini"
					inline
					variant="outline"
					@click.stop="emit('transfer', item)"
					>转单</sar-button
				>
				<sar-button
					v-if="canInspect"
					size="mini"
					inline
					variant="mild"
					class="btn-primary"
					@click.stop="emit('inspect', item)"
					>进入点检</sar-button
				>
				<sar-button
					v-if="canToRepair"
					size="mini"
					variant="mild"
					inline
					class="btn-primary"
					@click.stop="emit('to-repair', item)"
					>在线维保</sar-button
				>
			</template>
		</CCard>
		<slot name="extra" :item="item" />
	</view>
</template>
<script setup lang="ts">
// @ts-nocheck
import { computed } from "vue";
import CCard from "@/components/c-card/CCard.vue";
interface OrderItem {
	[k: string]: any;
}
const props = defineProps<{
	item: OrderItem;
	statusTabs: any[];
	source: "1" | "2";
}>();
const emit = defineEmits([
	"view",
	"accept",
	"transfer",
	"inspect",
	"to-repair",
]);
const statusText = computed(() => {
	const st = props.item?.formStatus || props.item?.status;
	const found = props.statusTabs.find((t) => t.name === st);
	return found?.title || props.item?.statusText || st || "";
});
const tags = computed(() => {
	const arr: any[] = [];
	if (statusText.value) arr.push({ text: statusText.value, type: "primary" });
	if (props.item?.mtNo) arr.push({ text: props.item.mtNo, type: "info" });
	return arr;
});
const canView = true;
const canAccept = computed(
	() => props.source === "2" && ["1"].includes(props.item?.formStatus)
);
const canTransfer = computed(() => canAccept.value);
const canInspect = computed(() => ["2", "3"].includes(props.item?.formStatus));
const canToRepair = computed(() => ["7"].includes(props.item?.formStatus));
const showAnyAction = computed(
	() =>
		canView ||
		canAccept.value ||
		canTransfer.value ||
		canInspect.value ||
		canToRepair.value
);
</script>
<style scoped lang="scss">
// .wo-item {
// 	position: relative;
// }
// .wo-card {
// 	margin: 8px 12px 4px;
// }
// .btn-primary {
// 	--sar-button-bg: var(--app-primary, #0b3d91);
// 	--sar-button-color: #fff;
// }
// .btn-success {
// 	--sar-button-bg: #2eaf5d;
// 	--sar-button-color: #fff;
// }
</style>
