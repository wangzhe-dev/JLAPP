<template>
	<PageLayout title="精度填报" :show-back="true">
		<view class="jd-page">
			<scroll-view class="jd-scroll" scroll-y>
				<view v-if="loading" class="jd-loading">加载中...</view>
				<template v-else>
					<view v-if="mediaFiles.length" class="jd-section">
						<text class="jd-section__title">文件信息</text>
						<swiper
							class="jd-media"
							:indicator-dots="mediaFiles.length > 1"
							:circular="mediaFiles.length > 1"
						>
							<swiper-item
								v-for="(file, index) in mediaFiles"
								:key="file.url || index"
								class="jd-media__item"
								@tap="handlePreviewAttachment(file)"
							>
								<image
									v-if="file.type === 'image'"
									class="jd-media__image"
									:src="file.url"
									mode="aspectFit"
								/>
								<view v-else class="jd-media__placeholder">
									<text class="jd-media__name">{{ file.name }}</text>
									<text class="jd-media__hint">
										{{ file.type === "pdf" ? "点击预览文件" : "暂不支持预览" }}
									</text>
								</view>
							</swiper-item>
						</swiper>
					</view>

					<view class="jd-section">
						<text class="jd-section__title">基础信息</text>
						<CCard class="jd-card">
							<view class="jd-field">
								<text class="jd-field__label">质检单号</text>
								<text class="jd-field__value">
									{{ displayValue(form.qualityInspectionNumber) }}
								</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">加工单号</text>
								<text class="jd-field__value">{{ displayValue(form.workOrderNum) }}</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">产线名称</text>
								<text class="jd-field__value">
									{{ displayValue(form.productLineName) }}
								</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">工序名称</text>
								<text class="jd-field__value">{{ displayValue(form.processName) }}</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">船号</text>
								<text class="jd-field__value">{{ displayValue(form.shipNumber) }}</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">分段号</text>
								<text class="jd-field__value">{{ displayValue(form.blockCode) }}</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">零件号</text>
								<text class="jd-field__value">{{ displayValue(form.pnNumber) }}</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">检验形式</text>
								<text class="jd-field__value">
									{{ inspectionFormLabel || "-" }}
								</text>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">检验日期</text>
								<text class="jd-field__value">
									{{ displayValue(formatDate(form.inspecDate)) }}
								</text>
							</view>
						</CCard>
					</view>

					<view class="jd-section">
						<text class="jd-section__title">填报信息</text>
						<CCard class="jd-card">
							<view class="jd-field">
								<text class="jd-field__label">检验员名称</text>
								<template v-if="isViewMode">
									<text class="jd-field__value">
										{{ displayValue(form.inspectorName) }}
									</text>
								</template>
								<template v-else>
									<sar-input
										class="jd-input"
										:model-value="form.inspectorName"
										placeholder="请输入检验员名称"
										clearable
										@update:model-value="(val) => updateFormField('inspectorName', val)"
									/>
								</template>
							</view>
							<view class="jd-field">
								<text class="jd-field__label required">检测结论</text>
								<template v-if="isViewMode">
									<text
										:class="[
											'jd-result-chip',
											form.testConclusion === '1'
												? 'is-fail'
												: form.testConclusion === '0'
												? 'is-pass'
												: '',
										]"
									>
										{{ testConclusionLabel }}
									</text>
								</template>
								<template v-else>
									<radio-group
										class="jd-radio-group"
										@change="(ev) => onConclusionChange(ev.detail.value)"
									>
										<label
											v-for="option in STATUS_OPTIONS"
											:key="option.value"
											:class="[
												'jd-radio',
												form.testConclusion === option.value ? 'is-active' : '',
											]"
										>
											<radio
												:value="option.value"
												:checked="form.testConclusion === option.value"
												color="#2563eb"
											/>
											<text class="jd-radio__label">{{ option.label }}</text>
										</label>
									</radio-group>
								</template>
							</view>
							<view class="jd-field">
								<text class="jd-field__label">备注</text>
								<template v-if="isViewMode">
									<text class="jd-field__value multiline">
										{{ displayValue(form.remark) }}
									</text>
								</template>
								<template v-else>
									<textarea
										class="jd-textarea"
										:value="form.remark"
										maxlength="200"
										show-confirm-bar="false"
										placeholder="请输入备注"
										@input="(ev) => updateFormField('remark', ev.detail.value)"
									/>
								</template>
							</view>
						</CCard>
					</view>

					<view class="jd-section">
						<view class="jd-section__header">
							<text class="jd-section__title">检验记录</text>
							<CButton
								v-if="!isViewMode"
								type="primary"
								size="small"
								round
								throttle="400"
								@click="addRecord"
							>
								新增记录
							</CButton>
						</view>
						<view v-if="!records.length" class="jd-empty">暂无检验记录</view>
						<CCard
							v-for="(record, index) in records"
							:key="record._localId || index"
							class="jd-record-card"
							variant="outline"
						>
							<view class="jd-record-header">
								<text class="jd-record-title">记录 {{ index + 1 }}</text>
								<sar-button
									v-if="!isViewMode"
									type="danger"
									size="mini"
									inline
									plain
									@tap="removeRecord(index)"
								>
									删除
								</sar-button>
							</view>

							<view class="jd-field">
								<text class="jd-field__label required">检测内容</text>
								<template v-if="isEditable(record, 'inspectionContent')">
									<sar-input
										class="jd-input"
										:model-value="record.inspectionContent"
										placeholder="请输入检测内容"
										clearable
										@update:model-value="(val) =>
											updateRecordField(index, 'inspectionContent', val)"
									/>
								</template>
								<template v-else>
									<text class="jd-field__value multiline">
										{{ displayValue(record.inspectionContent) }}
									</text>
								</template>
							</view>

							<view class="jd-field">
								<text class="jd-field__label required">检测位置</text>
								<template v-if="isEditable(record, 'detectingLocation')">
									<sar-input
										class="jd-input"
										:model-value="record.detectingLocation"
										placeholder="请输入检测位置"
										clearable
										@update:model-value="(val) =>
											updateRecordField(index, 'detectingLocation', val)"
									/>
								</template>
								<template v-else>
									<text class="jd-field__value">
										{{ displayValue(record.detectingLocation) }}
									</text>
								</template>
							</view>

							<view class="jd-field">
								<text class="jd-field__label required">正公差</text>
								<template v-if="isEditable(record, 'tolerence')">
									<sar-input
										class="jd-input"
										type="digit"
										:model-value="record.tolerence"
										placeholder="请输入正公差"
										@update:model-value="(val) =>
											updateRecordField(index, 'tolerence', sanitizeNumber(val))"
										@blur="() => recalcRow(record)"
									/>
								</template>
								<template v-else>
									<text class="jd-field__value">
										{{ displayValue(record.tolerence) }}
									</text>
								</template>
							</view>

							<view class="jd-field">
								<text class="jd-field__label required">负公差</text>
								<template v-if="isEditable(record, 'negativeTolerance')">
									<sar-input
										class="jd-input"
										type="digit"
										:model-value="record.negativeTolerance"
										placeholder="请输入负公差"
										@update:model-value="(val) =>
											updateRecordField(
												index,
												'negativeTolerance',
												sanitizeNumber(val)
											)"
										@blur="() => recalcRow(record)"
									/>
								</template>
								<template v-else>
									<text class="jd-field__value">
										{{ displayValue(record.negativeTolerance) }}
									</text>
								</template>
							</view>

							<view class="jd-field">
								<text class="jd-field__label required">理论值</text>
								<template v-if="isEditable(record, 'theoreticalValue')">
									<sar-input
										class="jd-input"
										type="digit"
										:model-value="record.theoreticalValue"
										placeholder="请输入理论值"
										@update:model-value="(val) =>
											updateRecordField(
												index,
												'theoreticalValue',
												sanitizeNumber(val)
											)"
										@blur="() => recalcRow(record)"
									/>
								</template>
								<template v-else>
									<text class="jd-field__value">
										{{ displayValue(record.theoreticalValue) }}
									</text>
								</template>
							</view>

							<view class="jd-field">
								<text class="jd-field__label required">实际测量值</text>
								<template v-if="isEditable(record, 'checkDimensionalDeviation')">
									<sar-input
										class="jd-input"
										type="digit"
										:model-value="record.checkDimensionalDeviation"
										placeholder="请输入实际测量值"
										@update:model-value="(val) =>
											updateRecordField(
												index,
												'checkDimensionalDeviation',
												sanitizeNumber(val)
											)"
										@blur="() => recalcRow(record)"
									/>
								</template>
								<template v-else>
									<text class="jd-field__value">
										{{ displayValue(record.checkDimensionalDeviation) }}
									</text>
								</template>
							</view>

							<view class="jd-field">
								<text class="jd-field__label">判定结果</text>
								<text
									:class="[
										'jd-result-chip',
										record.resultStatus === '1'
											? 'is-fail'
											: record.resultStatus === '0'
											? 'is-pass'
											: '',
									]"
								>
									{{
										record.resultStatus === "1"
											? "不合格"
											: record.resultStatus === "0"
												? "合格"
												: "-"
									}}
								</text>
							</view>

							<view class="jd-field">
								<text class="jd-field__label">备注</text>
								<template v-if="isViewMode">
									<text class="jd-field__value multiline">
										{{ displayValue(record.remark) }}
									</text>
								</template>
								<template v-else>
									<textarea
										class="jd-textarea"
										:value="record.remark"
										:placeholder="isViewMode ? '-' : '请输入备注'"
										maxlength="150"
										@input="(ev) => updateRecordField(index, 'remark', ev.detail.value)"
									/>
								</template>
							</view>
						</CCard>
					</view>
				</template>
			</scroll-view>

			<view class="jd-actions">
				<view class="jd-actions__bar">
					<view
						v-if="!isViewMode"
						class="jd-actions__button"
						:class="{ 'is-disabled': saving }"
						@tap="handleSubmit"
					>
						<sar-button
							type="primary"
							round
							block
							:loading="saving"
							:disabled="saving"
						>
							保存
						</sar-button>
					</view>
					<view class="jd-actions__button jd-actions__button--secondary" @tap="goBack">
						<sar-button type="info" round block>返回</sar-button>
					</view>
				</view>
			</view>
		</view>
	</PageLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import CButton from "@/components/c-button/CButton.vue";
