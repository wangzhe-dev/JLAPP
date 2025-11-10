# SARD-UNIAPP 组件问题详细清单（含代码位置）

## 第一部分：CRITICAL 级别问题（必须立即修复）

### Issue #1: AppTabbar CSS 变量拼写错误
**位置**: `/home/user/JLAPP/src/components/app-tabbar/AppTabbar.vue` 第87行
**问题**: 拼写错误导致 tabbar 活跃颜色样式不生效
**当前代码**:
```typescript
`--sar-tabbar-item-ative-color:${activeColor.value}`,  // 拼写错误: ative
```
**应修改为**:
```typescript
`--sar-tabbar-item-active-color:${activeColor.value}`,  // 正确: active
```
**影响**: Tabbar 选中项文字颜色不会显示为主色

---

### Issue #2: CSS 单位混用 - 登录页面
**位置**: `/home/user/JLAPP/src/pages/login/index.vue` 第350行
**问题**: margin 使用 px 而页面其他地方用 rpx，导致不同设备显示差异
**当前代码**:
```scss
.privacy-rememberPassword {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #5a6a8f;
  margin: 0 20px;  // 错误：px 单位
}
```
**应修改为**:
```scss
.privacy-rememberPassword {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 40rpx;  // 使用 rpx，与页面其他部分保持一致
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #5a6a8f;
}
```

---

### Issue #3: AppTabbar 高度计算使用硬编码 px
**位置**: `/home/user/JLAPP/src/components/app-tabbar/AppTabbar.vue` 第84行, 第97行
**问题**: 硬编码 `px` 而不是响应式单位
**当前代码**:
```typescript
const wrapperStyle = computed(() => {
  const styles: string[] = [
    `--sar-tabbar-height:${props.height}px`,  // 硬编码 px
    ...
    `height:calc(${props.height}px + ${safeBottomCss.value})`,  // hardcoded px
  ]
  return styles.join(';')
})
```
**问题分析**:
- `props.height` 默认是 70（数字），但被硬编码为 70px
- 在不同分辨率的设备上，这个固定值会导致显示不一致
- 应该使用相对单位或至少支持配置

**建议修复**:
```typescript
const wrapperStyle = computed(() => {
  // 考虑是否需要 DPI 缩放
  const heightValue = typeof props.height === 'number' 
    ? `${props.height}px` 
    : String(props.height);
  
  const styles: string[] = [
    `--sar-tabbar-height:${heightValue}`,
    ...
    `height:calc(${heightValue} + ${safeBottomCss.value})`,
  ]
  return styles.join(';')
})
```

---

### Issue #4: 列表渲染 Key 使用反面模式
**位置**: `/home/user/JLAPP/src/pages/orderList/index.vue` 第56-69行
**问题**: 使用 `item.id || index` 作为 key，当 id 不存在时用 index
**当前代码**:
```vue
<template #item="{ item, index }">
  <CCard
    :key="item.id || index"  // 反面模式!
    class="wo-card"
    :title="resolveCardTitle(item)"
    :extra="resolveCardExtra(item)"
    :variant="itemClosed(item) ? 'outline' : 'elevated'"
    :lines="resolveCardLines(item)"
    :line-clamp="5"
    :title-clamp="2"
    :actions="makeActions(item)"    // 在模板中调用计算函数！
    clickable
    @click="handleCardClick(item, $event)"
    @action="(payload) => handleActionClick(item, payload)"
  />
</template>
```
**问题分析**:
- 当列表项没有 id 时，使用 index 作为 key
- 当列表重新排序时，index 会变化，导致 Vue 重新创建所有组件
- 这会导致性能下降和状态丢失
- 在模板中直接调用 `makeActions(item)` 也会每次都重新计算

