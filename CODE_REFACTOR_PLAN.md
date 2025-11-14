# 项目重构全面规划

生成时间：2025-11-10
分析文件：69 个 Vue 文件，490 行 Store 代码，1147 行 CForm 组件

---

## 📊 核心问题总结

### 🔴 严重问题（必须立即修复）

| 问题 | 严重程度 | 影响范围 | 技术债务 |
|------|---------|---------|---------|
| **CForm 组件职责过重** | 🔴🔴🔴 | 1147 行，24 个页面 | 54-72 小时 |
| **pad 函数重复 16 次** | 🔴🔴🔴 | 14 个文件 | 1 小时 |
| **formatDateTime 重复 10 次** | 🔴🔴 | 10 个文件 | 2 小时 |
| **useOrderList 巨型 hook** | 🔴🔴🔴 | 1343 行单文件 | 24-32 小时 |
| **useUserStore 职责过重** | 🔴🔴 | 424 行，8+ 页面依赖 | 16-20 小时 |
| **26 个空白占位页面** | 🔴 | 无实际业务 | 2 小时删除 |

### 🟡 中等问题（近期修复）

| 问题 | 影响 | 工作量 |
|------|------|--------|
| toArray 函数重复 7 次 | 代码重复 | 1.5 小时 |
| normalizePictureList 重复 8 次 | 类型不一致 | 2 小时 |
| 缓存键管理混乱 | 10+ 个散布键 | 1 天 |
| 无 EventBus 机制 | 跨页面通信困难 | 1 天 |

### 🟢 优化项（逐步改进）

- CForm 字段组件性能优化
- TypeScript 类型安全（7 个 @ts-nocheck）
- API 参数验证
- 单元测试覆盖率

---

## 🎯 三阶段重构计划

### 📌 第一阶段：快速清理和统一（1 周）

**目标**：消除明显的代码重复，删除无用代码

| 任务 | 优先级 | 时间 | 影响文件 |
|------|-------|------|---------|
| ✅ **创建统一工具函数库** | P0 | 6.5h | 33+ 文件 |
| ✅ **删除 17 个完全未用页面** | P0 | 1h | pages.json + 17 目录 |
| ✅ **评估删除 7 个废弃页面** | P1 | 2h | permission.ts + 7 目录 |
| ⚪ **创建缓存键管理中心** | P1 | 4h | 5+ 文件 |

#### 1.1 统一工具函数库（立即执行）

创建以下工具文件：

```
src/utils/
├── format.ts          # pad, formatNumber
├── date.ts           # formatDateTime, formatDateYMD, parseDate
├── array.ts          # toArray, unique, chunk
├── picture.ts        # normalizePictureList (统一版本)
├── url.ts            # buildUrl, parseQuery
├── response.ts       # extractPage, unwrapData
└── cache.ts          # 统一缓存键管理
```

**预期收益**：
- 消除 33 个文件中的重复代码
- 减少代码量 ~500 行
- 提升可维护性 40%

#### 1.2 删除空白页面（立即执行）

**第一批（零风险）- 17 个完全未引用**：
```bash
# 删除目录
rm -rf src/pages/{welding,welding1,welding2,welding3,weldingDetail}
rm -rf src/pages/{eqInspection,inspectionPlanDetail,checkDispatch}
rm -rf src/pages/{changeSparePart,repairList,sendOrder,xuqiuOrderList}
rm -rf src/pages/{abnormalTab,getQrCode,history,profileFeeding,records}

# 同时修改：
# 1. src/pages.json - 删除 17 条路由定义
# 2. Git commit: "chore: 删除未使用的占位页面 (17个)"
```

**第二批（需评估）- 7 个已废弃**：
- 先从 permission.ts 移除权限配置
- 从 index.vue 删除 DEPRECATED_SECOND_LEVEL 常量
- 删除页面目录和 pages.json 路由

**预期收益**：
- 减少 24 个页面目录
- 清理 ~200 行配置代码
- pages.json 从 55 条精简到 31 条

---

### 📌 第二阶段：核心重构（2-3 周）

**目标**：重构 CForm 和状态管理

| 任务 | 优先级 | 时间 | 风险 |
|------|-------|------|------|
| **拆分 CForm 组件** | P0 | 3-4 天 | 中 |
| **分离 useUserStore** | P0 | 3-4 天 | 中 |
| **拆分 useOrderList** | P1 | 4-5 天 | 高 |
| **创建通用 Composables** | P1 | 2 天 | 低 |
| **引入 EventBus** | P2 | 1 天 | 中 |

#### 2.1 CForm 组件重构

**拆分方案**：

