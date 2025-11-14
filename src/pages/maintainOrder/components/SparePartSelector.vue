<template>
	<sar-popout
		v-model:visible="visible"
		title="选择备件"
		type="loose"
		:show-cancel="false"
		:show-close="true"
		:before-close="handlePopConfirm"
		:overlay-closable="true"
	>
		<view class="spare-select">
			<view v-if="isLoading" class="spare-select__loading">加载中...</view>
			<view v-else-if="!computedOptions.length" class="spare-select__empty">
				暂无备件数据
			</view>
			<template v-else>
				<sar-checkbox-group v-model="innerSelected">
					<view
						v-for="item in displayedOptions"
						:key="item.spareId"
						class="spare-select__item"
					>
						<sar-checkbox :value="item.spareId">
							{{ item.spareName }} / 可用: {{ item.quantity }}
						</sar-checkbox>
						<sar-input
							class="spare-select__qty"
							type="number"
							inputmode="numeric"
							placeholder="数量"
							:model-value="String(pendingInput[item.spareId] ?? '')"
							@update:model-value="(val) => updateQuantity(item.spareId, val)"
						/>
					</view>
				</sar-checkbox-group>
			</template>
		</view>
		<sar-toast-agent />
	</sar-popout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onBeforeUnmount, ref, watch } from "vue";
import Toast from "sard-uniapp/components/toast/toast.vue";
import ToastAgent from "sard-uniapp/components/toast-agent/toast-agent.vue";
import { toast } from "sard-uniapp";

interface SpareOption {
	spareId?: string;
	spareName?: string;
	quantity?: number | string;
	spareNum?: number | string;
	value?: string;
	label?: string;
}

type NormalizedOption = {
	spareId: string;
	spareName: string;
	quantity?: number | string;
	spareNum?: number | string;
};

// 修复：confirm 回调应该直接接收 payloadList，而不是 (type, payload) 格式
type ConfirmCloseHandler = (
	payload: Array<{
		spareId: string;
		spareName: string;
		quantity: number | string;
		spareNum: number;
	}>
) => boolean | Promise<boolean>;

type ConfirmPayloadItem = {
	spareId: string;
	spareName: string;
	quantity: number | string;
	spareNum: number;
};

const props = defineProps<{
	modelValue?: Array<{
		spareId: string;
		spareName: string;
		quantity: number | string;
		spareNum: number | string;
	}>;
	visible?: boolean;
	options?: SpareOption[];
	loading?: boolean;
	fetcher?: () => Promise<SpareOption[]>;
	confirm?: ConfirmCloseHandler;
	autoFetch?: boolean;
}>();
// spareId, spareName, quantity, spareNum
const emit = defineEmits<{
	(
		e: "update:modelValue",
		v:
			| Array<{
					spareId: string;
					spareName: string;
					quantity: number | string;
					spareNum: number | string;
			  }>
			| undefined
	): void;
	(e: "update:visible", v: boolean): void;
	(e: "fetch-error", err: unknown): void;
	(e: "confirm", payload: ConfirmPayloadItem[]): void;
}>();

const innerSelected = ref<string[]>([]);
const innerQuantities = ref<Record<string, number | string>>({});
const pendingInput = ref<Record<string, string>>({});
const visible = computed({
	get: () => !!props.visible,
	set: (val: boolean) => emit("update:visible", val),
});

const internalOptions = ref<SpareOption[]>([]);
const internalLoading = ref(false);
const autoFetch = computed(() => props.autoFetch !== false);
const submitting = ref(false);

function normalizeOption(
	raw: SpareOption | undefined | null
): NormalizedOption | null {
	if (!raw) return null;
	const spareId = raw.spareId ?? raw.value;
	const spareName = raw.spareName ?? raw.label;
	if (!spareId || !spareName) return null;
	return {
		spareId: String(spareId),
		spareName: String(spareName),
		quantity: raw.quantity,
		spareNum: raw.spareNum,
	};
}

const computedOptions = computed<NormalizedOption[]>(() => {
	const source = props.options?.length ? props.options : internalOptions.value;
	return source
		.map((item) => normalizeOption(item))
		.filter((item): item is NormalizedOption => !!item);
});