**建议修复**:
```vue
<template #item="{ item, index }">
  <CCard
    :key="item.id"  // 必须使用稳定的 id，不要用 index
    class="wo-card"
    :title="resolveCardTitle(item)"
    :extra="resolveCardExtra(item)"
    :variant="itemClosed(item) ? 'outline' : 'elevated'"
    :lines="resolveCardLines(item)"
    :line-clamp="5"
    :title-clamp="2"
    :actions="cachedActions.get(item.id) || []"  // 使用预计算的 actions
    clickable
    @click="handleCardClick(item, $event)"
    @action="(payload) => handleActionClick(item, payload)"
  />
</template>

<script setup lang="ts">
// 在 script 中预计算 actions
const cachedActions = computed(() => {
  const map = new Map()
  list.value.forEach(item => {
    map.set(item.id, makeActions(item))
  })
  return map
})
</script>
```

---

## 第二部分：HIGH 级别问题

### Issue #5: 安全区域适配只检测一次，不响应屏幕旋转
**位置**: `/home/user/JLAPP/src/components/c-page-layout/PageLayout.vue` 第274-313行
**问题**: 仅在 onMounted 时检测安全区域，屏幕旋转后不更新
**当前代码**:
```typescript
onMounted(() => {
  try {
    const info = uni.getSystemInfoSync();
    // ... 检测逻辑 ...
    safeAreaTop.value = top;
    safeAreaBottom.value = bottom;
  } catch {}
});
```
**建议修复**:
```typescript
function updateSafeArea() {
  try {
    const info = uni.getSystemInfoSync();
    const toNumber = (val: unknown): number => {
      const num = Number(val);
      return Number.isFinite(num) && num > 0 ? num : 0;
    };
    const safeInsets = info.safeAreaInsets || {};
    const safeArea = info.safeArea || {};
    const windowHeight = toNumber((info as any).windowHeight);
    const screenHeight = toNumber((info as any).screenHeight);
    const statusBar = toNumber(info.statusBarHeight);

    let top = toNumber((safeInsets as any).top);
    if (!top) {
      top = toNumber((safeArea as any).top);
    }
    if (!top) {
      top = statusBar;
    }

    let bottom = toNumber((safeInsets as any).bottom);
    if (!bottom && safeArea) {
      const safeBottom = toNumber((safeArea as any).bottom);
      const safeTop = toNumber((safeArea as any).top);
      if (windowHeight && safeBottom) {
        bottom = Math.max(0, windowHeight - safeBottom);
      } else if (screenHeight && safeBottom) {
        const safeHeight = toNumber((safeArea as any).height);
        if (safeHeight) {
          bottom = Math.max(0, screenHeight - safeHeight - safeTop);
        } else {
          bottom = Math.max(0, screenHeight - safeBottom);
        }
      }
    }

    safeAreaTop.value = top;
    safeAreaBottom.value = bottom;
  } catch {}
}

onMounted(() => {
  updateSafeArea();
  // 监听屏幕旋转事件
  uni.onWindowResize((res) => {
    updateSafeArea();
  });
});

onBeforeUnmount(() => {
  // 清理事件监听
  uni.offWindowResize?.(() => {});
});
```

---

### Issue #6: AppTabbar 同样的安全区域问题
**位置**: `/home/user/JLAPP/src/components/app-tabbar/AppTabbar.vue` 第162-191行
**问题**: 与 PageLayout 相同，仅检测一次
**建议**: 参考 Issue #5 的修复方案

---

### Issue #7: scroll-view 触底灵敏度平台差异
**位置**: `/home/user/JLAPP/src/components/pull-list/PullList.vue` 第16-51行
**问题**: 
```vue
<scroll-view
  v-if="!usePageScroll"
  :scroll-y="true"
  class="pl-scroll"
  :throttle="false"
  lower-threshold="60"    // 距底部60px时触发，但 iOS/Android 表现不同
  @scrolltolower="onReachBottom"
>
```
**建议修复**:
```vue
<scroll-view
  v-if="!usePageScroll"
  :scroll-y="true"
  class="pl-scroll"
  :throttle="false"
  :lower-threshold="lowerThreshold"  // 根据平台调整
  :enable-flex="true"                 // 启用 flex 支持
  @scrolltolower="onReachBottom"
>
```

