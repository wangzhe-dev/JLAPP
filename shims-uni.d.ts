// / <reference types='@dcloudio/types' />
import 'vue'

declare module '@vue/runtime-core' {
	type Hooks = App.AppInstance & Page.PageInstance

	interface ComponentCustomOptions extends Hooks {

	}

	interface ComponentCustomProps {
		onTouchstart?: any
		onTouchmove?: any
		onTouchend?: any
		onTouchcancel?: any
	}
}
