import { defineStore } from 'pinia'

export const useSysInfoStore = defineStore('sysInfo', () => {
	// 系统信息
	const systemInfo = ref({} as UniApp.GetSystemInfoResult)

	const setSystemInfo = () => {
		systemInfo.value = uni.getSystemInfoSync()
	}

	return { systemInfo, setSystemInfo }
})