const displayedOptions = ref<NormalizedOption[]>([]);
const CHUNK_SIZE = 80;
let renderTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDisplay(list: NormalizedOption[]) {
	if (renderTimer) {
		clearTimeout(renderTimer);
		renderTimer = null;
	}

	displayedOptions.value = [];
	if (!list.length) return;

	let index = 0;

	const appendChunk = () => {
		const nextSlice = list.slice(index, index + CHUNK_SIZE);
		if (nextSlice.length) {
			displayedOptions.value =
				index === 0
					? nextSlice
					: displayedOptions.value.concat(nextSlice);
			index += CHUNK_SIZE;
		}

		if (index < list.length) {
			renderTimer = setTimeout(appendChunk, 16);
		} else {
			renderTimer = null;
		}
	};

	appendChunk();
}

onBeforeUnmount(() => {
	if (renderTimer) {
		clearTimeout(renderTimer);
		renderTimer = null;
	}
});

watch(
	() => props.modelValue,
	(val) => {
		const list = Array.isArray(val) ? val : [];

		// 回显已选项
		const selectedIds: string[] = [];
		const qty: Record<string, number | string> = {};
		const inputs: Record<string, string> = {};

		list.forEach((item) => {
			if (!item?.spareId) return;
			const id = String(item.spareId);
			qty[id] = Number(item.spareNum) || 0;
			// 回显到输入框
			if (item.spareNum) {
				inputs[id] = String(item.spareNum);
				selectedIds.push(id);
			}
		});

		innerSelected.value = selectedIds;
		innerQuantities.value = qty;
		pendingInput.value = inputs;
	},
	{ immediate: true, deep: true }
);

const isLoading = computed(() => props.loading ?? internalLoading.value);

watch(
	() => computedOptions.value,
	(list) => {
		scheduleDisplay(list);

		// 移除无效的选中项
		if (innerSelected.value.length) {
			innerSelected.value = innerSelected.value.filter((id) =>
				list.some((item) => item.spareId === id)
			);
		}
	},
	{ immediate: true }
);

watch(
	() => innerSelected.value,
	(selectedIds) => {
		// 确保选中的项都有输入框数据
		selectedIds.forEach((id) => {
			if (pendingInput.value[id] === undefined) {
				pendingInput.value = {
					...pendingInput.value,
					[id]: "",
				};
			}
		});
	},
	{ deep: true }
);

function updateQuantity(id: string, value: string) {
	const sanitized = String(value ?? "").replace(/[^0-9]/g, "");
	const option = computedOptions.value.find((opt) => opt.spareId === id);
	if (!option) return;

	const newValue = Number(sanitized);
	const maxAvailable = Number(option.quantity ?? 0);

	let final = "";
	if (sanitized && Number.isFinite(newValue) && newValue > 0) {
		// 不能超过最大可用数量
		if (newValue > maxAvailable) {
			toast(`最大可选数量为 ${maxAvailable}`);
			final = String(maxAvailable);
		} else {
			final = String(newValue);
		}
	}

	pendingInput.value = {
		...pendingInput.value,
		[id]: final,
	};
}

async function ensureOptions(force = false) {
	if (!props.fetcher) {
		console.log("[SparePartSelector] no fetcher provided");
		return;
	}
	if (
		!force &&
		(!autoFetch.value || computedOptions.value.length || isLoading.value)
	) {
		return;
	}
	try {
		internalLoading.value = true;
		const result = await props.fetcher();
		internalOptions.value = Array.isArray(result) ? result : [];
	} catch (error) {
		console.error("[SparePartSelector] fetcher error:", error);
		emit("fetch-error", error);
		internalOptions.value = [];
	} finally {
		internalLoading.value = false;
	}
}

watch(
	() => props.visible,
	(val) => {
		if (val) {
			const list = Array.isArray(props.modelValue) ? props.modelValue : [];
			// 回显已选项
			const selectedIds: string[] = [];
			const qty: Record<string, number | string> = {};
			const inputs: Record<string, string> = {};
			list.forEach((item) => {
				if (!item?.spareId) return;
				const id = String(item.spareId);
				qty[id] = Number(item.spareNum) || 0;
				// 回显到输入框
				if (item.spareNum) {
					inputs[id] = String(item.spareNum);
					selectedIds.push(id);
				}
			});

			innerSelected.value = selectedIds;
			innerQuantities.value = qty;
			pendingInput.value = inputs;

			ensureOptions(true);
		}
	},
	{ immediate: true, deep: true }
);