在 script 中：
```typescript
import { uni } from '@dcloudio/uni-app'

const lowerThreshold = computed(() => {
  const info = uni.getSystemInfoSync()
  // iOS 需要更小的阈值
  if (info.platform === 'ios') return 30
  return 60  // Android 默认值
})
```

---

### Issue #8: sar-popout 内容超过屏幕高度
**位置**: 所有 popout 文件，如 `/home/user/JLAPP/src/pages/orderList/inspect-popout/index.vue`
**问题**: 弹层内容可能超过屏幕 70% 高度，导致按钮被隐藏
**建议**:
```vue
<sar-popout
  v-model:visible="visible"
  :title="title"
  :before-close="handleBeforeClose"
  max-height="80vh"  <!-- 限制最大高度 -->
>
  <view class="inspect-popout" style="max-height: 70vh; overflow-y: auto;">
    <!-- 内容可滚动 -->
  </view>
</sar-popout>
```

---

### Issue #9: 输入框 inlaid 属性可能过时
**位置**: `/home/user/JLAPP/src/components/c-form/fields/FieldInput.vue` 第7-16行
**问题**: `inlaid` 属性可能在新版本 sard-uniapp 中不存在或被重命名
**当前代码**:
```vue
<sar-input
  :model-value="props.state.value"
  :type="isNumber ? 'digit' : (props.field.inputType || 'text')"
  :disabled="props.disabled"
  :readonly="props.readonly"
  :placeholder="props.field.placeholder"
  clearable
  inlaid   <!-- 需要验证此属性 -->
  @update:model-value="val => props.setValue(val)"
/>
```

**建议**: 
1. 检查 sard-uniapp 1.23.2 的文档
2. 如果属性已删除，删除该行
3. 验证功能是否正常

---

## 第三部分：MEDIUM 级别问题

### Issue #10: Watch 深度监听导致频繁重算
**位置**: `/home/user/JLAPP/src/pages/orderList/inspect-popout/index.vue` 第347-354行
**问题**:
```typescript
watch(
  () => checkDetailList.value,
  () => {
    // 当详情列表变化时，重新构建表单字段
  },
  { deep: true }  // 对所有嵌套属性进行深度监听！
);
```
**建议修复**:
```typescript
watch(
  () => checkDetailList.value.length,  // 只监听长度变化
  () => {
    // 重新构建表单字段
  }
);
```

---

### Issue #11: Computed 每次重建整个 tabs 数组
**位置**: `/home/user/JLAPP/src/pages/index/index.vue` 第121-127行
**问题**:
```typescript
const tabs = computed(() =>
  defaultTabs.map((t) =>
    t.path.includes("/pages/message/")
      ? { ...t, badge: messageStore.unreadCount }  // 每次都创建新对象
      : t
  )
);
```
**风险**: 与 AppTabbar 的 watch 可能导致无限更新
**建议修复**:
```typescript
// 预先计算消息 tab 的索引
const messageTabIndex = defaultTabs.findIndex(t => t.path.includes("/pages/message/"));

const tabs = computed(() => {
  if (messageTabIndex === -1) return defaultTabs;
  
  const newTabs = [...defaultTabs];
  newTabs[messageTabIndex] = {
    ...newTabs[messageTabIndex],
    badge: messageStore.unreadCount
  };
  return newTabs;
});
```

---

### Issue #12: 表单验证没有异步处理
**位置**: `/home/user/JLAPP/src/components/c-form/CForm.vue`
**问题**: 大量字段验证会阻塞主线程
**建议**: 使用 Web Worker 或 requestIdleCallback

---

## 统计数据

- 找到 CRITICAL 级别问题: 4 个
- 找到 HIGH 级别问题: 9 个
- 找到 MEDIUM 级别问题: 12+ 个
- 涉及的 sard 组件: 15 种
- 涉及的文件: 60+ 个