import CCard from "@/components/c-card/CCard.vue";
import { http } from "@/utils/request";
import { storage } from "@/utils/storage";
import { useUserStore } from "@/stores/user";
import { queryDictList as queryDictListBatch } from "@/api/dict";
import _ from "lodash";

interface AccuracyRecord {
	id?: string;
	inspectionContent: string;
	detectingLocation: string;
	tolerence: string;
	negativeTolerance: string;
	theoreticalValue: string;
	checkDimensionalDeviation: string;
	resultStatus: string;
	unit?: string;
	remark?: string;
	isNew?: boolean;
	_localId?: string;
}

interface AttachmentMeta {
	url: string;
	name: string;
	type: "image" | "pdf" | "other";
}

const STATUS_OPTIONS = Object.freeze([
	{ value: "0", label: "合格" },
	{ value: "1", label: "不合格" },
]);

const MINIO_HOST = import.meta.env.VITE_APP_MINIO_URL || "";

const loading = ref(false);
const saving = ref(false);
const pageMode = ref<"edit" | "view" | "plan">("edit");
const detailId = ref("");
const detailSheetNo = ref("");
const editSnapshot = ref<Record<string, any>>({});
const mediaFiles = ref<AttachmentMeta[]>([]);
const fileUrlStr = ref("");
const ruleTypeOptions = ref<any[]>([]);

