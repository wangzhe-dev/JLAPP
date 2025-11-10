<template>
  <view
    class="message-page"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <PageLayout title="消息列表" :showBack="true" :sticky-toolbar="true">
      <template #nav-right>
        <view
          class="nav-action"
          :class="{ disabled: activeTabName === '1' || marking }"
          @click="markAllRead"
        >{{ marking ? "处理中…" : "一键已读" }}</view>
      </template>

      <template #toolbar>
        <CTabs
          v-model="activeTabName"
          :tabs="tabs"
          type="line"
          :scrollable="'auto'"
          :lazy-render="true"
          :animated="true"
          :duration="0.25"
        />
      </template>

      <!-- 列表部分：使用 PullList 直接（消息需要自定义卡片布局） -->
      <PullList
        ref="listRef"
        class="msg-pull-list"
        :request="request"
        :query="query"
        :page-size="pageSize"
        :auto-more="true"
        :immediate="false"
        :pull-enabled="true"
        :height="listHeight"
        @loaded="onLoaded"
        @error="onError"
      >
        <!-- 首次加载遮罩插槽（可自定义 skeleton/文字） -->
        <template #first-loading>
          <view class="msg-first-loading">加载消息中...</view>
        </template>
        <template #item="{ item, index }">
          <CCard
            @click="openDetail(item)"
            :key="item.id || index"
            class="msg-card"
            :title="resolveCardTitle(item)"
            :subtitle="resolveCardSubtitle(item)"
            :extra="resolveCardExtra(item)"
            :variant="resolveCardVariant(item)"
            :content="resolveCardContent(item)"
            :line-clamp="4"
            :title-clamp="2"
            clickable
          />
        </template>

        <template #empty>
          <view class="empty-block">
            <text class="empty-text">暂无消息</text>
          </view>
        </template>
        <template #error="{ retry }">
          <view class="error-block" @click="retry()">
            <text class="error-text">加载失败，点击重试</text>
          </view>
        </template>
        <template #finished>
          <view class="finished-block">—— 已到底 ——</view>
        </template>
      </PullList>
    </PageLayout>
  </view>
</template>

<script setup lang="ts">
// @ts-nocheck  首次迁移阶段放宽 TS
import { ref, nextTick, watch, onMounted } from "vue";
import PageLayout from "@/components/c-page-layout/PageLayout.vue";
import CTabs from "@/components/c-tabs/CTabs.vue";
import PullList from "@/components/pull-list/PullList.vue";
import CCard from "@/components/c-card/CCard.vue";
import { useUserStore } from "@/stores/user";
import { http } from "@/utils/request";
import { EP } from "@/api/endpoints";
import { pad } from "@/utils/format";

// ===== Tabs 配置 =====
// 统一使用字符串 name，避免与 CTabs 默认 numeric 0 造成首次不匹配
const tabs = [
  { name: "0", title: "未读" },
  { name: "1", title: "已读" }
];
const activeTabName = ref<string>("0");

// 查询参数：未读接口需要 beRead=0；已读根据策略可能不需要（由后端或本地过滤）
const query = ref({ beRead: 0 });

// 列表高度：扣掉导航与tabs（估算，可后续抽象）
const listHeight = "calc(100vh - 120px)"; // 视设计适当微调
const pageSize = 10;

// 用户消息数量统计更新
const userStore = useUserStore();

// ================= MOCK 支持（仅开发调试样式使用） =================
// 通过环境变量控制是否使用本地 MOCK（默认关闭）
// 设置 VITE_MSG_USE_MOCK=1 启用
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// PullList request 适配：统一返回 { list, total?, hasMore? }
async function request({ page, pageSize, query, signal }) {
  const beReadFlag = Number(query?.beRead ?? 0);
  const payload = {
    sourceList: [6, 7, 8, 9],
    beRead: beReadFlag,
    pageNum: page,
    pageSize
  };
  const res: any = await http.post(EP.USER_MESSAGE_PAGE, payload, { signal });
  const data = res && typeof res === "object" ? res : {};
  const records = Array.isArray(data.records)
    ? data.records
    : Array.isArray((data as any).rows)
    ? (data as any).rows
    : Array.isArray((data as any).list)
    ? (data as any).list
    : [];
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.totalCount === "number"
      ? data.totalCount
      : typeof data.totalRows === "number"
      ? data.totalRows
      : records.length;
  return { list: records, total };
}

function resolveCardVariant(item: any) {
  return item?.readTime ? "outline" : "elevated";
}

function resolveCardTitle(item: any) {
  return (
    item?.themeName ||
    item?.title ||
    item?.messageTitle ||
    item?.theme ||
    (item?.id ? `消息#${item.id}` : "消息")
  );
}

function resolveCardSubtitle(item: any) {
  return (
    item?.sourceName ||
    item?.senderName ||
    item?.sendUserName ||
    item?.sourceTypeName ||
    ""
  );
}

function resolveCardContent(item: any) {
  const text =
    item?.content ||
    item?.messageContent ||
    item?.summary ||
    item?.remark ||
    "";
  if (text == null) return "";
  return typeof text === "string" ? text.trim() : String(text);
}

function resolveCardExtra(item: any) {
  const display = formatTime(
    item?.readTime || item?.createTime || item?.sendTime || item?.sendDate
  );
  return display === "-" ? "" : display;
}

