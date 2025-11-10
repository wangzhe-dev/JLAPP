<template>
  <PageLayout title="质检填报" :show-back="true" :sticky-toolbar="true">
    <view class="qf-page">
      <scroll-view class="qf-scroll" scroll-y>
        <view v-if="loading" class="qf-loading">加载中...</view>
        <template v-else>
          <CForm ref="baseFormRef" v-model="form" :schema="schemaRef" @change="onFormFieldChange">
            <template #actions>
              <!-- 环境测量记录 -->
              <view class="">
                <view class="qf-section__header">
                  <text class="qf-section__title">环境测量记录</text>
                  <CButton
                    v-if="!isViewMode"
                    type="primary"
                    size="small"
                    round
                    throttle="400"
                    @click="addRecord"
                  >新增</CButton>
                </view>
                <view v-if="!records.length" class="qf-empty">暂无测量记录</view>
                <CCard
                  v-for="(record, index) in records"
                  :key="record._localId || index"
                  class="qf-record-card"
                  variant="outline"
                >
                  <view class="qf-record-header">
                    <text class="qf-record-title">记录 {{ index + 1 }}</text>
                    <sar-button
                      v-if="!isViewMode"
                      type="danger"
                      size="mini"
                      inline
                      plain
                      @click="removeRecord(index)"
                    >删除</sar-button>
                  </view>

                  <view class="qf-field">
                    <text class="qf-field__label required">测量场景</text>
                    <picker
                      mode="selector"
                      :range="sceneOptions"
                      range-key="label"
                      :value="sceneIndex(record.beforeConstructionWeather)"
                      :disabled="isViewMode"
                      @change="(e) => handleSceneChange(index, e.detail.value)"
                    >
                      <view
                        :class="[
                          'qf-field__input',
                          record.beforeConstructionWeather ? '' : 'is-placeholder',
                        ]"
                      >{{ displayScene(record.beforeConstructionWeather) }}</view>
                    </picker>
                  </view>

                  <view class="qf-field">
                    <text class="qf-field__label required">测量时间</text>
                    <sar-datetime-picker-input
                      :model-value="record.measureTime"
                      type="yMd"
                      title="请选择日期"
                      placeholder="请选择测量日期"
                      clearable
                      :disabled="isViewMode"
                      @update:model-value="(val) =>
                        updateRecordField(index, 'measureTime', formatDateForDisplay(val))"
                    />
                  </view>

                  <view class="qf-field">
                    <text class="qf-field__label required">空气温度(℃)</text>
                    <sar-input
                      :model-value="record.airTemperature"
                      type="digit"
                      clearable
                      :disabled="isViewMode"
                      placeholder="请输入空气温度"
                      @update:model-value="(val) => updateRecordField(index, 'airTemperature', val)"
                    />
                  </view>

                  <view class="qf-field">
                    <text class="qf-field__label required">相对湿度&lt;({{ planRuleObj.relativeHumidity ?? 0 }})%</text>
                    <sar-input
                      :model-value="record.relativeHumidity"
                      type="digit"
                      clearable
                      :disabled="isViewMode"
                      placeholder="请输入相对湿度"
                      @update:model-value="(val) => updateRecordField(index, 'relativeHumidity', val)"
                    />
                  </view>

                  <view class="qf-field">
                    <text class="qf-field__label required">露点温度(℃)</text>
                    <sar-input
                      :model-value="record.dewPointTemperature"
                      type="digit"
                      clearable
                      :disabled="isViewMode"
                      placeholder="请输入露点温度"
                      @update:model-value="(val) => updateRecordField(index, 'dewPointTemperature', val)"
                    />
                  </view>

                  <view class="qf-field">
                    <text class="qf-field__label required">表面温度(℃)</text>
                    <sar-input
                      :model-value="record.surfaceTemperature"
                      type="digit"
                      clearable
                      :disabled="isViewMode"
                      placeholder="请输入表面温度"
                      @update:model-value="(val) => updateRecordField(index, 'surfaceTemperature', val)"
                    />
                  </view>

                  <view class="qf-field">
                    <text class="qf-field__label">备注</text>
                    <textarea
                      class="qf-textarea"
                      :value="record.remark"
                      :disabled="isViewMode"
                      :placeholder="isViewMode ? '-' : '请输入备注'"
                      maxlength="150"
                      @input="(e) => updateRecordField(index, 'remark', e.detail.value)"
                    />
                  </view>
                </CCard>
              </view>

              <sar-row :gap="30">
                <sar-col :span="6">
                  <sar-button round theme="warning" @tap="handleSubmit({ isSubmit: 0 })">保存</sar-button>
                </sar-col>
                <sar-col :span="6">
                  <sar-button round theme="info" @tap="goBack({ isSubmit: 1 })">返回</sar-button>
                </sar-col>
              </sar-row>
            </template>
          </CForm>
        </template>
      </scroll-view>
    </view>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import { CForm } from "@/components/c-form";