const userStore = useUserStore();
const defaultInspectorName =
	storage.get<string>("lastUserName", "raw") || resolveUserName(userStore.userInfo);

const form = ref<Record<string, any>>({
	workOrderNum: "",
	productLineName: "",
	processName: "",
	processCode: "",
	qualityInspectionNumber: "",
	shipNumber: "",
	blockCode: "",
	pnNumber: "",
	inspectionForm: "",
	inspectorName: defaultInspectorName || "",
	inspecDate: "",
	testConclusion: "",
	remark: "",
});

const records = ref<AccuracyRecord[]>([]);

const isViewMode = computed(() => pageMode.value === "view");

const inspectionFormLabel = computed(() =>
	resolveOptionLabel(ruleTypeOptions.value, form.value.inspectionForm)
);
const testConclusionLabel = computed(() => {
	const option = STATUS_OPTIONS.find((item) => item.value === form.value.testConclusion);
	if (option) return option.label;
	if (form.value.testConclusion) return form.value.testConclusion;
	return "-";
});

onLoad(async (options: Record<string, any>) => {
	pageMode.value = resolveMode(options?.mode);
	detailId.value = options?.id ? decodeURIComponent(options.id) : "";
	detailSheetNo.value = options?.qualityInspectionNumber
		? decodeURIComponent(options.qualityInspectionNumber)
		: "";

	await loadDicts();
	applyLocalInspectorName();

	const prefill = resolvePrefill(options?.prefill);
	if (prefill) {
		pageMode.value = prefill._mode ?? pageMode.value;
		editSnapshot.value = _.cloneDeep(prefill);
		applyFormData(form.value, prefill);
		records.value = normalizeRecords(prefill.fillDetailList, { isNew: false });
		fileUrlStr.value = prefill.imageFile || "";
		if (fileUrlStr.value) applyAttachmentString(fileUrlStr.value);
	} else if (detailId.value) {
		await loadDetail(detailId.value, detailSheetNo.value);
	} else {
		records.value = [];
	}

	const processCode = resolveProcessCode(form.value);

	if (!records.value.length && processCode) {
		await loadProcessTemplate(processCode);
	}

	if (!mediaFiles.value.length && processCode) {
		await loadProcessAttachments(processCode);
	}

	if (!records.value.length && !isViewMode.value) {
		addRecord();
	}

	syncOverallConclusion();
});

