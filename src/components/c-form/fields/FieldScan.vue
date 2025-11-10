<script setup lang="ts">
// @ts-nocheck
// 使用官方 <sar-search> 组件包装扫码 + 手动输入：
// 交互：
// 1. 左侧按钮点击触发 uni.scanCode -> 回填结果
// 2. 用户可直接在输入框修改；修改实时 setValue
// 3. 右侧可扩展附加按钮 (camera 等) 通过 field.componentProps.appendButtons

import { ref, watch, inject } from "vue";
import { showModalAsync } from "@/utils/modal";
const props = defineProps<{
	field: any;
	state: any;
	disabled: boolean;
	setValue: (v: any) => void;
}>();

const inner = ref("");
function syncIn() {
	inner.value = props.state.value || "";
}
syncIn();
watch(() => props.state.value, syncIn);

function detectH5() {
	// #ifdef H5
	return true;
	// #endif
	return false;
}

function doScan() {
	if (props.disabled) return;
	const isH5 = detectH5();
	// 支持通过 componentProps.mockValue 提供一个调试值
	const mockVal = props.field.componentProps?.mockValue;

	// ============ 可选解析：将扫码文本拆成键值对并写入其它字段 ============
	function parseAndFillIfNeeded(rawText: string) {
		const cfg = props.field.componentProps?.parseTask;
		if (!cfg || cfg.enable === false) return;
		const fieldMap = cfg.fieldMap || {}; // { formFieldProp: '二维码里的标签(去空格)' }
		const splitter = cfg.splitter || /[\r\n]+/;
		const sepList = cfg.separators || ["：", ":"]; // 支持中英文冒号
		const lines = rawText
			.split(splitter)
			.map((l: string) => l.trim())
			.filter(Boolean);
		const kv: Record<string, string> = {};
		lines.forEach((line) => {
			for (const sp of sepList) {
				const idx = line.indexOf(sp);
				if (idx > 0) {
					const k = line.slice(0, idx).trim().replace(/\s+/g, "");
					const v = line.slice(idx + sp.length).trim();
					if (k) kv[k] = v;
					break;
				}
			}
		});
		// 通过 field.model 拿到外部 form model（CForm 在 buildFieldProps 已附加）
		const model = (props.field as any).model;
		// 同时尝试通过上下文 setValue 确保状态/校验联动
		const ctx: any = inject('CFormContext', null);
		Object.keys(fieldMap).forEach((formProp) => {
			const labelKey = fieldMap[formProp];
			if (labelKey && kv[labelKey] !== undefined) {
				if (model) model[formProp] = kv[labelKey];
				ctx?.setValue?.(formProp, kv[labelKey]);
			}
		});
		if (cfg.toast !== false)
			uni.showToast({ title: "扫码已解析", icon: "none" });
	}

	if (isH5) {
		// H5 场景下很多浏览器不支持直接调起原生扫码，这里给出 fallback
		if (mockVal) {
			inner.value = mockVal;
			props.setValue(mockVal);
			parseAndFillIfNeeded(mockVal);
			uni.showToast({ title: "已填入模拟码", icon: "none" });
		} else {
			showModalAsync({
				title: "提示",
				content:
					"当前浏览器不支持直接扫码，请手动输入或在真机/小程序中使用摄像头扫码。",
				showCancel: false,
				lock: false,
			}).catch(() => {});
		}
		return;
	}
	uni.scanCode({
		success: (r) => {
			inner.value = r.result;
			props.setValue(r.result);
			parseAndFillIfNeeded(r.result);
		},
		fail: () => {
			if (mockVal) {
				inner.value = mockVal;
				props.setValue(mockVal);
				parseAndFillIfNeeded(mockVal);
				uni.showToast({ title: "扫码失败，使用模拟值", icon: "none" });
			} else {
				uni.showToast({ title: "未能获取扫码结果", icon: "none" });
			}
		},
	});
}
function onInput(e: any) {
	const v = e?.detail?.value ?? e;
	inner.value = v;
	props.setValue(v);
}

// 附加按钮配置（可选）
// field.componentProps.appendButtons = [{ icon:'camera', onTap(){} }]
const appendButtons = props.field.componentProps?.appendButtons || [];
</script>
<template>
	<sar-input
		clearable
		inlaid
		:placeholder="field.placeholder || '请输入 / 扫码'"
		:model-value="inner"
		@update:model-value="onInput"
	>
		<template #append>
			<sar-button
				size="mini"
				:disabled="disabled"
				type="pale-text"
				@tap="doScan"
			>
				扫码
			</sar-button>
		</template>
	</sar-input>
</template>