function resolveCardLines(item: any) {
  const lines: { label: string; value: string }[] = [];
  const pushLine = (label: string, value: any) => {
    if (value === undefined || value === null) return;
    let str: string;
    if (typeof value === "string") str = value.trim();
    else if (value instanceof Date) str = formatTime(value);
    else str = String(value);
    if (!str) return;
    lines.push({ label, value: str });
  };

  pushLine("消息来源", item?.sourceName || item?.sourceTypeName);
  const publishTime = formatTime(item?.createTime || item?.sendTime);
  if (publishTime !== "-") pushLine("推送时间", publishTime);
  const readTime = item?.readTime ? formatTime(item.readTime) : "-";
  if (readTime !== "-") pushLine("阅读时间", readTime);
  pushLine("发送人", item?.senderName || item?.sendUserName || item?.sendName);
  if (item?.remark) pushLine("备注", item.remark);
  return lines;
}

function formatTime(v?: string | number | Date) {
  if (v === undefined || v === null || v === "") return "-";
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "-";
    return formatDate(v);
  }
  const str = String(v);
  if (/^\d+$/.test(str)) {
    const d = new Date(Number(str));
    if (isNaN(d.getTime())) return "-";
    return formatDate(d);
  }
  const d = new Date(str.replace(/-/g, "/"));
  if (isNaN(d.getTime())) return str;
  return formatDate(d);
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function applyTabQuery(name: string) {
  query.value = name === "0" ? { beRead: 0 } : { beRead: 1 };
  // 不需要手动调用 reload，因为 PullList 的 watch 会自动监听 query 变化并触发 reload
  nextTick(() => {
    uni.pageScrollTo({ scrollTop: 0, duration: 0 });
  });
}

watch(activeTabName, (name, oldName) => {
  if (name === oldName) return;
  applyTabQuery(name);
});

onMounted(() => {
  applyTabQuery(activeTabName.value);
});

function onLoaded(payload: any) {
  if (activeTabName.value === "0") {
    try {
      userStore.setMessage(payload.total ?? payload.added ?? 0);
    } catch {}
  }
}
function onError(e: any) {
  console.warn("[MessageList] load error", e);
}

// 打开详情（未读 -> 标记已读 & 更新 store 再刷新列表）
function openDetail(item: any) {
  if (activeTabName.value === "1") return;
  if (item.source == 9) {
    uni.showToast({ title: "暂不支持跳转", icon: "none" });
    // uni.navigateTo({
    //   url: `/pages/exceptionManagement/exceptionDispose/index)}`
    // });

  } else {
    //工单管理
    const list = [
      { text: "a", value: 8 },
      { text: "b", value: 7 },
      { text: "c", value: 6 }
    ];
    userStore.getMessage("source", "2");
    userStore.getMessage(
      "type",
      list.find(it => it.value === item.source).text
    ); //到时候根据消息对应类型保存
    uni.navigateTo({
      url: `/pages/orderList/index?mode=edit&id=${encodeURIComponent(item.id)}`
    });
    // this.$router.push("/pages/eqManagement/orderManagement/index");
  }

  // // 这里可跳转或直接调用已读接口（单条）; 暂作跳转占位 & 重新统计
  // userStore.getMessage();
  // TODO: navigate to detail when route available
}

// 一键已读
const marking = ref(false);
async function markAllRead() {
  if (marking.value) return;
  if (activeTabName.value === "1") return;
  marking.value = true;
  try {
    await http.post(EP.USER_MESSAGE_MARK_ALL_READ, {});
    // 刷新未读统计与当前列表
    userStore.getMessage();
    listRef.value?.reload?.();
  } catch (e) {
    uni.showToast({ title: "操作失败", icon: "none" });
  } finally {
    marking.value = false;
  }
}

// 列表 ref
const listRef = ref<any>(null);

// 进入页面自动加载（若未加载过）
onShow(() => {
  listRef.value?.reload?.();
});

// ===== 手势滑动切换 Tab =====
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchSuppressed = ref(false);

function onTouchStart(e: TouchEvent) {
  const touch = e.touches?.[0];
  if (!touch) return;
  touchStartX.value = touch.clientX;
  touchStartY.value = touch.clientY;
  touchSuppressed.value = false;
}

function onTouchMove(e: TouchEvent) {
  if (touchSuppressed.value) return;
  const touch = e.touches?.[0];
  if (!touch) return;
  const dx = touch.clientX - touchStartX.value;
  const dy = Math.abs(touch.clientY - touchStartY.value);
  if (dy > Math.abs(dx)) touchSuppressed.value = true;
}

function onTouchEnd(e: TouchEvent) {
  if (touchSuppressed.value) return;
  const touch = e.changedTouches?.[0];
  if (!touch) return;
  const dx = touch.clientX - touchStartX.value;
  const dy = Math.abs(touch.clientY - touchStartY.value);
  if (Math.abs(dx) < 60 || dy > 40) return;
  if (dx < 0) switchTab(1);
  else switchTab(-1);
}

function switchTab(offset: number) {
  const idx = tabs.findIndex(t => t.name === activeTabName.value);
  if (idx === -1) return;
  const nextIdx = idx + offset;
  if (nextIdx < 0 || nextIdx >= tabs.length) return;
  activeTabName.value = tabs[nextIdx].name;
}
</script>

<style scoped lang="scss">
// @use '@/styles/theme.scss' as *;

.message-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.nav-action {
  padding: 0 12px;
  font-size: 14px;
  line-height: 32px;
  color: #fff;
  opacity: 0.95;
}
.nav-action.disabled {
  opacity: 0.4;
}

.msg-pull-list {
  flex: 1;
}

/* 若 PageLayout 的 sticky-toolbar 未覆盖，可兜底再加一层保证 tabs 吸顶 */
:deep(.pl-toolbar) {
  position: sticky;
  top: 0;
  z-index: 9;
  background: #f6f8fa;
}
:deep(.pl-toolbar.pl-toolbar--sticky) {
  background: #f6f8fa;
}
</style>
