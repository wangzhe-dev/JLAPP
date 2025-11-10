<template>
	<view class="image-grid" v-if="items.length">
		<view
			v-for="(item, index) in items"
			:key="item.id || index"
			class="image-grid__item"
			@click="preview(index)"
		>
			<image
				:src="item.src"
				mode="aspectFill"
				class="image-grid__img"
			/>
		</view>
	</view>
</template>
<script setup lang="ts">
// @ts-nocheck
import { toRefs } from "vue";

const props = defineProps<{
	items: { id?: string | number; src: string }[];
}>();

const { items } = toRefs(props);

function preview(index: number) {
	const urls = (items.value || []).map((item) => item.src);
	if (!urls.length) return;
	uni.previewImage({
		urls,
		current: index,
	});
}
</script>
<style scoped lang="scss">
.image-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
}

.image-grid__item {
	width: 96px;
	height: 96px;
	border-radius: 8px;
	overflow: hidden;
	background: #f3f4f6;
}

.image-grid__img {
	width: 100%;
	height: 100%;
	display: block;
}
</style>