function resolveMode(mode?: string) {
	if (mode === "view" || mode === "detail") return "view";
	if (mode === "planFill") return "plan";
	return "edit";
}

function resolvePrefill(prefill?: string) {
	if (!prefill) return null;
	try {
		const decoded = decodeURIComponent(prefill);
		return JSON.parse(decoded);
	} catch {
		return null;
	}
}

async function loadDicts() {
	try {
		const dictMap = await queryDictListBatch(["rule_type"]);
		ruleTypeOptions.value = Array.isArray(dictMap?.rule_type) ? dictMap.rule_type : [];
	} catch (error) {
		console.error("[accuracyFill] load dictionaries error", error);
		ruleTypeOptions.value = [];
	}
}

async function loadDetail(id: string, sheetNo: string) {
	loading.value = true;
	try {
		const payload: Record<string, any> = { id };
		if (sheetNo) payload.qualityInspectionNumber = sheetNo;
		const res: any = await http.post("/quality/accuracyFill/findByDetail", payload);
		const data = res?.data ?? res;
		if (!data) {
			uni.showToast({ title: "详情获取失败", icon: "none" });
			return;
		}
		editSnapshot.value = _.cloneDeep(data);
		applyFormData(form.value, data);
		records.value = normalizeRecords(data.fillDetailList, { isNew: false });
		fileUrlStr.value = data.imageFile || "";
		if (fileUrlStr.value) {
			applyAttachmentString(fileUrlStr.value);
		}
		applyLocalInspectorName();
		const processCode = resolveProcessCode(form.value);
		if (!records.value.length && processCode) {
			await loadProcessTemplate(processCode);
		}
		if (!mediaFiles.value.length && processCode) {
			await loadProcessAttachments(processCode);
		}
	} catch (error) {
		console.error("[accuracyFill] load detail error", error);
		uni.showToast({ title: "详情获取失败", icon: "none" });
	} finally {
		loading.value = false;
	}
}

async function loadProcessTemplate(processCode?: string) {
	if (!processCode) return;
	try {
		const res: any = await http.post("/quality/accuracyRules/findByProcess", { processCode });
		const data = res?.data ?? res;
		const detailList = Array.isArray(data?.detailList) ? data.detailList : [];
		if (!detailList.length || records.value.length) return;
		records.value = normalizeRecords(detailList, { isNew: false });
		records.value.forEach((row) => recalcRow(row));
	} catch (error) {
		console.error("[accuracyFill] load process rule error", error);
	}
}