import type { CFormExpose, CFormSchema } from "@/components/c-form/types";
import CCard from "@/components/c-card/CCard.vue";
import CButton from "@/components/c-button/CButton.vue";
import { http } from "@/utils/request";
import { queryDictList as queryDictListBatch } from "@/api/dict";
import { useUserStore } from "@/stores/user";
import { storage } from "@/utils/storage";
import _ from "lodash";

interface QualityRecord {
  id?: string;
  beforeConstructionWeather: string;
  measureTime: string;
  airTemperature: string;
  relativeHumidity: string;
  dewPointTemperature: string;
  surfaceTemperature: string;
  remark?: string;
  _localId?: string;
}

const baseFormRef = ref<CFormExpose>();
const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const pageMode = ref<"edit" | "view" | "plan">("edit");
const detailId = ref<string>("");
const detailSheetNo = ref<string>("");
const editSnapshot = ref<Record<string, any>>({});
const planRuleObj = ref<Record<string, any>>({});
const records = ref<QualityRecord[]>([]);
const userStore = useUserStore();
const pendingInspectorName = ref<string>("");

// 默认检查员（仅兜底；最终以后端返回为准）
const defaultInspectorName = storage.get<string>("lastUserName", "raw") || "";

const form = ref<Record<string, any>>({
  workOrderNum: "",
  productLineName: "",
  processName: "",
  qualityInspectionNumber: "",
  shipNumber: "",
  pn: "",
  shipyard: "",
  inspectionForm: "",

  salinity: "",
  grease: "",
  dust: "",
  corrosionLevel: "",
  surfaceRoughness: "",
  remark: "",
  paintManufacturerCode: "",

  constructionMethod: "",
  productNameNumber: "",
  productBatchNumber: "",
  dryFilmThicknessValue: "",
  fillStatus: "",
  dryFilmThickness: "20±5",
  productRemark: "",
  coatingInspectorCode: "",
  coatingInspectorName: defaultInspectorName,
  paintMerchantServices: "",
  shipownersRepresentative: "",
});

const isViewMode = computed(() => pageMode.value === "view");

const sceneOptions = ref([
  { label: "施工前", value: "施工前" },
  { label: "天气突然变化", value: "天气突然变化" },
]);

const greaseOptions = [
  { label: "无", value: "0" },
  { label: "有", value: "1" },
];

const dustOptions = [
  { label: "不合格", value: "0" },
  { label: "合格", value: "1" },
];

const typeOptions = ref<any[]>([]);
const fillStatusOption = ref<any[]>([]);
const consMethodTypeOption = ref<any[]>([]);

watch(
  () => baseFormRef.value,
  (instance) => {
    if (instance && pendingInspectorName.value) {
      instance.setValue?.("coatingInspectorName", pendingInspectorName.value);
      pendingInspectorName.value = "";
    }
  },
  { immediate: false }
);

