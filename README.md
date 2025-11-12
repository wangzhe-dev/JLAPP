# 项目简介

> **📖 重要文档快速导航**
> - 🔧 开发规范 & 多端/打包注意事项：[contribution-guidelines.md](./docs/contribution-guidelines.md)
> - 📦 多端打包部署指南：[README_BUILD.md](./README_BUILD.md)
> - ⚡ 性能优化指南：[PERFORMANCE.md](./PERFORMANCE.md)
> - 📝 动态表单文档：[CForm 动态表单指南](./docs/components/CForm.md)

基于 uni-app 的 Vue3 + TypeScript 快速开发模板，集成 sard-uniapp-ui、Vite、luch-request、Pinia 及 ESLint，旨在为跨平台应用开发提供高效、规范的基础环境，支持快速构建微信小程序、H5、App 等多端应用。

## 项目特点

- **技术栈前沿**：采用 Vue3 响应式系统，结合 Vite 高效构建工具，提升开发体验。
- **状态管理**：集成 Pinia，提供更简洁、可扩展的状态管理方案。
- **多端支持**：一套代码，支持 H5、微信小程序、支付宝小程序、百度小程序、Android、iOS 全平台部署。
- **性能优化**：内置请求缓存、图片优化、代码分割等性能优化方案，详见 [PERFORMANCE.md](./PERFORMANCE.md)。
- **跨平台适配**：完善的平台检测和样式适配方案，自动处理安全区域、状态栏等平台差异。

> 迭代问题与解决方案日志：见 [docs/issues-log.md](./docs/issues-log.md)


> 说明：`apiPrefix` 现在由 `import.meta.env.VITE_API_PREFIX` 动态注入；若修改 `.env` 后未生效，请重新启动 dev 服务。

### 自定义 TabBar 迁移概览

项目已移除原生 `pages.json -> tabBar`，采用自定义组件 `AppTabbar`：

```vue
<PageLayout :withTabbar="true">
  <!-- 页面主体 -->
  <AppTabbar :tabs="tabs" :blur="true" />
</PageLayout>
```

核心文件：

- `src/components/app-tabbar/AppTabbar.vue`
- `src/components/c-page-layout/PageLayout.vue` (`withTabbar` 补白处理)
- `src/config/tabbar.ts`（集中 tab 配置）
- `src/stores/message.ts`（动态徽标 unreadCount）

动态徽标示例：

```ts
import { computed } from 'vue'
import { defaultTabs } from '@/config/tabbar'
import { useMessageStore } from '@/stores/message'

const messageStore = useMessageStore()

// 根据消息未读数动态替换消息 Tab 的 badge
const tabs = computed(() =>
  defaultTabs.map(t =>
    t.path.includes('/pages/message/')
      ? { ...t, badge: messageStore.unreadCount }
      : t
  )
)
```

更多背景、问题定位与 Roadmap 请查看问题记录文档。

## 目录结构

```text
├── .husky/             # Git钩子配置
│   ├── _/
│   ├── commit-msg      # 提交信息校验钩子
│   └── pre-commit      # 提交前检查钩子
├── src/                # 主源码目录
│   ├── App.vue         # 应用根组件
│   ├── androidPrivacy.json # Android隐私协议
│   ├── api/            # API 接口封装
│   ├── config.ts       # 项目配置文件
│   ├── env.d.ts        # 环境类型声明
│   ├── main.ts         # 应用入口文件
│   ├── manifest.json   # 应用配置（如小程序 AppID）
│   ├── mixin/          # 全局混入
│   ├── pages/          # 页面文件
│   ├── pages.json      # 页面路由及全局配置
│   ├── shime-uni.d.ts  # uni-app类型声明
│   ├── static/         # 静态资源（图片、CSS）
│   ├── stores/         # Pinia 状态管理
│   ├── types/          # 类型声明
│   ├── uni.scss        # 全局 SCSS 样式
│   ├── uni_modules/    # uni-app 模块
│   └── utils/          # 工具函数库
│       ├── common/     # 通用工具
│       ├── app.ts      # App相关工具
│       ├── h5.ts       # H5相关工具
│       ├── request.ts  # 请求封装
│       └── weixin.ts   # 微信小程序工具
├── .eslintignore       # ESLint 忽略文件配置
├── .eslintrc-auto-import.json # 自动导入ESLint配置
├── .eslintrc.js        # ESLint 规则配置
├── .gitignore          # Git 忽略文件配置
├── LICENSE             # 项目许可证
├── README.md           # 项目说明文档
├── commitlint.config.js # Git提交规范配置
├── index.html          # 入口 HTML 文件
├── package.json        # 项目依赖及脚本配置
├── shims-uni.d.ts      # uni-app 类型声明
├── tsconfig.json       # TypeScript 配置文件
└── vite.config.ts      # Vite 构建配置
```

