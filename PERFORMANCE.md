# 性能优化指南

本文档介绍项目中已实施的性能优化策略和最佳实践。

## 目录
- [请求优化](#请求优化)
- [图片优化](#图片优化)
- [代码分割](#代码分割)
- [样式优化](#样式优化)
- [渲染优化](#渲染优化)
- [最佳实践](#最佳实践)

---

## 请求优化

### 1. 请求缓存

使用 `src/utils/cache.ts` 提供的缓存工具减少重复请求：

```typescript
import { cached, getCache, setCache } from '@/utils/cache';

// 方式1：使用缓存装饰器
const fetchUserInfo = cached(
  async (userId: string) => {
    const res = await http.get(`/user/${userId}`);
    return res.data;
  },
  {
    ttl: 5 * 60 * 1000, // 5分钟缓存
    persist: true, // 持久化到 storage
    keyGenerator: (userId) => `user_${userId}`,
  }
);

// 方式2：手动缓存
async function getConfig() {
  const cached = getCache('app_config');
  if (cached) return cached;

  const config = await http.get('/config');
  setCache('app_config', config, { ttl: 10 * 60 * 1000 });
  return config;
}
```

### 2. 请求去重

防止相同请求并发执行：

```typescript
import { dedupe } from '@/utils/cache';

const fetchData = dedupe(
  async (id: string) => {
    return await http.get(`/data/${id}`);
  },
  (id) => `data_${id}`
);

// 同时调用多次，只会发起一个请求
Promise.all([
  fetchData('123'),
  fetchData('123'),
  fetchData('123'),
]);
```

### 3. 防重复提交

项目已内置防重复提交机制（`src/utils/request.ts`）：
- 写操作（POST/PUT/DELETE）自动检测重复
- 1秒内相同请求会被拦截
- 特殊场景可使用 `skipRepeatCheck: true` 跳过检测

---

## 图片优化

### 1. 图片压缩

使用 `src/utils/image.ts` 提供的压缩工具：

```typescript
import { compressImage, chooseImage } from '@/utils/image';

// 选择图片时自动压缩
const images = await chooseImage({
  count: 9,
  compress: true,
  compressOptions: {
    quality: 0.8,
    maxWidth: 1080,
  },
});

// 手动压缩
const compressed = await compressImage(filePath, {
  quality: 0.7,
  maxWidth: 800,
});
```

### 2. 图片懒加载

H5 环境支持懒加载指令：

```vue
<template>
  <!-- 使用懒加载指令 -->
  <image v-lazy="imageUrl" class="lazy-image" />
</template>

<script setup>
import { lazyLoadDirective } from '@/utils/image';

// 注册指令
const vLazy = lazyLoadDirective;
</script>

<style>
.lazy-image {
  transition: opacity 0.3s;
  opacity: 0;
}
.lazy-image.loaded {
  opacity: 1;
}
</style>
```

### 3. 图片预加载

提前加载关键图片资源：

```typescript
import { preloadImages } from '@/utils/image';

// 应用启动时预加载
onLaunch(() => {
  preloadImages([
    '/static/logo.png',
    '/static/banner.jpg',
  ]);
});
```

### 4. CDN 参数优化

自动添加 CDN 裁剪参数：

```typescript
import { addImageParams } from '@/utils/image';

const url = addImageParams('https://cdn.example.com/image.jpg', {
  width: 375,
  quality: 80,
  format: 'webp',
});
// 输出: https://cdn.example.com/image.jpg?imageView2/1/w_375/q_80/f_webp
```

---

## 代码分割

### 1. Vite 分包策略

项目已配置智能分包（`vite.config.ts`）：

- **vendor**: 第三方库（node_modules）
- **vendor-sard**: Sard UI 组件库
- **api**: API 接口代码
- **utils**: 工具函数

### 2. 路由懒加载

使用动态 import 实现路由级代码分割：

```javascript
// pages.json 配置
{
  "pages": [
    {
      "path": "pages/heavy/index",
      "style": {
        "navigationBarTitleText": "重量级页面",
        "enablePullDownRefresh": false
      }
    }
  ]
}

// 页面会自动按需加载
```

### 3. 组件懒加载

对于大型组件，使用异步加载：

```vue
<script setup>
import { defineAsyncComponent } from 'vue';

// 懒加载大型组件
const HeavyChart = defineAsyncComponent(() =>
  import('@/components/HeavyChart.vue')
);
</script>
```

---

## 样式优化

### 1. GPU 加速

使用 `platform.scss` 提供的工具类：

```vue
<template>
  <view class="gpu-accelerated">
    <!-- 开启 GPU 加速的内容 -->
  </view>
</template>
```

### 2. 避免样式重绘

```scss
// ❌ 避免
.item {
  width: 100%;
  height: auto; // 触发重绘
}

// ✅ 推荐
.item {
  width: 100%;
  height: 100rpx; // 固定高度
}
```

### 3. 使用 CSS 变量

减少样式重复，提升可维护性：

```scss
// uni.scss
$main-color: #0b3d91;

// 组件中使用
.button {
  background: $main-color;
}
```

---

## 渲染优化

### 1. 列表虚拟滚动

对于长列表，使用虚拟滚动：

```vue
<template>
  <scroll-view
    scroll-y
    class="list-container"
    :scroll-into-view="scrollIntoView"
    @scrolltolower="onReachBottom"
  >
    <view
      v-for="item in visibleItems"
      :key="item.id"
      class="list-item"
    >
      {{ item.name }}
    </view>
  </scroll-view>
</template>

<script setup>
import { ref, computed } from 'vue';

const items = ref(Array(1000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` })));
const scrollTop = ref(0);
const itemHeight = 100; // rpx
const viewportHeight = 1000; // rpx

// 只渲染可见区域的项
const visibleItems = computed(() => {
  const start = Math.floor(scrollTop.value / itemHeight);
  const end = start + Math.ceil(viewportHeight / itemHeight) + 1;
  return items.value.slice(start, end);
});
</script>
```

### 2. 防抖和节流

避免高频操作：

```typescript
import { debounce, throttle } from '@/utils/common';

// 防抖：搜索输入
const handleSearch = debounce((keyword: string) => {
  // 搜索逻辑
}, 300);

// 节流：滚动加载
const handleScroll = throttle(() => {
  // 滚动处理
}, 200);
```

### 3. 使用 v-show 替代 v-if

频繁切换显示的元素使用 `v-show`：

```vue
<template>
  <!-- ❌ 避免（频繁切换时） -->
  <view v-if="visible">内容</view>

  <!-- ✅ 推荐 -->
  <view v-show="visible">内容</view>
</template>
```

---

## 最佳实践

### 1. 分包加载

小程序建议使用分包：

```json
// pages.json
{
  "subPackages": [
    {
      "root": "pages/secondary",
      "pages": [
        {
          "path": "detail/index"
        }
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["pages/secondary"]
    }
  }
}
```

### 2. 数据预取

提前加载下一页数据：

```typescript
const currentPage = ref(1);
const nextPageData = ref(null);

// 当前页加载完成后，预加载下一页
watchEffect(() => {
  if (currentPage.value > 0) {
    fetchData(currentPage.value + 1).then((data) => {
      nextPageData.value = data;
    });
  }
});
```

### 3. 图片资源优化

- 使用 WebP 格式（体积减少 30%）
- 雪碧图合并小图标
- 压缩图片质量到 80%
- 使用 CDN 加速

### 4. 减少包体积

```bash
# 分析包体积
npm run build:h5

# 查看构建产物
ls -lh dist/build/h5/js

# 优化建议：
# 1. 按需引入组件库
# 2. 移除未使用的依赖
# 3. 使用 Tree Shaking
# 4. 压缩图片和字体
```

### 5. 性能监控

添加性能监控点：

```typescript
// 页面加载时间
onLoad(() => {
  const startTime = Date.now();

  // 页面渲染完成
  onReady(() => {
    const loadTime = Date.now() - startTime;
    console.log(`[Performance] 页面加载耗时: ${loadTime}ms`);
  });
});

// API 请求时间
async function fetchData() {
  const start = Date.now();
  const data = await http.get('/data');
  console.log(`[Performance] API 耗时: ${Date.now() - start}ms`);
  return data;
}
```

---

## 性能检查清单

### 开发阶段
- [ ] 使用请求缓存减少重复调用
- [ ] 图片统一压缩到 80% 质量
- [ ] 大型组件使用懒加载
- [ ] 长列表实现虚拟滚动
- [ ] 避免在 render 中进行复杂计算

### 构建阶段
- [ ] 开启生产环境构建
- [ ] 检查包体积是否超限
- [ ] 验证代码分割效果
- [ ] 压缩图片和静态资源
- [ ] 移除 console.log

### 发布阶段
- [ ] H5: 配置 CDN 加速
- [ ] 小程序: 启用分包加载
- [ ] APP: 优化启动页
- [ ] 测试弱网环境表现
- [ ] 监控首屏加载时间

---

## 性能指标

### 目标值

| 平台 | 首屏时间 | 包体积 | FPS |
|------|----------|--------|-----|
| H5 | < 2s | < 2MB | ≥ 60 |
| 微信小程序 | < 1.5s | < 2MB | ≥ 60 |
| APP | < 1s | < 10MB | ≥ 60 |

### 监控工具

- **H5**: Chrome DevTools Performance
- **微信小程序**: 微信开发者工具性能面板
- **APP**: HBuilderX 真机运行调试

---

## 常见问题

### Q: 为什么图片加载很慢？
**A**: 检查以下几点：
1. 图片是否压缩过？
2. 是否使用了 CDN？
3. 图片大小是否超过 500KB？
4. 是否启用了懒加载？

### Q: 小程序包体积超限怎么办？
**A**: 解决方案：
1. 启用分包加载
2. 图片上传到服务器，不要放在包内
3. 清理未使用的文件和依赖
4. 压缩代码和资源

### Q: 页面滚动卡顿？
**A**: 优化建议：
1. 使用 `transform` 代替 `top/left`
2. 开启 GPU 加速
3. 减少 DOM 层级
4. 长列表使用虚拟滚动

---

## 技术支持

如有性能优化相关问题，请查看：
- [uni-app 性能优化指南](https://uniapp.dcloud.net.cn/tutorial/performance.html)
- [Vue 3 性能优化](https://vuejs.org/guide/best-practices/performance.html)
- [项目 Issues](https://github.com/your-repo/issues)
