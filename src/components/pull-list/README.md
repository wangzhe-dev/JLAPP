# PullList 精简版说明

> 基于 sard 官方下拉刷新 + 加载更多模式的最小封装；移除复杂卡片/骨架/自定义 Empty/LoadMore 包装，仅保留核心数据加载与常用插槽。

## 特性

- 下拉刷新（`sar-pull-down-refresh`）
- 自动/手动分页加载更多（`sar-load-more`）
- 首次加载覆盖层（可自定义插槽）
- 空/错误/完成 三状态插槽
- 响应 query 变化自动刷新
- AbortController 取消正在进行中的请求（支持快速切换条件）

## Props

| Prop | 说明 | 类型 | 默认 |
|------|------|------|------|
| `request` | 拉取函数 `(params)=>Promise<{list,total?,hasMore?}>` | Function | - |
| `pageSize` | 分页大小 | Number | 20 |
| `immediate` | 挂载后是否自动首刷 | Boolean | true |
| `autoMore` | 滚动触底自动下一页 | Boolean | true |
| `manual` | 关闭自动首刷（需手动 reload） | Boolean | false |
| `query` | 查询参数对象 | Any | - |
| `watchQueryDeep` | 深度监听 query | Boolean | false |
| `height` | 容器高度（内部直接 style） | String | '100%' |
| `transform` | 对每条数据映射处理 | Function | v=>v |
| `emptyText` | 默认空文案 | String | '暂无数据' |
| `finishedText` | 默认完成文案（`finished` 插槽未提供时使用） | String | '没有更多了' |
| `errorText` | 默认错误文案 | String | '加载失败，点击重试' |
| `loadingText` | （保留占位，可用于自定义 first-loading 插槽内） | String | '加载中…' |
| `usePageScroll` | 启用页面自身滚动（H5/小程序） | Boolean | false |
| `keyField` | 指定行主键字段 | String | '' |
| `showFirstLoading` | 是否显示首次加载遮罩 | Boolean | true |
| `firstLoadingText` | 首次加载遮罩默认文字 | String | '加载中...' |

## 插槽 Slots

| 名称 | 作用 | 作用域 |
|------|------|------|
| `item` | 渲染每行数据 | `{ item, index }` |
| `empty` | 自定义空状态 | `{ reload }` |
| `error` | 自定义错误状态 | `{ retry, error }` |
| `finished` | 自定义“没有更多了” | - |
| `top` | 列表顶部附加内容 | - |
| `bottom` | 列表底部附加内容 | - |
| `first-loading` | 首次加载遮罩内容 | - |

## 暴露方法 (via ref)

| 方法 | 说明 |
|------|------|
| `reload()` | 重新加载（重置到第 1 页） |
| `next()` | 手动加载下一页 |
| `refresh()` | 别名，等价 `reload` |
| `setQuery(q)` | 直接替换 query 并触发刷新 |
| `getList()` | 获取内部 list ref |
| `state` | `{ list, page, loading, finished, error }` |

## 使用示例

```vue
<PullList
  ref="pl"
  :request="fetchList"
  :query="query"
  :page-size="10"
  :auto-more="true"
  height="calc(100vh - 120px)"
>
  <template #item="{ item }">
    <view class="row">{{ item.title }}</view>
  </template>
  <template #finished>
    <view class="end">—— 没有更多 ——</view>
  </template>
  <template #first-loading>
    <view class="loading-mask">初次加载中...</view>
  </template>
</PullList>
```

```ts
async function fetchList({ page, pageSize, query }) {
  const res = await api.xxx({ page, pageSize, ...query })
  return {
    list: res.records,
    total: res.total
  }
}
```

## 状态判断逻辑

- `finished`: 通过 `hasMore=false` 或 `total` 推导，无更多页时为 true
- `loadMoreStatus` 映射给 `sar-load-more`: `incomplete | loading | complete | error`

## 迁移提示

旧版本骨架 / Empty / LoadMore 自定义 prop 已删除；若需要扩展请在外部插槽自行实现。

---

如需再添加“错误重试按钮样式”或“内置骨架”请提需求。