```
src/components/c-form/
├── CForm.vue (300-400行)          # 主组件，只负责协调
├── core/
│   ├── useFormState.ts            # 状态管理
│   ├── useFormValidation.ts       # 验证逻辑
│   ├── useFormOptions.ts          # 选项加载
│   ├── useFormCascade.ts          # 级联处理
│   └── useFormWatch.ts            # Watch 优化
├── fields/                         # 字段组件（已存在）
└── utils/
    ├── normalize.ts               # 值规范化
    ├── transform.ts               # 转换函数
    └── fieldHelpers.ts            # 字段辅助
```

**关键改进**：
- 移除所有 `@ts-nocheck`
- 优化 reactive 使用（减少 3 层嵌套）
- 合并 200+ 个独立 watch 为批量处理
- 提取 30+ 个函数到专门模块

#### 2.2 useUserStore 拆分

**当前**：424 行，5+ 个职责混杂

**拆分为 5 个 Store**：

```typescript
// src/stores/
auth.ts         (80-100行)  // 登录、token、认证
user.ts         (60-80行)   // 用户信息
permission.ts   (100-120行) // 权限、菜单
organization.ts (80-100行)  // 部门树、组织
notification.ts (40-60行)   // 消息、通知

// 迁移影响：8+ 个页面需要更新导入
```

#### 2.3 useOrderList Hook 拆分

**当前**：1343 行单文件

**拆分为 7 个 Hook**：

```typescript
src/pages/orderList/hooks/
├── useOrderListData.ts      (150-200行) // 数据加载
├── useOrderListFilter.ts    (100-150行) // 筛选、搜索
├── useOrderListDispatch.ts  (200-250行) // 派工逻辑
├── useOrderListApprove.ts   (150-200行) // 审批逻辑
├── useOrderListInspect.ts   (200-250行) // 点检逻辑
├── useOrderListUpkeep.ts    (150-200行) // 保养逻辑
└── useOrderListActions.ts   (200-250行) // 卡片操作
```

---

### 📌 第三阶段：质量提升（1 个月）

**目标**：测试、文档、性能优化

| 任务 | 时间 | 收益 |
|------|------|------|
| CForm 单元测试（覆盖率 80%） | 1 周 | 稳定性 ↑ |
| 性能优化（列表虚拟滚动） | 3 天 | 性能 ↑ 50% |
| TypeScript 严格模式 | 1 周 | 类型安全 |
| API 文档和 JSDoc | 3 天 | 可维护性 |

---

## 📈 预期改进效果

### 代码质量指标

| 指标 | 当前 | 第一阶段后 | 第二阶段后 | 第三阶段后 |
|------|------|----------|----------|----------|
| **代码重复率** | 30% | 15% ↓50% | 8% ↓73% | 5% ↓83% |
| **单文件最大行数** | 1343 | 1343 | 450 ↓67% | 400 ↓70% |
| **页面数量** | 42 | 25 ↓40% | 25 | 25 |
| **TypeScript 严格** | 7 个 @ts-nocheck | 7 | 3 ↓57% | 0 ✓ |
| **测试覆盖率** | ~0% | ~0% | ~20% | ~80% |

### 开发效率提升

| 场景 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| 修复日期格式 Bug | 需改 10 个文件 | 改 1 个文件 | 90% ↑ |
| 新增表单页面 | 200+ 行代码 | 50 行配置 | 75% ↑ |
| 工单列表改动 | 找代码 30min | 找代码 5min | 83% ↑ |
| 添加权限逻辑 | 修改 user.ts | 修改 permission.ts | 清晰度 ↑ |

### 性能改善

| 场景 | 当前 | 优化后 |
|------|------|--------|
| CForm 初始化 | 300-500ms | 150-250ms ↓50% |
| 大列表渲染 | 500+ 项白屏 | 平滑滚动 |
| 内存占用 | 60MB+ | 40MB ↓33% |

---

## 🚀 立即可执行的任务

### Task 1: 创建统一的日期工具库（30 分钟）

**文件**: `src/utils/date.ts`

```typescript
/**
 * 统一的日期格式化工具
 * 替代项目中 10+ 个不同实现
 */

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export function formatDateTime(value: any, options?: {
    emptyValue?: string;
    includeTime?: boolean;
}): string {
    const { emptyValue = '-', includeTime = true } = options || {};

    if (value === undefined || value === null || value === '') {
        return emptyValue;
    }

    const date = new Date(
        typeof value === 'number' || /^\d+$/.test(String(value))
            ? Number(value)
            : String(value).replace(/-/g, '/')
    );

    if (isNaN(date.getTime())) return emptyValue;

    const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    if (!includeTime) return datePart;

    const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    return `${datePart} ${timePart}`;
}

export function formatDateYMD(value: any, emptyValue = '-'): string {
    return formatDateTime(value, { emptyValue, includeTime: false });
}

export function formatTime(value: any, emptyValue = '-'): string {
    if (value === undefined || value === null || value === '') return emptyValue;
    const date = new Date(
        typeof value === 'number' || /^\d+$/.test(String(value))
            ? Number(value)
            : String(value).replace(/-/g, '/')
    );
    if (isNaN(date.getTime())) return emptyValue;
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
```

