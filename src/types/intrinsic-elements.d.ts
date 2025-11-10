// 为多端原生标签提供 JSX.IntrinsicElements 宽松声明，避免被当作组件构造器校验
// 若后续引入精确类型，可删除本文件或改写具体属性类型
export {}

declare module 'vue' {
  namespace JSX {
    interface IntrinsicElements {
      view: any
      text: any
      image: any
      button: any
      'scroll-view': any
      swiper: any
      'swiper-item': any
      navigator: any
      icon: any
      picker: any
      'picker-view': any
      'picker-view-column': any
      form: any
      input: any
      textarea: any
      label: any
      checkbox: any
      'checkbox-group': any
      radio: any
      'radio-group': any
      switch: any
      slider: any
      progress: any
      'rich-text': any
      'web-view': any
      video: any
      audio: any
      camera: any
      'live-player': any
      'live-pusher': any
      map: any
      canvas: any
      'cover-image': any
      'cover-view': any
      'movable-area': any
      'movable-view': any
    }
  }
}
