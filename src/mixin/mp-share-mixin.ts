// #ifdef MP-WEIXIN
import { useShareStore } from '@/stores'
import { mpShareFriend, mpShareTimeline } from '@/config'

export default {
	onLoad() {
		// 进入页面时设置统一默认值
		useShareStore().setMpShareFriend(mpShareFriend)
		useShareStore().setMpShareTimeline(mpShareTimeline)
	},

	onUnload() {
		// 关闭页面时重置
		useShareStore().setMpShareFriend(mpShareFriend)
		useShareStore().setMpShareTimeline(mpShareTimeline)
	},

	// 分享给朋友
	onShareAppMessage() {
		return useShareStore().mpShareFriend
	},

	// 分享到朋友圈
	onShareTimeline() {
		return useShareStore().mpShareTimeline
	}
}
// #endif