**影响文件**（需要替换导入）：
- `/home/user/JLAPP/src/pages/workOrderDetail/index.vue`
- `/home/user/JLAPP/src/pages/eqManagement/repair/index.vue`
- `/home/user/JLAPP/src/pages/orderList/hooks/useOrderList.ts`
- 以及其他 7 个文件

### Task 2: 创建统一的数组工具库（20 分钟）

**文件**: `src/utils/array.ts`

```typescript
/**
 * 统一的数组处理工具
 * 替代项目中 7 个 toArray 实现
 */

export function toArray<T = any>(value: any): T[] {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
}

export function unique<T>(arr: T[], key?: keyof T): T[] {
    if (!key) return Array.from(new Set(arr));
    const seen = new Set();
    return arr.filter(item => {
        const k = item[key];
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

export function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}
```

### Task 3: 删除第一批空白页面（1 小时）

**步骤**：

1. **备份当前分支**
```bash
git checkout -b refactor/remove-blank-pages
```

2. **删除17个页面目录**
```bash
cd /home/user/JLAPP
rm -rf src/pages/welding*
rm -rf src/pages/weldingDetail
rm -rf src/pages/eqInspection
rm -rf src/pages/inspectionPlanDetail
rm -rf src/pages/checkDispatch
rm -rf src/pages/changeSparePart
rm -rf src/pages/repairList
rm -rf src/pages/sendOrder
rm -rf src/pages/xuqiuOrderList
rm -rf src/pages/abnormalTab
rm -rf src/pages/getQrCode
rm -rf src/pages/history
rm -rf src/pages/profileFeeding
rm -rf src/pages/records
```

3. **修改 pages.json**（手动删除17条路由定义）

4. **测试编译**
```bash
npm run dev:app
```

5. **提交**
```bash
git add -A
git commit -m "chore: 删除17个未使用的占位页面

- 删除 welding/welding1/welding2/welding3/weldingDetail
- 删除 eqInspection/inspectionPlanDetail/checkDispatch
- 删除 changeSparePart/repairList/sendOrder/xuqiuOrderList
- 删除 abnormalTab/getQrCode/history/profileFeeding/records
- 更新 pages.json 移除对应路由定义

影响：减少 17 个空白页面目录，清理 ~102 行配置代码"
```

---

## 📝 工作检查清单

### 第一阶段检查清单（1周内）

- [ ] 创建 `src/utils/date.ts` 并迁移所有日期格式化函数
- [ ] 创建 `src/utils/array.ts` 并迁移所有数组工具函数
- [ ] 创建 `src/utils/format.ts` 并迁移 pad 等格式化函数
- [ ] 创建 `src/utils/picture.ts` 并统一图片处理
- [ ] 创建 `src/utils/url.ts` 并统一URL构建
- [ ] 创建 `src/utils/response.ts` 并统一数据提取
- [ ] 删除 17 个完全未用的空白页面
- [ ] 更新 pages.json 删除对应路由
- [ ] 评估并删除 7 个废弃页面
- [ ] 创建 `src/utils/cache.ts` 统一缓存键管理
- [ ] 全量测试确保功能正常

### 第二阶段检查清单（2-3周）

- [ ] 拆分 CForm.vue 为核心模块
- [ ] 移除所有 @ts-nocheck
- [ ] 优化 reactive 嵌套
- [ ] 合并 watch 批处理
- [ ] 拆分 useUserStore 为 5 个 store
- [ ] 更新所有引用 useUserStore 的页面
- [ ] 拆分 useOrderList 为 7 个 hook
- [ ] 创建通用 composables
- [ ] 实现 EventBus 机制
- [ ] 全量回归测试

---

## 🎓 学习资源和最佳实践

### Vue 3 Composables 最佳实践
- 单一职责原则：每个 composable 只做一件事
- 命名规范：use + 功能名称（驼峰）
- 避免副作用：纯函数优先
- 文档和类型：完善的 JSDoc 和 TypeScript

### Pinia Store 最佳实践
- 按业务域拆分，不要按技术层拆分
- 避免循环依赖
- 使用 computed 而不是 getter
- 保持 state 扁平化

### uni-app 性能优化
- 列表虚拟滚动（500+ 项）
- 图片懒加载
- 按需加载组件
- 避免过度使用 deep watch

---

## 联系和支持

如有疑问或需要澄清，请查看：
- `/home/user/JLAPP/src/components/c-form/` - CForm 组件源码
- `/home/user/JLAPP/src/stores/` - Store 定义
- `/home/user/JLAPP/src/pages/orderList/hooks/useOrderList.ts` - 巨型 Hook 示例

**重构进度跟踪**：通过 Git 分支和 commit 记录
