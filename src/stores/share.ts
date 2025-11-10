import { defineStore } from 'pinia'
import { mpShareFriend as mpShareFriendConfig, mpShareTimeline as mpShareTimelineConfig } from '@/config'

export const useShareStore = defineStore('share', () => {
	// 分享给朋友
	const mpShareFriend = ref<Page.CustomShareContent>(mpShareFriendConfig)
	// 分享到朋友圈
	const mpShareTimeline = ref<Page.ShareTimelineContent>(mpShareTimelineConfig)

	const setMpShareFriend = (val : Page.CustomShareContent, isDelay : number = 0) => {
		setTimeout(() => {
			mpShareFriend.value = val
		}, isDelay)
	}

	const setMpShareTimeline = (val : Page.ShareTimelineContent, isDelay : number = 0) => {
		setTimeout(() => {
			mpShareTimeline.value = val
		}, isDelay)
	}

	return { mpShareFriend, mpShareTimeline, setMpShareFriend, setMpShareTimeline }
})