async function loadProcessAttachments(processCode?: string) {
	if (!processCode) return;
	try {
		const res: any = await http.post("/quality/jneFile/list", { routeCode: processCode });
		const records = res?.data?.records ?? res?.records ?? [];
		if (!Array.isArray(records) || !records.length) return;
		if (mediaFiles.value.length) return;
		const urls = records
			.map((item: any) => item?.fileUrl)
			.filter((url: any) => typeof url === "string" && url.trim().length);
		if (!urls.length) return;
		fileUrlStr.value = urls.join(",");
		mediaFiles.value = urls.map((url: string) => buildAttachmentMeta(url));
	} catch (error) {
		console.error("[accuracyFill] load attachments error", error);
	}
}

function applyAttachmentString(value: string) {
	if (!value) return;
	const urls = value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	if (!urls.length) return;
	mediaFiles.value = urls.map((url) => buildAttachmentMeta(url));
}

function buildAttachmentMeta(rawUrl: string): AttachmentMeta {
	const fullUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `${MINIO_HOST}${rawUrl}`;
	const lower = fullUrl.toLowerCase();
	let type: AttachmentMeta["type"] = "other";
	if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(lower)) type = "image";
	else if (lower.endsWith(".pdf")) type = "pdf";
	const name = rawUrl.split("/").pop() || "附件";
	return { url: fullUrl, name, type };
}

function resolveProcessCode(source: Record<string, any>) {
	if (!source || typeof source !== "object") return "";
	return (
		source.processCode ||
		source.stepCode ||
		source.routeCode ||
		source.processId ||
		source.stepId ||
		""
	);
}

function applyFormData(target: Record<string, any>, source: Record<string, any>) {
	if (!target || !source) return;
	Object.keys(target).forEach((key) => {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			target[key] = source[key] ?? "";
		}
	});
}

function normalizeRecords(
	list: any,
	defaults: Partial<AccuracyRecord> = {}
): AccuracyRecord[] {
	if (!Array.isArray(list)) return [];
	return list.map((item, index) => normalizeRecord(item, defaults, index));
}

function normalizeRecord(
	source: any,
	defaults: Partial<AccuracyRecord>,
	index: number
): AccuracyRecord {
	const record: AccuracyRecord = {
		id: source?.id ?? source?.detailId ?? "",
		inspectionContent: toDisplayString(source?.inspectionContent),
		detectingLocation: toDisplayString(source?.detectingLocation),
		tolerence: toNumericString(source?.tolerence),
		negativeTolerance: toNumericString(source?.negativeTolerance),
		theoreticalValue: toNumericString(source?.theoreticalValue),
		checkDimensionalDeviation: toNumericString(source?.checkDimensionalDeviation),
		resultStatus:
			source?.resultStatus !== undefined && source?.resultStatus !== null
				? String(source.resultStatus)
				: "",
		unit: toDisplayString(source?.unit, ""),
		remark: toDisplayString(source?.remark, ""),
		isNew: defaults.isNew ?? false,
		_localId: `${source?.id ?? "row"}-${index}-${Math.random().toString(36).slice(2, 8)}`,
	};
	return record;
}

function toDisplayString(value: any, fallback = "") {
	if (value === undefined || value === null) return fallback;
	const str = String(value);
	return str.trim() === "" ? fallback : str;
}

function toNumericString(value: any) {
	if (value === undefined || value === null || value === "") return "";
	const num = Number(value);
	if (Number.isNaN(num)) return String(value);
	return removeTrailingZeros(num.toFixed(2));
}

function removeTrailingZeros(value: string) {
	if (!value.includes(".")) return value;
	return value.replace(/\.?0+$/, "");
}

function sanitizeNumber(value: any) {
	if (value === undefined || value === null) return "";
	let str = String(value).replace(/[^\d\.\-]/g, "");
	if (!str) return "";
	const sign = str.startsWith("-") ? "-" : "";
	let numeric = sign ? str.slice(1) : str;
	const parts = numeric.split(".");
	if (parts.length > 2) {
		numeric = `${parts[0]}.${parts.slice(1).join("")}`;
	}
	if (numeric.includes(".")) {
		const [integer, decimal] = numeric.split(".");
		const intPart = integer.substring(0, 8);
		const decPart = decimal.substring(0, 2);
		const decimalText = decPart ? `.${decPart}` : "";
		return `${sign}${intPart}${decimalText}`;
	}
	return `${sign}${numeric.substring(0, 8)}`;
}

