/**
 * 二维码扫描和生成工具
 * 用于设备管理、备件管理等场景
 */

export interface QRCodeData {
	type: 'equipment' | 'spare_part' | 'workorder' | 'location';
	id: string;
	name?: string;
	code?: string;
	extra?: Record<string, any>;
}

/**
 * 扫描二维码
 */
export function scanQRCode(): Promise<QRCodeData> {
	return new Promise((resolve, reject) => {
		// #ifdef APP-PLUS || MP-WEIXIN
		uni.scanCode({
			scanType: ['qrCode', 'barCode'],
			success: (res) => {
				try {
					const data = parseQRCodeResult(res.result);
					resolve(data);
				} catch (error) {
					reject(new Error('二维码格式错误'));
				}
			},
			fail: (err) => {
				if (err.errMsg?.includes('cancel')) {
					reject(new Error('用户取消扫描'));
				} else {
					reject(new Error('扫描失败'));
				}
			},
		});
		// #endif

		// #ifdef H5
		// H5 环境提示使用 APP 或小程序
		uni.showModal({
			title: '提示',
			content: '请在 APP 或小程序中使用扫码功能',
			showCancel: false,
			success: () => {
				reject(new Error('H5 不支持扫码'));
			},
		});
		// #endif
	});
}

/**
 * 解析二维码结果
 */
function parseQRCodeResult(result: string): QRCodeData {
	// 尝试解析 JSON 格式
	if (result.startsWith('{') || result.startsWith('[')) {
		try {
			return JSON.parse(result);
		} catch {
			// 继续尝试其他格式
		}
	}

	// 解析自定义格式：TYPE:ID:NAME
	// 例如：EQUIPMENT:EQ001:设备A
	const parts = result.split(':');
	if (parts.length >= 2) {
		const typeMap: Record<string, QRCodeData['type']> = {
			EQUIPMENT: 'equipment',
			EQ: 'equipment',
			SPARE: 'spare_part',
			PART: 'spare_part',
			WO: 'workorder',
			LOC: 'location',
		};

		const type = typeMap[parts[0].toUpperCase()];
		if (type) {
			return {
				type,
				id: parts[1],
				name: parts[2],
				code: parts[1],
			};
		}
	}

	// 如果无法解析，返回原始字符串作为 ID
	return {
		type: 'equipment',
		id: result,
		code: result,
	};
}

/**
 * 生成二维码数据字符串
 */
export function generateQRCodeData(data: QRCodeData): string {
	// 优先使用 JSON 格式（更灵活）
	if (data.extra && Object.keys(data.extra).length > 0) {
		return JSON.stringify(data);
	}

	// 简单格式：TYPE:ID:NAME
	const typeMap: Record<QRCodeData['type'], string> = {
		equipment: 'EQ',
		spare_part: 'SPARE',
		workorder: 'WO',
		location: 'LOC',
	};

	const parts = [typeMap[data.type], data.id];
	if (data.name) parts.push(data.name);

	return parts.join(':');
}

/**
 * 扫描设备二维码
 */
export async function scanEquipmentQRCode(): Promise<{
	id: string;
	name?: string;
	code?: string;
}> {
	const data = await scanQRCode();
	if (data.type !== 'equipment') {
		throw new Error('请扫描设备二维码');
	}
	return {
		id: data.id,
		name: data.name,
		code: data.code,
	};
}

/**
 * 扫描备件二维码
 */
export async function scanSparePartQRCode(): Promise<{
	id: string;
	name?: string;
	code?: string;
}> {
	const data = await scanQRCode();
	if (data.type !== 'spare_part') {
		throw new Error('请扫描备件二维码');
	}
	return {
		id: data.id,
		name: data.name,
		code: data.code,
	};
}

/**
 * 扫描工单二维码
 */
export async function scanWorkOrderQRCode(): Promise<{
	id: string;
	code?: string;
}> {
	const data = await scanQRCode();
	if (data.type !== 'workorder') {
		throw new Error('请扫描工单二维码');
	}
	return {
		id: data.id,
		code: data.code,
	};
}

/**
 * 保存二维码到相册
 */
export function saveQRCodeToAlbum(tempFilePath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		uni.saveImageToPhotosAlbum({
			filePath: tempFilePath,
			success: () => {
				uni.showToast({
					title: '二维码已保存',
					icon: 'success',
				});
				resolve();
			},
			fail: (err) => {
				// 可能是权限问题
				if (err.errMsg?.includes('auth')) {
					uni.showModal({
						title: '提示',
						content: '需要您授权保存图片到相册',
						success: (res) => {
							if (res.confirm) {
								uni.openSetting();
							}
						},
					});
				}
				reject(err);
			},
		});
	});
}

/**
 * 从相册选择二维码图片并识别
 */
export function chooseAndRecognizeQRCode(): Promise<QRCodeData> {
	return new Promise((resolve, reject) => {
		uni.chooseImage({
			count: 1,
			sourceType: ['album'],
			success: (res) => {
				const tempFilePath = res.tempFilePaths[0];

				// #ifdef MP-WEIXIN
				// 微信小程序使用 wx.scanCode 的 onlyFromCamera: false
				uni.scanCode({
					onlyFromCamera: false,
					scanType: ['qrCode', 'barCode'],
					success: (scanRes) => {
						try {
							const data = parseQRCodeResult(scanRes.result);
							resolve(data);
						} catch (error) {
							reject(new Error('二维码格式错误'));
						}
					},
					fail: reject,
				});
				// #endif

				// #ifndef MP-WEIXIN
				reject(new Error('当前平台不支持从相册识别二维码'));
				// #endif
			},
			fail: reject,
		});
	});
}

/**
 * 批量扫描二维码
 */
export async function scanMultipleQRCodes(
	maxCount: number = 10
): Promise<QRCodeData[]> {
	const results: QRCodeData[] = [];

	for (let i = 0; i < maxCount; i++) {
		try {
			const data = await scanQRCode();
			results.push(data);

			// 询问是否继续扫描
			if (i < maxCount - 1) {
				const { confirm } = await new Promise<{ confirm: boolean }>((resolve) => {
					uni.showModal({
						title: '继续扫描',
						content: `已扫描 ${i + 1} 个，是否继续？`,
						confirmText: '继续',
						cancelText: '完成',
						success: resolve,
					});
				});

				if (!confirm) break;
			}
		} catch (error) {
			// 用户取消或扫描失败
			break;
		}
	}

	return results;
}

/**
 * 设备二维码快速查询
 */
export async function quickSearchEquipment(
	searchFn: (code: string) => Promise<any>
): Promise<any> {
	try {
		const { code } = await scanEquipmentQRCode();
		if (!code) {
			throw new Error('设备编号为空');
		}

		uni.showLoading({ title: '查询中...' });
		const result = await searchFn(code);
		uni.hideLoading();

		return result;
	} catch (error) {
		uni.hideLoading();
		throw error;
	}
}
