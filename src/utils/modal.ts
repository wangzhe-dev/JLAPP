// 统一封装 uni.showModal，支持 Promise & 防重复弹出
let modalLocks = new Map<string, boolean>();

export interface ModalOptions extends UniApp.ShowModalOptions {
	lockKey?: string;
	lock?: boolean;
}

function resolveLockKey(options: ModalOptions) {
	return (
		options.lockKey ||
		`${options.title || ""}::${options.content || ""}::${
			options.confirmText || ""
		}::${options.cancelText || ""}`
	);
}

export function showModalAsync(options: ModalOptions): Promise<UniApp.ShowModalRes> {
	const { lock = true, ...rest } = options;
	const lockKey = resolveLockKey(options);
	if (lock && modalLocks.get(lockKey)) {
		return Promise.resolve({
			confirm: false,
			cancel: true,
			errMsg: "showModal:cancel",
		} as UniApp.ShowModalRes);
	}
	if (lock) modalLocks.set(lockKey, true);
	return new Promise((resolve, reject) => {
		const originalComplete = rest.complete;
		uni.showModal({
			...rest,
			success(res) {
				options.success?.(res);
				resolve(res);
			},
			fail(err) {
				options.fail?.(err);
				reject(err);
			},
			complete(res) {
				originalComplete?.(res);
				if (lock) modalLocks.delete(lockKey);
			},
		});
	});
}

export async function confirmModal(
	options: ModalOptions | string,
): Promise<boolean> {
	const payload =
		typeof options === "string"
			? { content: options }
			: { ...options };
	try {
		const res = await showModalAsync({
			showCancel: true,
			confirmText: "确定",
			cancelText: "取消",
			title: "提示",
			...payload,
		});
		return !!res.confirm;
	} catch {
		return false;
	}
}

export async function alertModal(options: ModalOptions | string) {
	const payload =
		typeof options === "string"
			? { content: options }
			: { ...options };
	try {
		await showModalAsync({
			showCancel: false,
			title: "提示",
			...payload,
		});
	} catch {
		/* ignore */
	}
}