function recalcRow(row: AccuracyRecord) {
	const theoretical = toNumber(row.theoreticalValue);
	const positive = toNumber(row.tolerence);
	const negative = toNumber(row.negativeTolerance);
	const measured = toNumber(row.checkDimensionalDeviation);
	if (
		theoretical === null ||
		positive === null ||
		negative === null ||
		measured === null
	) {
		row.resultStatus = "";
		syncOverallConclusion();
		return;
	}
	const min = theoretical - negative;
	const max = theoretical + positive;
	row.resultStatus = measured >= min && measured <= max ? "0" : "1";
	syncOverallConclusion();
}

function syncOverallConclusion() {
	if (!records.value.length) {
		form.value.testConclusion = "";
		return;
	}
	if (records.value.some((row) => row.resultStatus === "1")) {
		form.value.testConclusion = "1";
		return;
	}
	if (
		records.value.every(
			(row) => row.resultStatus === "0" && row.resultStatus !== ""
		)
	) {
		form.value.testConclusion = "0";
		return;
	}
	form.value.testConclusion = "";
}

function toNumber(value: any): number | null {
	if (value === undefined || value === null || value === "") return null;
	const num = Number(value);
	return Number.isNaN(num) ? null : Number(num.toFixed(2));
}

function addRecord() {
	records.value.push({
		inspectionContent: "",
		detectingLocation: "",
		tolerence: "",
		negativeTolerance: "",
		theoreticalValue: "",
		checkDimensionalDeviation: "",
		resultStatus: "",
		unit: "",
		remark: "",
		isNew: true,
		_localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	});
	syncOverallConclusion();
}

function removeRecord(index: number) {
	if (index < 0 || index >= records.value.length) return;
	records.value.splice(index, 1);
	syncOverallConclusion();
}

type EditableField =
	| "inspectionContent"
	| "detectingLocation"
	| "tolerence"
	| "negativeTolerance"
	| "theoreticalValue"
	| "checkDimensionalDeviation"
	| "remark";

function isEditable(record: AccuracyRecord, key: EditableField) {
	if (isViewMode.value) return false;
	if (!record.isNew && record[key]) return false;
	return true;
}

function updateRecordField(index: number, key: EditableField, value: any) {
	const row = records.value[index];
	if (!row) return;
	row[key] = typeof value === "string" ? value : value ?? "";
	if (
		key === "tolerence" ||
		key === "negativeTolerance" ||
		key === "theoreticalValue" ||
		key === "checkDimensionalDeviation"
	) {
		recalcRow(row);
	}
}

function updateFormField(key: keyof typeof form.value, value: any) {
	form.value[key] = typeof value === "string" ? value : value ?? "";
}

function onConclusionChange(value: any) {
	form.value.testConclusion =
		value === undefined || value === null ? "" : String(value);
}

function validateBaseForm() {
	if (!form.value.inspectorName || !String(form.value.inspectorName).trim()) {
		uni.showToast({ title: "请填写检验员名称", icon: "none" });
		return false;
	}
	if (!form.value.testConclusion) {
		uni.showToast({ title: "请确认检测结论", icon: "none" });
		return false;
	}
	return true;
}

function validateRecords() {
	if (!records.value.length) {
		uni.showToast({ title: "请至少添加一条检验记录", icon: "none" });
		return false;
	}
	const numericKeys: Array<{ key: EditableField; label: string }> = [
		{ key: "tolerence", label: "正公差" },
		{ key: "negativeTolerance", label: "负公差" },
		{ key: "theoreticalValue", label: "理论值" },
		{ key: "checkDimensionalDeviation", label: "实际测量值" },
	];
	for (let i = 0; i < records.value.length; i += 1) {
		const row = records.value[i];
		if (!row.inspectionContent || !row.inspectionContent.trim()) {
			uni.showToast({ title: `请填写第${i + 1}条检测内容`, icon: "none" });
			return false;
		}
		if (!row.detectingLocation || !row.detectingLocation.trim()) {
			uni.showToast({ title: `请填写第${i + 1}条检测位置`, icon: "none" });
			return false;
		}
		for (const item of numericKeys) {
			const val = row[item.key];
			if (val === undefined || val === null || String(val).trim() === "") {
				uni.showToast({
					title: `请填写第${i + 1}条${item.label}`,
					icon: "none",
				});
				return false;
			}
			const plain = String(val).replace(/[-.]/g, "");
			if (plain.length > 8) {
				uni.showToast({
					title: `第${i + 1}条${item.label}不能超过8位`,
					icon: "none",
				});
				return false;
			}
			if (toNumber(val) === null) {
				uni.showToast({
					title: `第${i + 1}条${item.label}需为数字`,
					icon: "none",
				});
				return false;
			}
		}
	}
	return true;
}