/** 仅在“后端未返回或为空”时应用本地/用户默认检查员 */
function applyLocalInspectorName() {
  const current = (form.value.coatingInspectorName || "").trim();
  if (current) return; // 已有后端/预填值，尊重不覆盖

  const storedName = storage.get<string>("lastUserName", "raw") || defaultInspectorName;
  const candidate = storedName || resolveUserName(userStore.userInfo);
  if (!candidate) return;

  pendingInspectorName.value = candidate;
  form.value.coatingInspectorName = candidate;
  baseFormRef.value?.setValue?.("coatingInspectorName", candidate);
  pendingInspectorName.value = "";
}

async function loadDicts() {
  try {
    const dictMap = await queryDictListBatch([
      "rule_type",
      "fillin_status",
      "construction_method_type",
    ]);
    typeOptions.value = Array.isArray(dictMap?.rule_type) ? dictMap.rule_type : [];
    fillStatusOption.value = Array.isArray(dictMap?.fillin_status) ? dictMap.fillin_status : [];
    consMethodTypeOption.value = Array.isArray(dictMap?.construction_method_type)
      ? dictMap.construction_method_type
      : [];
  } catch (error) {
    console.error("[qualityFill] load dictionaries error", error);
    typeOptions.value = [];
    fillStatusOption.value = [];
    consMethodTypeOption.value = [];
  }
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
        value: item.value ?? item.dictValue ?? item.code ?? item.key ?? item.id ?? item,
        raw: item,
      };
    }
    return { label: String(item ?? ""), value: item, raw: item };
  });
}

function resolveOptionLabel(options: any[], value: any) {
  if (value === undefined || value === null || value === "") return "";
  const arr = unwrapOptions(options);
  const target = arr.find((item) => String(item.value ?? "") === String(value ?? ""));
  return target?.label ?? "";
}

