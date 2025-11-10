import { defineStore } from 'pinia'

interface MessageState {
  unreadCount: number
  lastFetch: number | null
}

export const useMessageStore = defineStore('message', {
  state: (): MessageState => ({
    unreadCount: 0,
    lastFetch: null
  }),
  actions: {
    setUnread(count: number) {
      this.unreadCount = count
    },
    increment(delta = 1) {
      this.unreadCount += delta
    },
    clear() {
      this.unreadCount = 0
    },
    mockFetch() {
      // 模拟后端请求
      const random = Math.floor(Math.random() * 128)
      this.unreadCount = random
      this.lastFetch = Date.now()
    }
  }
})
