# 📦 多端打包部署指南

## 目录
- [支持平台](#支持平台)
- [开发环境](#开发环境)
- [打包命令](#打包命令)
- [平台配置](#平台配置)
- [常见问题](#常见问题)

---

## 支持平台

本项目基于 uni-app 框架，支持以下平台：

- ✅ H5 (Web)
- ✅ 微信小程序
- ✅ 支付宝小程序
- ✅ 百度小程序
- ✅ Android APP
- ✅ iOS APP

---

## 开发环境

### 必需工具

1. **Node.js** (>= 16.0.0)
   ```bash
   node -v  # 检查版本
   ```

2. **HBuilderX** (推荐) 或 **CLI 工具**
   - [下载 HBuilderX](https://www.dcloud.io/hbuilderx.html)

3. **各平台开发工具**
   - 微信小程序：[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
   - 支付宝小程序：[支付宝开发者工具](https://opendocs.alipay.com/mini/ide/download)
   - 百度小程序：[百度开发者工具](https://smartprogram.baidu.com/docs/develop/devtools/show_sur/)
   - Android：Android Studio
   - iOS：Xcode (仅 macOS)

---

## 打包命令

### 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev:h5          # H5 开发
npm run dev:mp-weixin   # 微信小程序开发
npm run dev:mp-alipay   # 支付宝小程序开发
```

### 生产打包

```bash
# 方式1：使用 npm 命令
npm run build:h5          # 打包 H5
npm run build:mp-weixin   # 打包微信小程序
npm run build:mp-alipay   # 打包支付宝小程序
npm run build:mp-baidu    # 打包百度小程序

# 方式2：使用打包脚本（推荐）
chmod +x scripts/build.sh   # 首次使用需要添加执行权限

./scripts/build.sh h5        # 打包 H5
./scripts/build.sh weixin    # 打包微信小程序
./scripts/build.sh alipay    # 打包支付宝小程序
./scripts/build.sh all       # 打包所有平台
./scripts/build.sh clean     # 清理构建目录
```

---

## 平台配置

### 1. H5 配置

**文件位置**：`src/manifest.json` → `h5`

```json
{
  "h5": {
    "title": "招商金陵",
    "template": "index.html",
    "router": {
      "mode": "history"
    }
  }
}
```

**部署**：
- 构建产物：`dist/build/h5`
- 部署到 Nginx、Apache 等 Web 服务器

**Nginx 配置示例**：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist/build/h5;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 2. 微信小程序

**配置文件**：`src/manifest.json` → `mp-weixin`

```json
{
  "mp-weixin": {
    "appid": "你的微信小程序AppID",
    "setting": {
      "urlCheck": false,
      "postcss": true,
      "minified": true
    }
  }
}
```

**发布流程**：
1. 使用微信开发者工具打开 `dist/build/mp-weixin`
2. 点击"上传"，填写版本号和备注
3. 登录[微信公众平台](https://mp.weixin.qq.com/) 提交审核
4. 审核通过后发布

**注意事项**：
- 需要配置服务器域名白名单
- 需要配置业务域名
- 图片资源建议使用 HTTPS

### 3. 支付宝小程序

**配置文件**：`src/manifest.json` → `mp-alipay`

```json
{
  "mp-alipay": {
    "appid": "你的支付宝小程序AppID",
    "styleIsolation": "shared"
  }
}
```

**发布流程**：
1. 使用支付宝开发者工具打开 `dist/build/mp-alipay`
2. 点击"上传"
3. 登录[开放平台](https://open.alipay.com/) 提交审核

### 4. Android APP

**配置文件**：`src/manifest.json` → `app-plus` → `android`

**打包方式**：

#### 方式1：云打包（推荐新手）
1. 使用 HBuilderX
2. 发行 → 原生App-云打包
3. 填写应用信息和证书
4. 下载 apk 文件

#### 方式2：离线打包
1. 下载[离线打包SDK](https://nativesupport.dcloud.net.cn/AppDocs/download/android)
2. 使用 Android Studio 打包
3. 生成签名 apk

**权限配置**：
- 相机权限
- 位置权限
- 存储权限
- 网络权限

### 5. iOS APP

**配置文件**：`src/manifest.json` → `app-plus` → `ios`

**打包方式**：

#### 方式1：云打包
1. 使用 HBuilderX
2. 发行 → 原生App-云打包
3. 需要 Apple 开发者账号
4. 配置证书和描述文件

#### 方式2：离线打包
1. 下载[离线打包SDK](https://nativesupport.dcloud.net.cn/AppDocs/download/ios)
2. 使用 Xcode 打包
3. 上传到 App Store Connect

**注意事项**：
- 需要 macOS 系统
- 需要 Apple 开发者账号（$99/年）
- 需要配置隐私权限说明

---

## 环境变量配置

### 开发环境 (.env.development)
```bash
VITE_API_TARGET=http://10.147.128.85:80
VITE_API_PREFIX=prod-api
VITE_BASE_H5=/jl-app/
VITE_MINIO_BASE=http://10.147.128.87:9000
```

### 生产环境 (.env.production)
```bash
VITE_API_TARGET=https://your-production-api.com
VITE_API_PREFIX=prod-api
VITE_BASE_H5=/jl-app/
VITE_MINIO_BASE=https://your-minio.com
```

---

## 样式适配

项目已配置跨平台样式适配，支持：

### 安全区域适配
```vue
<template>
  <!-- 顶部安全区域 -->
  <view class="safe-area-top">内容</view>

  <!-- 底部安全区域 (iPhone X 等) -->
  <view class="safe-area-bottom">内容</view>
</template>
```

### 平台条件编译
```vue
<template>
  <!-- H5 平台显示 -->
  <!-- #ifdef H5 -->
  <view>H5 特有内容</view>
  <!-- #endif -->

  <!-- 微信小程序显示 -->
  <!-- #ifdef MP-WEIXIN -->
  <view>微信小程序特有内容</view>
  <!-- #endif -->

  <!-- APP 显示 -->
  <!-- #ifdef APP-PLUS -->
  <view>APP 特有内容</view>
  <!-- #endif -->
</template>

<script>
// TypeScript 条件编译
// #ifdef H5
import { someH5Function } from './h5'
// #endif

// #ifdef MP-WEIXIN
import { someWeixinFunction } from './weixin'
// #endif
</script>
```

### 使用平台工具类
```typescript
import { isH5, isWeixin, isApp, getSystemInfo } from '@/utils/platform'

// 判断平台
if (isH5()) {
  console.log('H5 平台')
}

// 获取系统信息
const info = getSystemInfo()
console.log('状态栏高度:', info.statusBarHeight)
console.log('底部安全距离:', info.safeArea.bottom)
```

---

## 性能优化

### 1. 分包加载

**pages.json 配置**：
```json
{
  "subPackages": [
    {
      "root": "pages/subPackage",
      "pages": [
        {
          "path": "page1/index"
        }
      ]
    }
  ]
}
```

### 2. 图片优化

- 使用 WebP 格式
- 压缩图片大小
- 使用 CDN 加速
- 懒加载

### 3. 代码优化

- Tree Shaking
- 按需引入组件
- 减少包体积

---

## 常见问题

### 1. H5 跨域问题

**解决方案**：
- 配置 Nginx 反向代理
- 后端添加 CORS 头
- 使用 vite.config.ts 代理

### 2. 小程序白屏

**可能原因**：
- AppID 未配置
- 域名未配置白名单
- 代码体积超限

### 3. APP 打包失败

**可能原因**：
- 证书配置错误
- 包名冲突
- 权限配置错误

### 4. 样式不一致

**解决方案**：
- 使用 rpx 单位
- 引入 platform.scss
- 使用条件编译

### 5. API 调用失败

**检查项**：
- 网络配置
- 域名白名单
- 证书配置
- 接口地址

---

## 发布checklist

### H5
- [ ] 构建生产版本
- [ ] 测试所有功能
- [ ] 配置 CDN
- [ ] 配置 Nginx
- [ ] 测试各浏览器兼容性

### 小程序
- [ ] 配置 AppID
- [ ] 配置域名白名单
- [ ] 测试所有功能
- [ ] 检查包体积
- [ ] 提交审核

### APP
- [ ] 配置证书
- [ ] 配置权限
- [ ] 测试所有功能
- [ ] 性能测试
- [ ] 提交应用商店

---

## 技术支持

如有问题，请联系技术团队或查看：
- [uni-app 官方文档](https://uniapp.dcloud.net.cn/)
- [项目 Issues](https://github.com/your-repo/issues)
