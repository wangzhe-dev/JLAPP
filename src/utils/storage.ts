// 简单 storage 封装，支持 raw 与 json 两种模式
export type StorageMode = "raw" | "json";

export const storage = {
	set<T = any>(key: string, value: T, mode: StorageMode = "json") {
		try {
			const v = mode === "raw" ? String(value) : JSON.stringify(value);
			uni.setStorageSync(key, v);
		} catch {}
	},
	get<T = any>(key: string, mode: StorageMode = "json"): T | null {
		try {
			const v = uni.getStorageSync(key);
			if (v === "" || v === undefined || v === null) return null;
			return mode === "raw" ? (v as T) : JSON.parse(v);
		} catch {
			return null;
		}
	},
	remove(key: string) {
		try {
			uni.removeStorageSync(key);
		} catch {}
	},
};
