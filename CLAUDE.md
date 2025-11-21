# CLAUDE.md - AI Assistant Guide for JLAPP

> **Last Updated**: 2025-11-21
> **Project**: uni-app Vue3 TypeScript Multi-Platform Application
> **Version**: 0.0.3

This document provides comprehensive guidance for AI assistants working with this codebase. It covers architecture, conventions, workflows, and important considerations.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Development Workflows](#development-workflows)
5. [Architecture Patterns](#architecture-patterns)
6. [Coding Conventions](#coding-conventions)
7. [Common Tasks](#common-tasks)
8. [Important Constraints](#important-constraints)
9. [Debugging and Testing](#debugging-and-testing)
10. [Platform-Specific Considerations](#platform-specific-considerations)

---

## Project Overview

### What is this project?

A **production-grade uni-app application** built with Vue3 + TypeScript for multi-platform deployment (H5, WeChat Mini-Program, App). The application is a Manufacturing Operations Management (MOM) system with features for:

- Equipment management
- Quality control and inspection
- Work order management
- Exception handling
- User authentication and permissions
- Real-time messaging

### Key Characteristics

- **Enterprise-level**: Production-ready with comprehensive error handling, validation, and security
- **Type-safe**: Strict TypeScript throughout with comprehensive type definitions
- **Multi-platform**: Single codebase deploys to H5, WeChat Mini-Program, and native App
- **Modular**: Clear separation of concerns with well-organized directory structure
- **Developer-friendly**: Auto-imports, debug switches, extensive utilities

---

## Technology Stack

### Core Framework
- **Vue 3.5.15**: Composition API with `<script setup>`
- **uni-app**: Cross-platform framework (v3.0.0-4060620250520001)
- **TypeScript 5.4.0**: Strict mode enabled
- **Vite 5.2.8**: Build tool and dev server

### State & Data
- **Pinia 2.2.4**: State management with composition-style stores
- **pinia-plugin-unistorage**: Automatic state persistence across sessions
- **Custom HTTP wrapper**: Built on `uni.request` (not luch-request)

### UI & Components
- **sard-uniapp 1.23.2**: Primary UI component library
- **Custom components**: Prefixed with `c-` (CForm, CCard, CButton, etc.)

### Development Tools
- **ESLint**: Code quality (vue3-recommended + TypeScript)
- **Husky**: Git hooks for commit validation
- **Commitizen**: Interactive commit messages (Chinese)
- **unplugin-auto-import**: Auto-import Vue/uni-app APIs

---

## Directory Structure

```
/home/user/JLAPP/
├── .env.development          # Dev environment variables
├── .env.production           # Production environment variables
├── .eslintrc.cjs             # ESLint configuration
├── .gitignore                # Git ignore rules
├── commitlint.config.js      # Commit message validation
├── index.html                # H5 entry point
├── package.json              # Dependencies and scripts
├── pnpm-lock.yaml            # Locked dependencies
├── tsconfig.json             # TypeScript config (strict mode)
├── tsconfig.relaxed.json     # Relaxed mode for type checking
├── vite.config.ts            # Vite build configuration
│
└── src/                      # Main source directory
    ├── App.vue               # Root application component
    ├── main.ts               # Application entry point
    ├── pages.json            # Page routing configuration (56 pages)
    ├── manifest.json         # App manifest (AppID, permissions)
    ├── uni.scss              # Global SCSS variables
    ├── config.ts             # Runtime configuration
    ├── env.d.ts              # Environment type declarations
    │
    ├── api/                  # API endpoint definitions
    │   ├── endpoints.ts      # Centralized endpoint constants
    │   ├── user.ts           # User-related APIs
    │   ├── order.ts          # Work order APIs
    │   ├── exception.ts      # Exception management
    │   ├── inspection.ts     # Inspection APIs
    │   ├── dict.ts           # Dictionary APIs
    │   └── common.ts         # Common APIs
    │
    ├── components/           # Reusable Vue components
    │   ├── app-tabbar/       # Custom TabBar implementation
    │   ├── c-button/         # Custom button wrapper
    │   ├── c-card/           # Card container
    │   ├── c-form/           # Dynamic form system ⭐
    │   │   ├── CForm.vue
    │   │   ├── fields/       # Field components
    │   │   ├── types.ts
    │   │   └── useValidation.ts
    │   ├── c-page-layout/    # Unified page layout
    │   ├── c-tabs/           # Tab navigation
    │   ├── pull-list/        # Pull-to-refresh list ⭐
    │   └── image-grid/       # Image grid display
    │
    ├── composables/          # Vue composition functions
    │   └── useTabSwipe.ts    # Touch-based tab switching
    │
    ├── config/               # Configuration modules
    │   └── tabbar.ts         # TabBar configuration
    │
    ├── constants/            # Application constants
    │   └── navigation.ts     # Route constants
    │
    ├── network/              # Network utilities
    │   └── http.ts           # HTTP client wrapper
    │
    ├── pages/                # Page components (43 directories)
    │   ├── index/            # Home page
    │   ├── login/            # Login page
    │   ├── my/               # User profile
    │   ├── error/            # Error pages (403, 404)
    │   └── ...               # Other business pages
    │
    ├── static/               # Static assets
    │   ├── images/           # Image files
    │   └── css/              # Additional CSS
    │
    ├── stores/               # Pinia state management
    │   ├── index.ts          # Store exports
    │   ├── user.ts           # User store (main) ⭐
    │   ├── message.ts        # Message/notification store
    │   ├── share.ts          # Share configuration
    │   └── sys-info.ts       # System information
    │
    ├── types/                # TypeScript definitions
    │   ├── api/              # API response types
    │   ├── auto-imports.d.ts # Auto-imported APIs
    │   ├── global.d.ts       # Global declarations
    │   └── platform-globals.d.ts
    │
    ├── utils/                # Utility functions
    │   ├── common/           # Common utilities
    │   │   ├── validate.ts   # 30+ validation functions ⭐
    │   │   └── uniapi.ts     # Global utility APIs
    │   ├── app.ts            # App platform utilities
    │   ├── h5.ts             # H5 platform utilities
    │   ├── weixin.ts         # WeChat platform utilities
    │   ├── request.ts        # HTTP request wrapper ⭐
    │   ├── route-guard.ts    # Navigation guards ⭐
    │   ├── permission.ts     # Permission checks ⭐
    │   └── modal.ts          # Modal helpers
    │
    └── uni_modules/          # uni-app modules
        └── uni-registerRequestPermissionTips/
```

**Legend**: ⭐ = Critical file/component to understand

---

## Development Workflows

### 1. Initial Setup

```bash
# Install dependencies
pnpm install

# Install git hooks
pnpm run prepare
```

### 2. Development

```bash
# H5 development (localhost:8080)
pnpm run dev:h5

# WeChat Mini-Program
pnpm run dev:mp-weixin

# Other platforms
pnpm run dev:mp-alipay     # Alipay
pnpm run dev:mp-baidu      # Baidu
# ... (see package.json for full list)
```

### 3. Type Checking

```bash
# Relaxed type check (recommended during development)
pnpm run type-check

# Strict type check (CI/production)
pnpm run type-check:strict
```

### 4. Building

```bash
# Build for H5
pnpm run build:h5

# Build for WeChat Mini-Program
pnpm run build:mp-weixin

# Other platforms
pnpm run build:mp-alipay
# ... (see package.json)
```

### 5. Git Commit Workflow

**IMPORTANT**: This project uses Conventional Commits with interactive prompts.

```bash
# 1. Stage changes
git add .

# 2. Interactive commit (REQUIRED)
pnpm cm

# This will prompt you to:
# - Select commit type (feat, fix, docs, etc.)
# - Enter scope (optional)
# - Write short description
# - Write long description (optional)
# - Reference issues (optional)

# 3. Push changes
git push
```

**Commit Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (not UI)
- `refactor`: Code restructuring
- `perf`: Performance optimization
- `test`: Test-related changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes
- `revert`: Revert previous commit

**Example Commit Message**:
```
feat(login): 添加用户登录功能

添加了基于JWT的用户登录验证功能

Closes #123
```

---

## Architecture Patterns

### 1. Component Architecture

#### Component Naming
- **Custom components**: `c-*` prefix (e.g., `CForm`, `CButton`, `CCard`)
- **App-level components**: `app-*` prefix (e.g., `AppTabbar`)
- **Page components**: Located in `pages/{module}/index.vue`

#### Component Registration
```typescript
// Global registration in main.ts
app.component('CCard', CCard)
app.component('PageLayout', PageLayout)

// Auto-import via easycom (pages.json)
// Automatically imports sard-uniapp components
"easycom": {
  "custom": {
    "^sar-(.*)": "sard-uniapp/components/$1/$1.vue"
  }
}
```

### 2. API Architecture

#### Endpoint Definition Pattern
```typescript
// 1. Define endpoint constants in api/endpoints.ts
export const EP = {
  AUTH_LOGIN: '/auth/repairAppLogin',
  USER_INFO: '/system/user/getByUserId',
  WORK_ORDER_LIST: '/work-order/list'
} as const

// 2. Create typed API functions in api/{module}.ts
import type { LoginParams, LoginResp } from '@/types/api/user'

export const login = (data: LoginParams) =>
  http.postQuery<LoginResp>(EP.AUTH_LOGIN, data)

export const getInfo = () =>
  http.get<GetInfo.Body>(EP.USER_INFO)

// 3. Use in components
import { login, getInfo } from '@/api/user'

const handleLogin = async () => {
  const result = await login({ username, password })
  if (result) {
    const userInfo = await getInfo()
  }
}
```

#### HTTP Client Methods
- `http.get<T>(url, params?)`: GET request
- `http.post<T>(url, data?)`: POST with JSON body
- `http.postForm<T>(url, data?)`: POST with form data
- `http.postQuery<T>(url, params?)`: POST with query params
- `http.put<T>(url, data?)`: PUT request
- `http.delete<T>(url, params?)`: DELETE request

#### Response Envelope
All API responses are wrapped in:
```typescript
interface ApiEnvelope<T = any> {
  code: number      // 200 = success
  msg?: string      // Error message if failed
  data?: T          // Response payload
}
```

HTTP client automatically unwraps the envelope and returns `data` directly.

### 3. State Management (Pinia)

#### Store Pattern
```typescript
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  // State
  const token = ref<string>('')
  const userInfo = ref<GetInfo.Body | null>()

  // Getters (computed)
  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => userInfo.value?.userName)

  // Actions
  const loginAction = async (credentials: Credentials) => {
    const result = await login(credentials)
    if (result) {
      token.value = result.access_token
      await fetchUserInfo()
    }
  }

  const logoutAction = () => {
    token.value = ''
    userInfo.value = null
  }

  return {
    // State
    token,
    userInfo,
    // Getters
    isLoggedIn,
    userName,
    // Actions
    loginAction,
    logoutAction
  }
}, {
  unistorage: true  // Enable persistence
})
```

#### Using Stores
```typescript
// In component
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// Access state
console.log(userStore.token)
console.log(userStore.isLoggedIn)

// Call actions
await userStore.loginAction({ username, password })
userStore.logoutAction()
```

### 4. Routing & Navigation

#### Route Guards

**Global guard** via mixin in all pages:
```typescript
// src/utils/route-guard.ts
// Automatically checks:
// 1. Token presence
// 2. Page permissions
// 3. User roles/permissions

// Redirects to login if unauthorized
// Stores pending path for post-login redirect
```

**White list**: Pages that don't require authentication
- `/pages/login/index`
- Specified in route-guard.ts

#### Navigation Constants
```typescript
// src/constants/navigation.ts
export const HOME_PAGE = '/pages/index/index'
export const LOGIN_PAGE = '/pages/login/index'
export const ERROR_403 = '/pages/error/403'
export const ERROR_404 = '/pages/error/404'
```

**CRITICAL**: Always use constants, never hardcode paths!

```typescript
// ✅ CORRECT
uni.navigateTo({ url: HOME_PAGE })

// ❌ WRONG
uni.navigateTo({ url: '/pages/index/index' })
```

#### Permission Mapping
```typescript
// src/utils/permission.ts
export const PAGE_PERMISSION_MAP = {
  '/pages/controlManagement/index': {
    roles: ['ADMIN', 'LEADER']
  },
  '/pages/exceptionManagement/index': {
    permissions: ['EXCEPTION_VIEW']
  }
}
```

### 5. Type System

#### Namespace Pattern for API Types
```typescript
// types/api/user.d.ts
export declare namespace GetInfo {
  interface Body {
    userId: string
    userName: string
    avatar: string | null
    roles?: string[]
    permissions?: string[]
  }
}

export declare namespace Login {
  interface Params {
    username: string
    password: string
  }

  interface Response {
    access_token: string
    refresh_token: string
    expires_in: number
  }
}

// Usage
import type { GetInfo, Login } from '@/types/api/user'

const userInfo: GetInfo.Body = await getInfo()
const loginData: Login.Params = { username, password }
```

#### Global Type Augmentation
```typescript
// types/global.d.ts
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_MINIO_BASE?: string
  readonly VITE_API_PREFIX?: string
}

// Extend uni namespace if needed
declare namespace UniNamespace {
  interface Uni {
    $tao: {
      toast: (msg: string) => void
      copy: (text: string) => void
      validate: ValidationUtils
    }
  }
}
```

---

## Coding Conventions

### 1. File Naming

- **Components**: PascalCase (e.g., `CForm.vue`, `AppTabbar.vue`)
- **Utilities**: camelCase (e.g., `request.ts`, `route-guard.ts`)
- **Types**: kebab-case (e.g., `user.d.ts`, `platform-globals.d.ts`)
- **Pages**: lowercase (e.g., `index.vue`, `detail.vue`)

### 2. Import Order

```typescript
// 1. Vue/framework imports
import { ref, computed, onMounted } from 'vue'

// 2. Third-party libraries
import { defineStore } from 'pinia'

// 3. Project types
import type { GetInfo } from '@/types/api/user'

// 4. API functions
import { getInfo, updateInfo } from '@/api/user'

// 5. Stores
import { useUserStore } from '@/stores/user'

// 6. Components
import CButton from '@/components/c-button/CButton.vue'

// 7. Utils
import { toast } from '@/utils/common/uniapi'

// 8. Constants
import { HOME_PAGE } from '@/constants/navigation'
```

### 3. TypeScript Best Practices

```typescript
// ✅ GOOD: Use type imports
import type { User } from '@/types/api/user'

// ❌ AVOID: Regular imports for types
import { User } from '@/types/api/user'

// ✅ GOOD: Explicit return types for complex functions
const processUser = (user: User): ProcessedUser => {
  // ...
}

// ✅ GOOD: Const assertions for constants
export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved'
} as const

// ✅ GOOD: Generic constraints
function getData<T extends { id: string }>(items: T[]): T | null {
  // ...
}
```

### 4. Vue Component Structure

```vue
<script setup lang="ts">
// 1. Imports
import { ref, computed, onMounted } from 'vue'
import type { PropType } from 'vue'

// 2. Props
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})

// 3. Emits
const emit = defineEmits<{
  change: [value: string]
  submit: []
}>()

// 4. Reactive state
const loading = ref(false)
const items = ref<Item[]>([])

// 5. Computed
const total = computed(() => items.value.length)

// 6. Methods
const handleSubmit = () => {
  emit('submit')
}

// 7. Lifecycle
onMounted(() => {
  // Initialize
})

// 8. Expose (if needed)
defineExpose({
  reload: () => { /* ... */ }
})
</script>

<template>
  <view class="container">
    <!-- Template content -->
  </view>
</template>

<style lang="scss" scoped>
.container {
  padding: 20rpx;
}
</style>
```

### 5. Conditional Compilation

For platform-specific code:

```vue
<script setup lang="ts">
// #ifdef H5
import { h5SpecificFunction } from '@/utils/h5'
// #endif

// #ifdef MP-WEIXIN
import { weixinSpecificFunction } from '@/utils/weixin'
// #endif

// #ifdef APP-PLUS
import { appSpecificFunction } from '@/utils/app'
// #endif
</script>

<template>
  <!-- #ifdef H5 -->
  <view class="h5-only">H5 Content</view>
  <!-- #endif -->

  <!-- #ifdef MP-WEIXIN -->
  <view class="wx-only">WeChat Content</view>
  <!-- #endif -->
</template>
```

### 6. Error Handling

```typescript
// ✅ GOOD: Async/await with try-catch
const fetchData = async () => {
  try {
    loading.value = true
    const data = await getInfo()
    items.value = data.list
  } catch (error) {
    console.error('Failed to fetch data:', error)
    uni.$tao.toast('加载失败，请重试')
  } finally {
    loading.value = false
  }
}

// ✅ GOOD: Optional chaining
const userName = userInfo.value?.userName ?? '未知用户'

// ✅ GOOD: Nullish coalescing
const count = props.count ?? 0
```

---

## Common Tasks

### Task 1: Add a New API Endpoint

```typescript
// 1. Add endpoint constant to api/endpoints.ts
export const EP = {
  // ... existing endpoints
  NEW_FEATURE: '/api/new-feature',
} as const

// 2. Define types in types/api/your-module.d.ts
export declare namespace NewFeature {
  interface Params {
    id: string
  }

  interface Response {
    success: boolean
    data: SomeData
  }
}

// 3. Create API function in api/your-module.ts
import type { NewFeature } from '@/types/api/your-module'

export const getNewFeature = (params: NewFeature.Params) =>
  http.get<NewFeature.Response>(EP.NEW_FEATURE, params)

// 4. Use in component
import { getNewFeature } from '@/api/your-module'

const data = await getNewFeature({ id: '123' })
```

### Task 2: Create a New Page

```bash
# 1. Create page directory and file
mkdir -p src/pages/new-page
touch src/pages/new-page/index.vue
```

```json
// 2. Register in pages.json
{
  "pages": [
    {
      "path": "pages/new-page/index",
      "style": {
        "navigationBarTitleText": "New Page Title"
      }
    }
  ]
}
```

```vue
<!-- 3. Create page component (src/pages/new-page/index.vue) -->
<script setup lang="ts">
import { ref } from 'vue'

const data = ref<string>('')
</script>

<template>
  <PageLayout>
    <view class="new-page">
      <!-- Page content -->
    </view>
  </PageLayout>
</template>

<style lang="scss" scoped>
.new-page {
  padding: 20rpx;
}
</style>
```

### Task 3: Add a New Pinia Store

```typescript
// src/stores/your-store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useYourStore = defineStore('your-store', () => {
  // State
  const items = ref<Item[]>([])

  // Getters
  const count = computed(() => items.value.length)

  // Actions
  const addItem = (item: Item) => {
    items.value.push(item)
  }

  const removeItem = (id: string) => {
    items.value = items.value.filter(item => item.id !== id)
  }

  return {
    items,
    count,
    addItem,
    removeItem
  }
}, {
  unistorage: true  // Enable persistence
})
```

```typescript
// src/stores/index.ts - Export the store
export * from './your-store'
```

### Task 4: Add a Custom Component

```bash
# 1. Create component directory
mkdir -p src/components/c-your-component
```

```vue
<!-- 2. Create component (src/components/c-your-component/CYourComponent.vue) -->
<script setup lang="ts">
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <view class="c-your-component" @click="emit('click')">
    <text>{{ title }} - {{ count }}</text>
  </view>
</template>

<style lang="scss" scoped>
.c-your-component {
  padding: 20rpx;
}
</style>
```

```typescript
// 3. Register globally in src/main.ts
import CYourComponent from '@/components/c-your-component/CYourComponent.vue'

app.component('CYourComponent', CYourComponent)
```

### Task 5: Add Validation Function

```typescript
// src/utils/common/validate.ts

/**
 * Validate custom format
 * @param value - Value to validate
 * @returns true if valid, false otherwise
 */
export const customValidation = (value: string): boolean => {
  // Your validation logic
  const regex = /^[A-Z]\d{4}$/
  return regex.test(value)
}

// Make it available globally (if needed)
// src/utils/common/uniapi.ts
export const validate = {
  // ... existing validations
  custom: customValidation
}
```

---

## Important Constraints

### 1. Platform-Specific Limitations

#### WeChat Mini-Program
- No `window`, `document`, `localStorage` (use uni-app APIs)
- Strict content security policy (CSP)
- Limited file system access
- Cannot use certain Node.js modules

#### H5
- Full web APIs available
- Need to handle CORS
- Different routing behavior
- Can use browser-specific features

#### App
- Native capabilities via plus API
- Platform-specific permissions (Android/iOS)
- Different storage mechanisms

### 2. HTTP Request Constraints

```typescript
// ✅ GOOD: Use http wrapper
import { http } from '@/utils/request'
const data = await http.get('/api/endpoint')

// ❌ WRONG: Direct uni.request
uni.request({ url: '/api/endpoint' })

// ✅ GOOD: Use endpoint constants
const data = await http.get(EP.USER_INFO)

// ❌ WRONG: Hardcode URLs
const data = await http.get('/system/user/getByUserId')
```

### 3. Route Navigation Constraints

```typescript
// ✅ GOOD: Use constants
uni.navigateTo({ url: LOGIN_PAGE })

// ❌ WRONG: Hardcoded paths
uni.navigateTo({ url: '/pages/login/index' })

// ✅ GOOD: Use appropriate navigation method
// navigateTo - Keep history (max 10 levels)
// redirectTo - Replace current page
// reLaunch - Close all pages, open new
// switchTab - Switch to tabBar page
```

### 4. State Management Constraints

```typescript
// ✅ GOOD: Use Pinia stores for shared state
const userStore = useUserStore()

// ❌ AVOID: Global variables
// window.globalState = {}

// ✅ GOOD: Composition functions for reusable logic
const { data, loading } = useDataFetch()

// ❌ AVOID: Mixins (Vue 2 pattern)
```

### 5. Styling Constraints

```scss
// ✅ GOOD: Use rpx for responsive sizing
.container {
  width: 750rpx;  // Full width
  padding: 20rpx;
}

// ❌ AVOID: px for dimensions (except borders)
.container {
  width: 375px;  // Not responsive
}

// ✅ GOOD: scoped styles
<style lang="scss" scoped>
```

---

## Debugging and Testing

### Debug Switches (Environment Variables)

```bash
# .env.development

# HTTP debugging
VITE_HTTP_DEBUG=1              # Enable request/response logging
VITE_HTTP_RELAX=1              # Relax HTTP code checks
VITE_HTTP_SKIP_AUTH=1          # Skip token injection
VITE_RELAX_ALL=1               # Bypass all checks (use carefully!)

# Authentication
VITE_DISABLE_AUTH_GUARD=1      # Disable route guards

# API
VITE_API_TARGET=http://localhost:3000  # Backend URL
VITE_API_PREFIX=prod-api       # API path prefix
```

### Debugging Techniques

#### 1. HTTP Requests
```typescript
// Enable in .env.development
VITE_HTTP_DEBUG=1

// Logs will show:
// - Request URL, method, params
// - Response status, data
// - Token injection
// - Error details
```

#### 2. Route Guards
```typescript
// Disable for testing
VITE_DISABLE_AUTH_GUARD=1

// Or check guard logic in src/utils/route-guard.ts
```

#### 3. Console Logging
```typescript
// Development
console.log('[DEBUG]', data)

// Production builds automatically remove console.log
// Keep console.error and console.warn
```

#### 4. Vue DevTools
- Available for H5 development
- Not available for mini-programs (use uni-app DevTools)

### Type Checking

```bash
# Relaxed (faster, for development)
pnpm run type-check

# Strict (for CI/production)
pnpm run type-check:strict
```

---

## Platform-Specific Considerations

### H5 Platform

#### Base Path
```typescript
// vite.config.ts
const base = env.VITE_BASE_H5 || '/jl-app/'

// Deployed at: https://example.com/jl-app/
```

#### API Proxy
```typescript
// Development proxy in vite.config.ts
proxy: {
  '/prod-api': {
    target: 'http://localhost:3000',
    changeOrigin: true
  }
}
```

#### Browser-Specific Features
```typescript
// src/utils/h5.ts
// Use for H5-only functionality
```

### WeChat Mini-Program

#### App ID Configuration
```json
// src/manifest.json
{
  "mp-weixin": {
    "appid": "your-appid"
  }
}
```

#### Platform APIs
```typescript
// src/utils/weixin.ts
// WeChat-specific utilities
```

#### Permissions
- Configure in `src/manifest.json`
- Request at runtime for sensitive permissions

### App Platform (Android/iOS)

#### Android Permissions
```typescript
// src/utils/app.ts
// Android permission listeners for Huawei app store requirements
```

#### Privacy Configuration
```json
// src/androidPrivacy.json
// Android privacy agreement configuration
```

---

## Advanced Features

### 1. Custom TabBar System

**Why Custom?**
- Native tabBar has styling limitations
- Need dynamic badges (unread count)
- Require blur effects

**Implementation**:
```vue
<!-- In tabBar pages -->
<PageLayout :withTabbar="true">
  <template #tabbar>
    <AppTabbar :tabs="tabs" :blur="true" />
  </template>

  <!-- Page content -->
</PageLayout>
```

**Configuration**:
```typescript
// src/config/tabbar.ts
export const defaultTabs: AppTabItem[] = [
  { label: '首页', path: '/pages/index/index', icon: 'home' },
  { label: '我的', path: '/pages/my/index', icon: 'user' }
]
```

**Dynamic Badges**:
```typescript
import { useMessageStore } from '@/stores/message'

const messageStore = useMessageStore()

const tabs = computed(() =>
  defaultTabs.map(t =>
    t.path.includes('/pages/message/')
      ? { ...t, badge: messageStore.unreadCount }
      : t
  )
)
```

### 2. Dynamic Form System (CForm)

**JSON-driven forms** with built-in validation:

```vue
<script setup lang="ts">
import type { FormConfig } from '@/components/c-form/types'

const formConfig: FormConfig = {
  fields: [
    {
      type: 'input',
      name: 'username',
      label: '用户名',
      required: true,
      rules: [{ min: 3, message: '最少3个字符' }]
    },
    {
      type: 'datetime',
      name: 'birthdate',
      label: '出生日期'
    },
    {
      type: 'dict',
      name: 'gender',
      label: '性别',
      dictCode: 'sys_user_sex'
    }
  ]
}

const formRef = ref()

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid) {
    const values = formRef.value?.getValues()
    // Submit values
  }
}
</script>

<template>
  <CForm ref="formRef" :config="formConfig" />
  <CButton @click="handleSubmit">提交</CButton>
</template>
```

**Field Types**:
- `input`: Text input
- `datetime`: Date/time picker
- `dict`: Dictionary dropdown
- `uploader`: File/image uploader
- `scan`: QR/barcode scanner
- Custom fields in `components/c-form/fields/custom/`

### 3. Pull-to-Refresh List (PullList)

**Minimal wrapper** for pull-down refresh + load more:

```vue
<script setup lang="ts">
const fetchList = async ({ page, pageSize, query }) => {
  const res = await api.getWorkOrders({ page, pageSize, ...query })
  return {
    list: res.records,
    total: res.total
  }
}

const query = ref({ status: 'pending' })
</script>

<template>
  <PullList
    :request="fetchList"
    :query="query"
    :page-size="20"
    height="calc(100vh - 120px)"
  >
    <template #item="{ item }">
      <view class="order-item">{{ item.title }}</view>
    </template>
  </PullList>
</template>
```

**Features**:
- Automatic pagination
- Pull-down refresh
- Load more on scroll
- Empty/error/finished states
- Query change auto-refresh
- Request cancellation (AbortController)

### 4. Permission System

**Multi-level access control**:

```typescript
// 1. Route-level (automatic)
// Defined in src/utils/permission.ts
export const PAGE_PERMISSION_MAP = {
  '/pages/admin/index': { roles: ['ADMIN'] },
  '/pages/reports/index': { permissions: ['REPORT_VIEW'] }
}

// 2. Component-level (manual)
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const canEdit = computed(() =>
  userStore.permissions?.includes('ORDER_EDIT')
)
```

### 5. Global Utilities

```typescript
// Available via uni.$tao

// Toast messages
uni.$tao.toast('操作成功')

// Copy to clipboard
uni.$tao.copy('Text to copy')

// Validation
uni.$tao.validate.mobile('13800138000')  // true/false
uni.$tao.validate.email('user@example.com')
uni.$tao.validate.idCard('110101199001011234')

// 30+ validators in src/utils/common/validate.ts
```

---

## Quick Reference

### Essential Files to Understand

1. **src/utils/request.ts** - HTTP client wrapper
2. **src/utils/route-guard.ts** - Navigation guards
3. **src/stores/user.ts** - User authentication & state
4. **src/api/endpoints.ts** - All API endpoints
5. **src/config.ts** - Runtime configuration
6. **vite.config.ts** - Build configuration
7. **pages.json** - Page routing
8. **src/types/** - TypeScript definitions

### Common Pitfalls

1. **Don't hardcode paths** - Use constants from `constants/navigation.ts`
2. **Don't use `uni.request` directly** - Use `http` wrapper
3. **Don't skip type definitions** - Define types for all API responses
4. **Don't forget platform conditionals** - Use `#ifdef` for platform-specific code
5. **Don't bypass route guards in production** - Only use debug flags in development

### Useful Commands

```bash
# Development
pnpm run dev:h5                # H5 development
pnpm run dev:mp-weixin         # WeChat mini-program

# Type checking
pnpm run type-check            # Relaxed mode
pnpm run type-check:strict     # Strict mode

# Git
pnpm cm                        # Interactive commit

# Build
pnpm run build:h5              # Production H5
pnpm run build:mp-weixin       # Production WeChat
```

### Environment Variables

```bash
# API Configuration
VITE_API_TARGET=http://localhost:3000
VITE_API_PREFIX=prod-api
VITE_MINIO_BASE=http://minio.example.com

# Debug Flags
VITE_HTTP_DEBUG=1
VITE_DISABLE_AUTH_GUARD=1
VITE_RELAX_ALL=1

# Platform
VITE_BASE_H5=/jl-app/
```

---

## When Modifying This Codebase

### ✅ DO:

1. **Follow TypeScript strictly** - Define types for all new code
2. **Use existing patterns** - Check similar implementations first
3. **Test on target platforms** - H5, WeChat, App if applicable
4. **Use constants** - For routes, endpoints, status codes
5. **Add proper error handling** - Try-catch, user feedback
6. **Write meaningful commits** - Use `pnpm cm` for consistency
7. **Check type errors** - Run `pnpm run type-check` before committing
8. **Use composition API** - `<script setup>` for all components
9. **Leverage auto-imports** - Vue/uni-app APIs are auto-imported
10. **Follow naming conventions** - See Coding Conventions section

### ❌ DON'T:

1. **Don't hardcode values** - Use configuration and constants
2. **Don't skip type definitions** - TypeScript is mandatory
3. **Don't use Vue 2 patterns** - No mixins, use composables
4. **Don't bypass authentication** - Except in dev with debug flags
5. **Don't commit debug flags** - Remove before production
6. **Don't use global state** - Use Pinia stores
7. **Don't ignore ESLint errors** - Fix them properly
8. **Don't create duplicate utilities** - Check existing utils first
9. **Don't skip testing** - Test on all target platforms
10. **Don't commit directly** - Use `pnpm cm` for commits

---

## Getting Help

### Documentation References

- **uni-app**: https://uniapp.dcloud.net.cn/
- **Vue 3**: https://vuejs.org/
- **Pinia**: https://pinia.vuejs.org/
- **TypeScript**: https://www.typescriptlang.org/
- **Vite**: https://vitejs.dev/
- **sard-uniapp**: https://sard.wzt.zone/sard-uniapp-docs/

### Project-Specific Docs

- **README.md** - Project overview and setup
- **CLAUDE.md** - This file
- Referenced but not yet created:
  - `docs/contribution-guidelines.md` - Development guidelines
  - `docs/components/CForm.md` - Dynamic form guide
  - `docs/issues-log.md` - Known issues and solutions

---

## Changelog

### 2025-11-21 - Initial Creation
- Created comprehensive AI assistant guide
- Documented all major patterns and conventions
- Added task examples and quick reference
- Included debugging and testing guidelines

---

**Last Updated**: 2025-11-21
**Maintained By**: Project Team
**For**: AI Assistants working with this codebase