watch(
	() => props.fetcher,
	() => {
		if (visible.value) ensureOptions();
	}
);

function parseQuantity(raw: any, fallback: number): number {
	const num = Number(raw);
	if (!Number.isFinite(num) || num <= 0) return fallback;
	return num;
}

async function handlePopConfirm(type: "confirm" | "cancel" | "close") {
	if (type !== "confirm") {
		return true;
	}

	if (submitting.value) return false;

	// 验证选中项
	if (!innerSelected.value.length) {
		toast("请选择备件");
		return false;
	}

	// 验证所有选中项都有数量
	const invalidItems: string[] = [];
	const payloadList: ConfirmPayloadItem[] = [];
	console.log('[SparePartSelector] innerSelected:', innerSelected.value);
	console.log('[SparePartSelector] computedOptions:', computedOptions.value);
	console.log('[SparePartSelector] pendingInput:', pendingInput.value);
	
	for (const spareId of innerSelected.value) {
		const option = computedOptions.value.find((opt) => opt.spareId === spareId);
		console.log(`[SparePartSelector] 处理 spareId=${spareId}, option=`, option);
		if (!option) {
			console.log(`[SparePartSelector] 未找到 option for ${spareId}`);
			continue;
		}

		const inputQty = pendingInput.value[spareId];
		console.log(`[SparePartSelector] inputQty for ${spareId}:`, inputQty);
		const qty = parseQuantity(inputQty, 0);
		console.log(`[SparePartSelector] parsed qty for ${spareId}:`, qty);

		if (qty <= 0) {
			console.log(`[SparePartSelector] qty <= 0, 添加到 invalidItems: ${option.spareName}`);
			invalidItems.push(option.spareName);
			continue;
		}

		const maxAvailable = Number(option.quantity ?? 0);
		if (qty > maxAvailable) {
			toast(`${option.spareName} 数量不能超过 ${maxAvailable}`);
			return false;
		}

		payloadList.push({
			spareId: option.spareId,
			spareName: option.spareName,
			quantity: option.quantity ?? qty,
			spareNum: qty,
		});
		console.log(`[SparePartSelector] 添加到 payloadList:`, {
			spareId: option.spareId,
			spareName: option.spareName,
			quantity: option.quantity ?? qty,
			spareNum: qty,
		});
	}

	console.log('[SparePartSelector] 最终 payloadList:', payloadList);
	console.log('[SparePartSelector] invalidItems:', invalidItems);

	if (invalidItems.length > 0) {
		toast(`请填写以下备件的数量：${invalidItems.join("、")}`);
		return false;
	}

	if (!payloadList.length) {
		toast("请选择备件并填写数量");
		return false;
	}

	// 调用 confirm 回调
	if (typeof props.confirm === "function") {
		try {
			submitting.value = true;
			// 直接传入 payloadList，不需要 type 参数
			const result = await props.confirm(payloadList);
			console.log('[SparePartSelector] confirm 回调返回:', result);

			if (result === false) {
				return false;
			}
		} catch (error) {
			console.error("[SparePartSelector] confirm failed", error);
			return false;
		} finally{
			submitting.value = false;
		}
	}

	emit("confirm", payloadList);

	// 清空选择和输入
	innerSelected.value = [];
	pendingInput.value = {};

	return true;
}
</script>

<style scoped lang="scss">
.spare-select {
	max-height: 60vh;
	overflow: auto;
	padding: 12px 20px 20px;
}
.spare-select__loading,
.spare-select__empty {
	text-align: center;
	padding: 40px 0;
	color: #64748b;
	font-size: 14px;
}
.spare-select__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 0;
	border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.spare-select__item:last-child {
	border-bottom: none;
}
.spare-select__qty {
	width: 90px;
	margin-left: 12px;
}
.spare-select__actions {
	width: 100%;
	padding: 12px;
}
</style>