## 技术栈

- **框架**：Vue3、uni-app
- **状态管理**：Pinia
- **构建工具**：Vite
- **请求库**：luch-request
- **UI 组件库**：sard-uniapp（[官方文档](https://sard.wzt.zone/sard-uniapp-docs/guide/intro)）
- **代码规范**：ESLint
- **类型系统**：全面采用 TypeScript 开发，提供完整类型定义，增强代码健壮性和开发体验。

## 使用教程

### 多端差异快速提示

- 条件编译：`#ifdef H5` / `#ifdef APP-PLUS` / `#ifdef MP-WEIXIN`
- 所有接口统一走 `http` 封装（含刷新、token 注入、防重复）
- 登录页常量：`loginPage`（禁止写死路径）
- 未授权跳转：`/pages/error/403`；找不到页面：`/pages/error/404`
- 权限映射：`utils/permission.ts` 中 `PAGE_PERMISSION_MAP`


### 环境准备

- 安装 [Node.js](https://nodejs.org/)（v18+）
- 安装 [pnpm](https://pnpm.io/) 包管理器：`npm install -g pnpm`

### 依赖安装

```bash
pnpm install
```

### 运行开发

- **微信小程序**：`pnpm run dev:mp-weixin`
- **H5**：`pnpm run dev:h5`
- **其他平台**：参考 uni-app 文档调整命令（如 `dev:app` 运行 App）

### 构建发布

**使用 npm 命令**：
```bash
pnpm run build:h5          # 打包 H5
pnpm run build:mp-weixin   # 打包微信小程序
pnpm run build:mp-alipay   # 打包支付宝小程序
pnpm run build:mp-baidu    # 打包百度小程序
```

**使用打包脚本**（推荐）：
```bash
chmod +x scripts/build.sh  # 首次使用需要添加执行权限
./scripts/build.sh h5      # 打包 H5
./scripts/build.sh weixin  # 打包微信小程序
./scripts/build.sh all     # 打包所有平台
```

详细的多端打包部署指南请参考：[README_BUILD.md](./README_BUILD.md)

## 功能模块说明

- **API 封装**：`src/api/` 目录提供通用接口请求封装，支持统一处理请求头、错误提示等。
- **状态管理**：`src/store/` 目录使用 Pinia 管理全局状态（如用户信息、应用配置）。
- **工具函数**：`src/utils/` 包含常用工具（如请求封装、数据校验、日期格式化）。
- **权限管理（App Android）**：`src/utils/app.ts` 封装了Android平台权限监听与申请功能，解决上架华为应用市场审核要求
- **数据快捷验证工具**：`src/utils/common/validate.ts` 提供多种验证函数（如`uni.$tao.validate.mobile('13800138000')`校验手机号），覆盖常见业务场景的数据格式校验需求。
- **全局样式**：`src/uni.scss` 定义全局 SCSS 变量及混合，保持样式一致性。
- **页面路由**：`pages.json` 配置页面路径及导航栏样式，支持动态路由。

## Git提交规范

项目采用[Conventional Commits](https://www.conventionalcommits.org/)规范，提交流程如下：

1. 添加修改文件到暂存区：

  ```bash
  git add .
  ```

1. 运行交互式提交命令（选择提交类型和填写提交信息）：

  ```bash
  pnpm cm
  ```

1. 推送代码到远程仓库：

  ```bash
  git push
  ```

提交信息格式要求：

```text
type(scope?): subject

body 可选（描述动机、做法、影响）

footer 可选（关联 issue 或 BREAKING CHANGE）
```

**常用type类型**：

- feat: 新功能
- fix: 修复bug
- docs: 文档变更
- style: 代码格式调整
- refactor: 代码重构
- perf: 性能优化
- test: 测试相关
- build: 对构建过程或构建依赖的变更
- ci: 持续集成（CI）相关配置文件或脚本的变更
- chore: 构建过程或辅助工具的变动
- revert: 恢复之前的提交

**示例**：

```text
feat(login): 添加用户登录功能

添加了基于JWT的用户登录验证功能

Closes #123
```

## 其他

- 使用时记得 sard-uniapp-ui 要更新到最新版即可！
- 随机图片地址（推荐使用第一个地址，加载更快）：
  - <https://loremflickr.com/160/160>
  - <https://picsum.photos/200/200>
- [uniapp-vue3-js-vite-pinia-eslint 快速开发模板](https://gitee.com/my_hujinchen/uniapp-vue3-js-vite-pinia-eslint.git)