function applyFormData(target: Record<string, any>, source: Record<string, any>) {
  if (!target || !source) return;
  Object.keys(target).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
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

/** ---------- 表单 Schema（含必填与规则） ---------- */
const schemaRef = computed<CFormSchema>(() => {
  const readonly = isViewMode.value;
  const groups: CFormSchema["fields"] = [
    { groupTitle: "基础信息" },
    { label: "加工单", prop: "workOrderNum", component: "Normal", componentProps: { emptyText: "-" } },
    { label: "产线", prop: "productLineName", component: "Normal", componentProps: { emptyText: "-" } },
    { label: "工序", prop: "processName", component: "Normal", componentProps: { emptyText: "-" } },
    { label: "质检单号", prop: "qualityInspectionNumber", component: "Normal", componentProps: { emptyText: "-" } },
    { label: "船名/船号", prop: "shipNumber", component: "Normal", componentProps: { emptyText: "-" } },
    { label: "钢板编号", prop: "pn", component: "Normal", componentProps: { emptyText: "-" } },
    { label: "船厂/钢厂", prop: "shipyard", component: "Normal", componentProps: { emptyText: "-" } },
    {
      label: "检验形式",
      prop: "inspectionForm",
      component: "Normal",
      format: (value: string) => {
        const label = resolveOptionLabel(typeOptions.value, value);
        if (label) return label;
        return value || "-";
      },
      componentProps: { emptyText: "-" },
    },

    { groupTitle: "施工检测项" },
    {
      label: "盐分（mg/㎡)",
      prop: "salinity",
      component: "Input",
      inputType: "digit",
      disabled: readonly,
      placeholder: "请输入盐分",
      required: true,
      rules: [
        { required: true, message: "请填写盐分" },
        { pattern: /^-?\d+(\.\d{1,2})?$/, message: "盐分需为数字，最多两位小数" },
      ],
    },
    {
      label: "油/油脂",
      prop: "grease",
      component: "Dict",
      options: greaseOptions,
      disabled: readonly,
      placeholder: "请选择油/油脂",
      required: true,
      rules: [{ required: true, message: "请选择油/油脂" }],
    },
    {
      label: "灰尘",
      prop: "dust",
      component: "Dict",
      options: dustOptions,
      disabled: readonly,
      placeholder: "请选择灰尘结果",
      required: true,
      rules: [{ required: true, message: "请选择灰尘结果" }],
    },
    {
      label: "除锈等级",
      prop: "corrosionLevel",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入除锈等级",
      extra: planRuleObj.value?.corrosionLevel != null ? `SA${planRuleObj.value.corrosionLevel}` : "",
      required: true,
      rules: [{ required: true, message: "请输入除锈等级" }],
    },
    {
      label: "表面粗糙度",
      prop: "surfaceRoughness",
      component: "Input",
      inputType: "digit",
      disabled: readonly,
      placeholder: "请输入粗糙度",
      extra:
        planRuleObj.value?.surfaceRoughnessMin != null &&
        planRuleObj.value?.surfaceRoughnessMax != null
          ? `${planRuleObj.value.surfaceRoughnessMin}-${planRuleObj.value.surfaceRoughnessMax} μm`
          : "μm",
      required: true,
      rules: [
        { required: true, message: "请输入表面粗糙度" },
        { pattern: /^-?\d+(\.\d{1,2})?$/, message: "粗糙度需为数字，最多两位小数" },
      ],
    },
    {
      label: "备注",
      prop: "remark",
      component: "Textarea",
      disabled: readonly,
      placeholder: "请输入备注",
    },

    { groupTitle: "产品信息" },
    {
      label: "涂料生产商",
      prop: "paintManufacturerCode",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入涂料生产商",
      required: true,
      rules: [{ required: true, message: "请输入涂料生产商" }],
    },
    {
      label: "施工方法",
      prop: "constructionMethod",
      component: "Dict",
      options: () => unwrapOptions(consMethodTypeOption.value),
      disabled: readonly,
      placeholder: "请选择施工方法",
      required: true,
      rules: [{ required: true, message: "请选择施工方法" }],
    },
    {
      label: "产品名称/编号",
      prop: "productNameNumber",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入产品名称/编号",
      required: true,
      rules: [{ required: true, message: "请输入产品名称/编号" }],
    },
    {
      label: "产品批号",
      prop: "productBatchNumber",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入产品批号",
      required: true,
      rules: [{ required: true, message: "请输入产品批号" }],
    },
    {
      label: "干膜厚度标准",
      prop: "dryFilmThickness",
      component: "Normal",
      componentProps: { emptyText: "-" },
    },
    {
      label: "干膜厚度测量值",
      prop: "dryFilmThicknessValue",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入干膜厚度测量值",
      required: true,
      rules: [
        { required: true, message: "请输入干膜厚度测量值" },
        { pattern: /^-?\d+(\.\d{1,2})?$/, message: "厚度需为数字，最多两位小数" },
      ],
    },
    {
      label: "质检状态",
      prop: "fillStatus",
      component: "Dict",
      options: () => unwrapOptions(fillStatusOption.value),
      disabled: readonly,
      placeholder: "请选择质检状态",
      required: true,
      rules: [{ required: true, message: "请选择质检状态" }],
    },
    {
      label: "产品备注",
      prop: "productRemark",
      component: "Textarea",
      disabled: readonly,
      placeholder: "请输入产品备注",
    },
    {
      label: "涂层检查员",
      prop: "coatingInspectorName",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入涂层检查员",
      required: true,
      rules: [{ required: true, message: "请输入涂层检查员" }],
    },
    {
      label: "油漆商技术服务",
      prop: "paintMerchantServices",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入技术服务",
    },
    {
      label: "船东代表",
      prop: "shipownersRepresentative",
      component: "Input",
      disabled: readonly,
      placeholder: "请输入船东代表",
    },
  ];

  return {
    labelWidth: "240rpx",
    fields: groups,
    layout: "vertical",
    errorDisplay: "toast",
    showActions: true,
  };
});
/** ---------- END Schema ---------- */

onLoad(async (options: Record<string, any>) => {
  pageMode.value = resolveMode(options?.mode);
  detailId.value = options?.id ? decodeURIComponent(options.id) : "";
  detailSheetNo.value = options?.qualityInspectionNumber
    ? decodeURIComponent(options.qualityInspectionNumber)
    : "";

  await loadDicts();
  applyLocalInspectorName(); // 先兜底一次（不会覆盖后端）

  const prefill = resolvePrefill(options?.prefill);
  if (prefill) {
    pageMode.value = prefill._mode ?? pageMode.value;
    editSnapshot.value = _.cloneDeep(prefill);
    applyFormData(form.value, prefill);
    records.value = normalizeRecords(prefill.fillDetailList);
    await loadProcessRule(prefill.processCode);
    applyLocalInspectorName(); // 再兜底一次（仍不会覆盖后端）
    return;
  }

  if (detailId.value) {
    await loadDetail(detailId.value, detailSheetNo.value);
    applyLocalInspectorName();
  } else if (!isViewMode.value) {
    addRecord();
  }
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

async function loadDetail(id: string, sheetNo: string) {
  loading.value = true;
  try {
    const payload: Record<string, any> = { id };
    if (sheetNo) payload.qualityInspectionNumber = sheetNo;
    const res: any = await http.post("/quality/paintingFill/findByDetail", payload);
    const data = res?.data ?? res;
    if (!data) {
      uni.showToast({ title: "详情获取失败", icon: "none" });
      return;
    }
    editSnapshot.value = _.cloneDeep(data);
    applyFormData(form.value, data);
    records.value = normalizeRecords(data.fillDetailList);
    await loadProcessRule(data.processCode);
    if (!records.value.length && !isViewMode.value) addRecord();
  } catch (error) {
    console.error("[qualityFill] load detail error", error);
    uni.showToast({ title: "详情获取失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function loadProcessRule(processCode?: string) {
  if (!processCode) return;
  try {
    const res: any = await http.post("/quality/paintingRules/findByProcess", { processCode });
    const data = res?.data ?? res;
    if (data) planRuleObj.value = data || {};
  } catch (error) {
    console.error("[qualityFill] load process rule error", error);
  }
}

function normalizeRecords(list: any): QualityRecord[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    id: item?.id,
    beforeConstructionWeather: item?.beforeConstructionWeather || "",
    measureTime: formatDateForDisplay(item?.measureTime),
    airTemperature: safeToString(item?.airTemperature),
    relativeHumidity: safeToString(item?.relativeHumidity),
    dewPointTemperature: safeToString(item?.dewPointTemperature),
    surfaceTemperature: safeToString(item?.surfaceTemperature),
    remark: item?.remark || "",
    _localId: item?.id || `${Date.now()}${Math.random()}`,
  }));
}

function safeToString(input: any) {
  if (input === undefined || input === null) return "";
  return String(input);
}

function addRecord() {
  records.value.push({
    beforeConstructionWeather: "",
    measureTime: "",
    airTemperature: "",
    relativeHumidity: "",
    dewPointTemperature: "",
    surfaceTemperature: "",
    remark: "",
    _localId: `${Date.now()}-${Math.random()}`,
  });
}

function removeRecord(index: number) {
  if (index < 0 || index >= records.value.length) return;
  uni.showModal({
    title: "提示",
    content: "确认删除该测量记录？",
    success: (res) => {
      if (!res.confirm) return;
      records.value.splice(index, 1);
    },
  });
}

function sceneIndex(value: string) {
  return Math.max(sceneOptions.value.findIndex((item) => item.value === value), 0);
}

function displayScene(value: string) {
  const found = sceneOptions.value.find((item) => item.value === value);
  return found?.label || (value ? value : "请选择测量场景");
}

function handleSceneChange(index: number, pickerIndex: number) {
  const option = sceneOptions.value[pickerIndex];
  updateRecordField(index, "beforeConstructionWeather", option?.value || "");
}

function updateRecordField(index: number, key: keyof QualityRecord, value: any) {
  const target = records.value[index];
  if (!target) return;
  target[key] = value ?? "";
}

function formatDateForDisplay(input: any) {
  if (!input) return "";
  if (typeof input === "string") {
    const matched = input.match(/^\d{4}-\d{2}-\d{2}/);
    if (matched && matched[0]) return matched[0];
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateForSubmit(value: any) {
  const display = formatDateForDisplay(value);
  if (!display) return "";
  return `${display} 00:00:00`;
}

function onFormFieldChange() {
  // 预留：按需处理字段变化（如联动字典）
}

/** ---------- 兜底必填 + 数字校验 ---------- */
function isEmpty(v: any) {
  return v === undefined || v === null || String(v).trim() === "";
}
const NUM2 = /^-?\d+(\.\d{1,2})?$/;

function validateBaseFormRequired() {
  const checks: Array<{ key: string; label: string; type?: "num2" }> = [
    // 施工检测项
    { key: "salinity", label: "盐分", type: "num2" },
    { key: "grease", label: "油/油脂" },
    { key: "dust", label: "灰尘" },
    { key: "corrosionLevel", label: "除锈等级" },
    { key: "surfaceRoughness", label: "表面粗糙度", type: "num2" },
    // 产品信息
    { key: "paintManufacturerCode", label: "涂料生产商" },
    { key: "constructionMethod", label: "施工方法" },
    { key: "productNameNumber", label: "产品名称/编号" },
    { key: "productBatchNumber", label: "产品批号" },
    { key: "dryFilmThicknessValue", label: "干膜厚度测量值", type: "num2" },
    { key: "fillStatus", label: "质检状态" },
    { key: "coatingInspectorName", label: "涂层检查员" },
  ];

  for (const item of checks) {
    const val = form.value[item.key];
    if (isEmpty(val)) {
      uni.showToast({ title: `请填写${item.label}`, icon: "none" });
      return false;
    }
    if (item.type === "num2" && !NUM2.test(String(val))) {
      uni.showToast({ title: `${item.label}需为数字（最多两位小数）`, icon: "none" });
      return false;
    }
  }
  return true;
}
/** ---------- END 兜底校验 ---------- */

function validateRecords() {
  if (!records.value.length) {
    uni.showToast({ title: "请至少添加一条测量记录", icon: "none" });
    return false;
  }
  const requiredFields: Array<{ key: keyof QualityRecord; label: string }> = [
    { key: "beforeConstructionWeather", label: "测量场景" },
    { key: "measureTime", label: "测量日期" },
    { key: "airTemperature", label: "空气温度" },
    { key: "relativeHumidity", label: "相对湿度" },
    { key: "dewPointTemperature", label: "露点温度" },
    { key: "surfaceTemperature", label: "表面温度" },
  ];
  const maxLengthFields: Array<keyof QualityRecord> = [
    "airTemperature",
    "relativeHumidity",
    "dewPointTemperature",
    "surfaceTemperature",
  ];
  for (let i = 0; i < records.value.length; i += 1) {
    const row = records.value[i];
    for (const field of requiredFields) {
      const val = row[field.key];
      if (val === undefined || val === null || `${val}`.trim() === "") {
        uni.showToast({ title: `请完善第${i + 1}条记录的${field.label}`, icon: "none" });
        return false;
      }
    }
    for (const key of maxLengthFields) {
      const raw = row[key];
      if (raw && String(raw).replace("-", "").length > 8) {
        uni.showToast({ title: `第${i + 1}条记录的数值不能超过8位`, icon: "none" });
        return false;
      }
    }
  }
  return true;
}

function normalizeNumber(value: any) {
  if (value === "" || value === undefined || value === null) return "";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return Number(num.toFixed(2));
}

function serializeRecords() {
  return records.value.map((item) => ({
    id: item.id,
    beforeConstructionWeather: item.beforeConstructionWeather,
    measureTime: formatDateForSubmit(item.measureTime),
    airTemperature: normalizeNumber(item.airTemperature),
    relativeHumidity: normalizeNumber(item.relativeHumidity),
    dewPointTemperature: normalizeNumber(item.dewPointTemperature),
    surfaceTemperature: normalizeNumber(item.surfaceTemperature),
    remark: item.remark || "",
  }));
}

async function handleSubmit() {
  if (saving.value) return;

  // ① 兜底必填（基础表单）
  if (!validateBaseFormRequired()) return;

  // ② CForm 规则校验（若 CForm 支持 rules）
  const ok = await baseFormRef.value?.validate();
  if (!ok) return;

  // ③ 记录项校验
  if (!validateRecords()) return;

  saving.value = true;
  try {
    const payload = {
      ...editSnapshot.value,
      ...form.value,
      fillDetailList: serializeRecords(),
    };
    const res: any = await http.post("/quality/paintingFill/edit", payload);
    const message = res?.msg || "保存成功";
    if (res?.code !== undefined && res.code !== 200 && res.code !== 0) {
      throw new Error(message);
    }
    uni.showToast({ title: message, icon: "success" });
    editSnapshot.value = _.cloneDeep(payload);
    nextTick(() => {
      setTimeout(() => goBack(), 350);
    });
  } catch (error: any) {
    console.error("[qualityFill] submit error", error);
    uni.showToast({ title: error?.message || "保存失败", icon: "none" });
  } finally {
    saving.value = false;
  }
}

function goBack() {
  try {
    uni.navigateBack();
  } catch (error) {
    console.warn("[qualityFill] navigateBack failed", error);
  }
}
</script>

<style scoped lang="scss">
.qf-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fb;
}
.qf-scroll {
  flex: 1;
  padding: 24rpx 32rpx 160rpx;
  box-sizing: border-box;
}
.qf-loading {
  padding: 160rpx 0;
  text-align: center;
  color: #64748b;
  font-size: 28rpx;
  letter-spacing: 1rpx;
}
.qf-actions {
  padding-top: 12rpx;
  padding-bottom: 40rpx;
}
.qf-actions__bar {
  position: sticky;
  bottom: 24rpx;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 12rpx 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0) 0%,
    #f5f7fb 45%,
    #f5f7fb 100%
  );
}
.qf-actions__button :deep(.sar-button) {
  width: 100%;
  height: 96rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  background: linear-gradient(90deg, #2f6bff 0%, #1b53f6 100%);
  color: #ffffff;
}
.qf-actions__button--secondary :deep(.sar-button) {
  background: #9ca3af;
  color: #ffffff;
}
.qf-actions__button:deep(.sar-button[disabled]) {
  opacity: 0.65;
}
.qf-section {
  margin-top: 28rpx;
}
.qf-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.qf-section__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.qf-empty {
  padding: 48rpx 0;
  text-align: center;
  color: #94a3b8;
  font-size: 26rpx;
  letter-spacing: 1rpx;
}
.qf-record-card {
  margin-bottom: 24rpx;
  padding-bottom: 8rpx;
}
.qf-record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.qf-record-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.qf-field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.qf-field__label {
  font-size: 26rpx;
  color: #475569;
  font-weight: 600;
  line-height: 1.4;
}
.qf-field__label.required::after {
  content: "*";
  color: #dc2626;
  margin-left: 8rpx;
  font-size: 24rpx;
}
.qf-field__input {
  min-height: 76rpx;
  padding: 18rpx 24rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  color: #111827;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  line-height: 1.4;
}
.qf-field__input.is-placeholder {
  color: #9ca3af;
}
.qf-textarea {
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
.qf-textarea:disabled {
  color: #9ca3af;
}
.qf-section :deep(.sar-input__wrapper),
.qf-section :deep(.sar-datetime-picker-input__wrapper) {
  border-radius: 18rpx;
  background: #f8fafc;
}
</style>