function serializeRecords() {
	return records.value.map((row) => ({
		id: row.id,
		inspectionContent: row.inspectionContent,
		detectingLocation: row.detectingLocation,
		tolerence: toNumber(row.tolerence),
		negativeTolerance: toNumber(row.negativeTolerance),
		theoreticalValue: toNumber(row.theoreticalValue),
		checkDimensionalDeviation: toNumber(row.checkDimensionalDeviation),
		resultStatus: row.resultStatus,
		unit: row.unit || "",
		remark: row.remark || "",
	}));
}

async function handleSubmit() {
	if (saving.value || isViewMode.value) return;
	if (!validateBaseForm()) return;
	if (!validateRecords()) return;

	saving.value = true;
	try {
		const payload = {
			...editSnapshot.value,
			...form.value,
			fillDetailList: serializeRecords(),
			imageFile: fileUrlStr.value,
		};
		const res: any = await http.post("/quality/accuracyFill/edit", payload);
		const message = res?.msg || "保存成功";
		if (res?.code !== undefined && res.code !== 200 && res.code !== 0) {
			throw new Error(message);
		}
		uni.showToast({ title: message, icon: "success" });
		storage.set("lastUserName", form.value.inspectorName, "raw");
		editSnapshot.value = _.cloneDeep(payload);
		nextTick(() => {
			setTimeout(() => goBack(), 400);
		});
	} catch (error: any) {
		console.error("[accuracyFill] submit error", error);
		uni.showToast({ title: error?.message || "保存失败", icon: "none" });
	} finally {
		saving.value = false;
	}
}

function goBack() {
	try {
		uni.navigateBack();
	} catch (error) {
		console.warn("[accuracyFill] navigateBack failed", error);
	}
}

function applyLocalInspectorName() {
	if (isViewMode.value) return;
	if (form.value.inspectorName && String(form.value.inspectorName).trim()) return;
	const storedName = storage.get<string>("lastUserName", "raw");
	const candidate = storedName || resolveUserName(userStore.userInfo);
	if (!candidate) return;
	form.value.inspectorName = candidate;
}

function resolveOptionLabel(options: any[], value: any) {
	if (value === undefined || value === null || value === "") return "";
	const arr = unwrapOptions(options);
	const target = arr.find((item) => String(item.value) === String(value));
	return target?.label ?? "";
}

function unwrapOptions(source: any) {
	const maybe = source && typeof source === "object" && "value" in source ? source.value : source;
	if (!Array.isArray(maybe)) return [];
	return maybe.map((item) => {
		if (item && typeof item === "object") {
			return {
				label:
					item.label ??
					item.dictLabel ??
					item.name ??
					item.text ??
					item.title ??
					item.value ??
					item.dictValue ??
					"",
				value: item.value ?? item.dictValue ?? item.code ?? item.key ?? item.id ?? "",
			};
		}
		return { label: String(item ?? ""), value: item };
	});
}

function resolveUserName(source: any): string {
	if (!source || typeof source !== "object") return "";
	return (
		source.nickName ||
		source.nickname ||
		source.userName ||
		source.username ||
		source.name ||
		source.realName ||
		source.account ||
		""
	);
}

function handlePreviewAttachment(file: AttachmentMeta) {
	if (!file?.url) return;
	if (file.type === "image") {
		const images = mediaFiles.value
			.filter((item) => item.type === "image")
			.map((item) => item.url);
		if (!images.length) return;
		const index = images.indexOf(file.url);
		uni.previewImage({
			urls: images,
			current: index >= 0 ? index : 0,
		});
		return;
	}
	if (typeof window !== "undefined" && window?.open) {
		window.open(file.url, "_blank");
	} else {
		uni.showModal({
			title: "温馨提示",
			content: "当前附件预览仅在网页端支持，请在电脑端查看。",
			showCancel: false,
		});
	}
}

