<template>
	<PageLayout title="设备报修" :show-back="true" :safe-bottom="true">
		<CForm
			ref="cFormRef"
			v-model="formData"
			:schema="schema"
			@submit="handleSubmit"
			@change="handleChange"
		/>
	</PageLayout>
</template>
<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted, nextTick } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { CForm } from "@/components/c-form";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { repairFormSchema } from "./formSchema";
import { http } from "@/utils/request";
import { equipmentRepaircommit } from "@/api/order";
import { formatDateTime } from "@/utils/date";
import { pad } from "@/utils/format";


const formData = ref<Record<string, any>>({
	checkNo: "",
	equipmentName: "",
	equipmentCode: "",
	factoryName: "",
	warnDesc: "",
	warnType: "",
	faultDesc: "",
	expectRepairTime: formatDateTime(Date.now()),
	problemDetail: "",
	imagePath: [],
});

const cFormRef = ref<any>();

const schema = repairFormSchema;

// 说明：该页面使用 PageLayout 统一导航与安全区；若后续需要在导航右侧增加操作按钮，可使用 <template #nav-right> 插槽

const EQUIPMENT_INFO_API = "/equipment/equipmentInfo/queryEquipmentCode";
// 简单的请求序号用于避免并发查询时旧结果覆盖新结果
let equipmentCodeRequestId = 0;

function normalizeImagePathList(input: any): string {
	if (!input) return "";
	const list = Array.isArray(input) ? input : [input];
	const normalized = list
		.map((item: any) => {
			if (!item) return "";
			if (typeof item === "string") return item.trim();
			return (
				item.url ||
				item.resultUrl ||
				item.originUrl ||
				(item.response && (item.response.url || item.response.data)) ||
				""
			);
		})
		.map((url: any) => (typeof url === "string" ? url.trim() : ""))
		.filter((url: string) => !!url);
	return normalized.join(",");
}

async function handleSubmit(data: Record<string, any>) {
	const valid = await cFormRef.value?.validate?.();
	if (!valid) return;
	const payload = {
		...data,
		imagePath: normalizeImagePathList(data?.imagePath),
		checkNo: formData.value.checkNo || "",
	};

	try {
		uni.showLoading({ title: "提交中", mask: true });
		await equipmentRepaircommit(payload);
		uni.hideLoading();
		uni.showToast({ title: "提交成功", icon: "success" });
		setTimeout(() => uni.navigateBack(), 500);
	} catch (e: any) {
		uni.hideLoading();
		const message = e?.msg || e?.message || "提交失败";
		uni.showToast({ title: message, icon: "none" });
	}
}

function handleChange(prop: string, value: any) {

	if (prop === "equipmentCode") {
		updateEquipmentInfoByCode(value);
	}
}

async function updateEquipmentInfoByCode(rawCode: any) {
	const requestId = ++equipmentCodeRequestId;
	const raw =
		typeof rawCode === "string"
			? rawCode
			: rawCode == null
			? ""
			: String(rawCode);
	const code = raw.trim();

	if (!code) {
		if (requestId === equipmentCodeRequestId) {
			applyEquipmentName("");
		}
		return;
	}

	try {
		const resp: any = await queryEquipmentCode({ equipmentCode: code });
		if (requestId !== equipmentCodeRequestId && !resp) return;
		const equipmentName = resp?.equipmentName ?? "";
		const factoryName = resp?.factoryName ?? "";
		applyEquipmentName(equipmentName);
		applyFactoryName(factoryName);
	} catch (error: any) {
		if (requestId !== equipmentCodeRequestId) return;
		applyEquipmentName("");
		const message = error?.msg || error?.message;
		uni.showToast({
			title: message || "设备信息获取失败",
			icon: "none",
		});
	}
}

function applyEquipmentName(name: string) {
	const finalName = name || "";
	formData.value.equipmentName = finalName;
	cFormRef.value?.setValue?.("equipmentName", finalName);
}

function applyFactoryName(name: string) {
	const finalName = name || "";
	formData.value.factoryName = finalName;
	cFormRef.value?.setValue?.("factoryName", finalName);
}

function queryEquipmentCode(params: { equipmentCode: string }) {
	return http.post(EQUIPMENT_INFO_API, params);
}

async function preloadFaultDepartment() {
	try {
		const data: any = await http.get("/system/user/getInfo");
		const fullName = data?.user?.costDepartment?.fullName || "";
		if (!fullName) return;
		formData.value.faultDesc = fullName;
		await nextTick();
		// cFormRef.value?.setValue?.("faultDesc", fullName);
	} catch (error) {
		console.warn("[repair] preload fault department failed", error);
	}
}

onMounted(() => {
	preloadFaultDepartment();
});

onLoad((options: Record<string, any>) => {
	const mtNo = options?.mtNo ? String(options.mtNo) : "";
	const eqCode = options?.eqCode ? String(options.eqCode) : "";
	const eqName = options?.eqName ? String(options.eqName) : "";
	if (mtNo) {
		formData.value.checkNo = mtNo;
	}
	if (eqCode) {
		formData.value.equipmentCode = eqCode;
		nextTick(() => {
			cFormRef.value?.setValue?.("equipmentCode", eqCode);
		});
	}
	if (eqName) {
		applyEquipmentName(eqName);
	} else if (eqCode) {
		updateEquipmentInfoByCode(eqCode);
	}
});
</script>
