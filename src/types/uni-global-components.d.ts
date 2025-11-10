// 解决模板中 <view> <text> 以及第三方 UI 组件在严格类型下被误判为需要组件构造器的问题
// 这里将常用的 uni 原生标签与项目用到的第三方组件声明到 GlobalComponents
// 如果后续还有其它标签（如 <image>、<scroll-view> 等）按需补充即可
import type { DefineComponent } from 'vue'

declare module 'vue' {
  export interface GlobalComponents {
    view: DefineComponent<any, any, any>
    text: DefineComponent<any, any, any>
    image: DefineComponent<any, any, any>
    button: DefineComponent<any, any, any>
    'scroll-view': DefineComponent<any, any, any>
    'swiper': DefineComponent<any, any, any>
    'swiper-item': DefineComponent<any, any, any>
    'navigator': DefineComponent<any, any, any>
    'icon': DefineComponent<any, any, any>
    'picker': DefineComponent<any, any, any>
    'picker-view': DefineComponent<any, any, any>
    'picker-view-column': DefineComponent<any, any, any>
    'form': DefineComponent<any, any, any>
    'input': DefineComponent<any, any, any>
    'textarea': DefineComponent<any, any, any>
    'label': DefineComponent<any, any, any>
    'checkbox': DefineComponent<any, any, any>
    'checkbox-group': DefineComponent<any, any, any>
    'radio': DefineComponent<any, any, any>
    'radio-group': DefineComponent<any, any, any>
    'switch': DefineComponent<any, any, any>
    'slider': DefineComponent<any, any, any>
    'progress': DefineComponent<any, any, any>
    'view-container': DefineComponent<any, any, any>
    'rich-text': DefineComponent<any, any, any>
    'web-view': DefineComponent<any, any, any>
    'video': DefineComponent<any, any, any>
    'audio': DefineComponent<any, any, any>
    'camera': DefineComponent<any, any, any>
    'live-player': DefineComponent<any, any, any>
    'live-pusher': DefineComponent<any, any, any>
    'map': DefineComponent<any, any, any>
    'canvas': DefineComponent<any, any, any>
    'cover-image': DefineComponent<any, any, any>
    'cover-view': DefineComponent<any, any, any>
    'movable-area': DefineComponent<any, any, any>
    'movable-view': DefineComponent<any, any, any>
    'scroll-view-refresher': DefineComponent<any, any, any>
    'navigation-bar': DefineComponent<any, any, any>
    'tabbar': DefineComponent<any, any, any>
    'uni-page': DefineComponent<any, any, any>
    'sar-avatar': DefineComponent<any, any, any>
    'sar-space': DefineComponent<any, any, any>
    'sar-button': DefineComponent<any, any, any>
    'sar-divider': DefineComponent<any, any, any>
    'c-button': DefineComponent<any, any, any>
    'sar-card': DefineComponent<any, any, any>
    'sar-action-sheet': DefineComponent<any, any, any>
    'c-card': DefineComponent<any, any, any> // 新增：全局 CCard (包装 sard-card)
    'sar-icon': DefineComponent<any, any, any>
    'AppTabbar': DefineComponent<any, any, any> // 自定义全局底部导航组件
    'app-tabbar': DefineComponent<any, any, any> // 兼容可能的 kebab-case 写法
  }
}

export {}