function displayValue(value: any, placeholder = "-") {
	if (value === undefined || value === null) return placeholder;
	const text = String(value).trim();
	return text ? text : placeholder;
}

function formatDate(value: any) {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, "0");
	const d = `${date.getDate()}`.padStart(2, "0");
	return `${y}-${m}-${d}`;
}
</script>

<style scoped lang="scss">
.jd-page {
	display: flex;
	flex-direction: column;
	height: 100%;
	background: #f5f7fb;
}
.jd-scroll {
	flex: 1;
	padding: 24rpx 32rpx 160rpx;
	box-sizing: border-box;
}
.jd-loading {
	padding: 160rpx 0;
	text-align: center;
	color: #64748b;
	font-size: 28rpx;
	letter-spacing: 1rpx;
}
.jd-section {
	margin-top: 28rpx;
}
.jd-section__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}
.jd-section__title {
	font-size: 32rpx;
	font-weight: 600;
	color: #1f2937;
}
.jd-card {
	padding: 28rpx 32rpx;
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}
.jd-field {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}
.jd-field__label {
	font-size: 26rpx;
	color: #475569;
	font-weight: 600;
	line-height: 1.4;
}
.jd-field__label.required::after {
	content: "*";
	margin-left: 8rpx;
	color: #dc2626;
	font-size: 24rpx;
}
.jd-field__value {
	font-size: 30rpx;
	color: #111827;
	line-height: 1.5;
	word-break: break-all;
}
.jd-field__value.multiline {
	white-space: pre-wrap;
}
.jd-input :deep(.sar-input__wrapper) {
	border-radius: 18rpx;
	background: #f8fafc;
}
.jd-radio-group {
	display: flex;
	gap: 18rpx;
}
.jd-radio {
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 12rpx 18rpx;
	border-radius: 999rpx;
	background: #f1f5f9;
	color: #1f2937;
}
.jd-radio.is-active {
	background: rgba(37, 99, 235, 0.12);
	color: #2563eb;
}
.jd-radio__label {
	font-size: 28rpx;
}
.jd-textarea {
	width: 100%;
	min-height: 160rpx;
	padding: 18rpx 22rpx;
	border-radius: 18rpx;
	background: #f8fafc;
	border: none;
	font-size: 28rpx;
	color: #111827;
	box-sizing: border-box;
}
.jd-record-card {
	margin-bottom: 24rpx;
	padding-bottom: 8rpx;
}
.jd-record-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}
.jd-record-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1f2937;
}
.jd-empty {
	padding: 48rpx 0;
	text-align: center;
	color: #94a3b8;
	font-size: 26rpx;
}
.jd-result-chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 140rpx;
	padding: 12rpx 24rpx;
	border-radius: 999rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: #475569;
	background: #e2e8f0;
}
.jd-result-chip.is-pass {
	color: #15803d;
	background: rgba(34, 197, 94, 0.16);
}
.jd-result-chip.is-fail {
	color: #dc2626;
	background: rgba(248, 113, 113, 0.16);
}
.jd-media {
	height: 420rpx;
	border-radius: 24rpx;
	overflow: hidden;
	background: #e2e8f0;
	margin-bottom: 12rpx;
}
.jd-media__item {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #eef2ff;
}
.jd-media__image {
	width: 100%;
	height: 100%;
}
.jd-media__placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	color: #334155;
	font-size: 26rpx;
}
.jd-media__name {
	font-weight: 600;
}
.jd-media__hint {
	font-size: 24rpx;
	color: #64748b;
}
.jd-actions {
	padding: 12rpx 24rpx 36rpx;
	background: linear-gradient(
		180deg,
		rgba(245, 247, 251, 0) 0%,
		#f5f7fb 55%,
		#f5f7fb 100%
	);
}
.jd-actions__bar {
	display: flex;
	gap: 24rpx;
}
.jd-actions__button {
	flex: 1;
}
.jd-actions__button :deep(.sar-button) {
	width: 100%;
	height: 96rpx;
	border-radius: 999rpx;
	font-size: 30rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
}
.jd-actions__button.is-disabled :deep(.sar-button) {
	opacity: 0.65;
}
.jd-actions__button--secondary :deep(.sar-button) {
	background: #9ca3af;
	color: #ffffff;
}
</style>
