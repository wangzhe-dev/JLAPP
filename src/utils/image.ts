/**
 * 图片优化工具
 * 包含懒加载、压缩、格式转换等功能
 */

import { isH5 } from './platform';

export interface ImageOptimizeOptions {
	/** 图片质量 (0-1)，默认 0.8 */
	quality?: number;
	/** 最大宽度 */
	maxWidth?: number;
	/** 最大高度 */
	maxHeight?: number;
	/** 输出格式 */
	format?: 'jpg' | 'png' | 'webp';
}

/**
 * 压缩图片
 */
export function compressImage(
	tempFilePath: string,
	options: ImageOptimizeOptions = {}
): Promise<string> {
	const { quality = 0.8, maxWidth, maxHeight } = options;

	return new Promise((resolve, reject) => {
		uni.compressImage({
			src: tempFilePath,
			quality: quality * 100,
			compressedWidth: maxWidth,
			compressedHeight: maxHeight,
			success: (res) => {
				resolve(res.tempFilePath);
			},
			fail: (err) => {
				console.warn('[Image] 压缩失败，返回原图', err);
				resolve(tempFilePath);
			},
		});
	});
}

/**
 * 图片懒加载指令配置
 * 使用方式：v-lazy="imageUrl"
 */
export const lazyLoadDirective = {
	mounted(el: any, binding: any) {
		const observerOptions = {
			threshold: 0.01,
			rootMargin: '50px',
		};

		const loadImage = () => {
			const img = el;
			const src = binding.value;

			if (!src) return;

			// 设置占位图
			if (!img.src || img.src === '') {
				img.src = '/static/placeholder.png';
			}

			// 加载真实图片
			const tempImg = new Image();
			tempImg.onload = () => {
				img.src = src;
				img.classList.add('loaded');
			};
			tempImg.onerror = () => {
				img.src = '/static/error.png';
				img.classList.add('error');
			};
			tempImg.src = src;
		};

		// H5 环境使用 IntersectionObserver
		if (isH5() && typeof IntersectionObserver !== 'undefined') {
			const observer = new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						loadImage();
						observer.unobserve(el);
					}
				});
			}, observerOptions);

			observer.observe(el);
		} else {
			// 非 H5 环境直接加载
			loadImage();
		}
	},
};

/**
 * 获取图片信息
 */
export function getImageInfo(src: string): Promise<UniApp.GetImageInfoSuccessData> {
	return new Promise((resolve, reject) => {
		uni.getImageInfo({
			src,
			success: resolve,
			fail: reject,
		});
	});
}

/**
 * 预加载图片列表
 */
export function preloadImages(urls: string[]): Promise<void[]> {
	return Promise.all(
		urls.map(
			(url) =>
				new Promise<void>((resolve) => {
					uni.getImageInfo({
						src: url,
						success: () => resolve(),
						fail: () => resolve(), // 失败也继续
					});
				})
		)
	);
}

/**
 * 图片 URL 添加裁剪参数（支持 CDN 参数）
 */
export function addImageParams(
	url: string,
	params: {
		width?: number;
		height?: number;
		quality?: number;
		format?: 'jpg' | 'png' | 'webp';
	}
): string {
	if (!url) return url;

	// 如果是本地图片，不处理
	if (url.startsWith('/static') || url.startsWith('data:')) {
		return url;
	}

	const { width, height, quality, format } = params;
	const paramParts: string[] = [];

	if (width) paramParts.push(`w_${width}`);
	if (height) paramParts.push(`h_${height}`);
	if (quality) paramParts.push(`q_${quality}`);
	if (format) paramParts.push(`f_${format}`);

	if (paramParts.length === 0) return url;

	// 根据不同 CDN 服务商调整参数格式
	// 示例：七牛云格式
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}imageView2/1/${paramParts.join('/')}`;
}

/**
 * 选择图片（支持压缩）
 */
export async function chooseImage(
	options: {
		count?: number;
		sizeType?: ('original' | 'compressed')[];
		sourceType?: ('album' | 'camera')[];
		compress?: boolean;
		compressOptions?: ImageOptimizeOptions;
	} = {}
): Promise<string[]> {
	const {
		count = 1,
		sizeType = ['compressed'],
		sourceType = ['album', 'camera'],
		compress = true,
		compressOptions = {},
	} = options;

	return new Promise((resolve, reject) => {
		uni.chooseImage({
			count,
			sizeType,
			sourceType,
			success: async (res) => {
				let paths = res.tempFilePaths;

				// 如果启用压缩
				if (compress && paths.length > 0) {
					try {
						paths = await Promise.all(
							paths.map((path) => compressImage(path, compressOptions))
						);
					} catch (error) {
						console.warn('[Image] 批量压缩部分失败', error);
					}
				}

				resolve(paths);
			},
			fail: reject,
		});
	});
}

/**
 * 图片转 Base64
 */
export function imageToBase64(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		// #ifdef H5
		// H5 使用 FileReader
		const xhr = new XMLHttpRequest();
		xhr.open('GET', filePath, true);
		xhr.responseType = 'blob';
		xhr.onload = function () {
			const reader = new FileReader();
			reader.onloadend = function () {
				resolve(reader.result as string);
			};
			reader.onerror = reject;
			reader.readAsDataURL(xhr.response);
		};
		xhr.onerror = reject;
		xhr.send();
		// #endif

		// #ifndef H5
		// 小程序/APP 使用 base64
		uni.getFileSystemManager().readFile({
			filePath,
			encoding: 'base64',
			success: (res) => {
				resolve(`data:image/png;base64,${res.data}`);
			},
			fail: reject,
		});
		// #endif
	});
}

/**
 * 批量上传图片（带进度）
 */
export async function uploadImages(
	files: string[],
	uploadFn: (file: string) => Promise<string>,
	onProgress?: (current: number, total: number) => void
): Promise<string[]> {
	const results: string[] = [];

	for (let i = 0; i < files.length; i++) {
		try {
			const url = await uploadFn(files[i]);
			results.push(url);
			onProgress?.(i + 1, files.length);
		} catch (error) {
			console.error('[Image] 上传失败', files[i], error);
			throw error;
		}
	}

	return results;
}

/**
 * 批量上传图片（增强版：带重试、并发控制）
 */
export interface BatchUploadOptions {
	/** 上传函数 */
	uploadFn: (file: string) => Promise<string>;
	/** 上传前是否压缩 */
	compress?: boolean;
	/** 压缩选项 */
	compressOptions?: ImageOptimizeOptions;
	/** 最大并发数 */
	maxConcurrent?: number;
	/** 失败重试次数 */
	maxRetry?: number;
	/** 进度回调 */
	onProgress?: (current: number, total: number, percent: number) => void;
	/** 单个文件上传成功回调 */
	onItemSuccess?: (url: string, index: number) => void;
	/** 单个文件上传失败回调 */
	onItemError?: (error: any, index: number) => void;
}

export interface BatchUploadResult {
	success: string[];
	failed: { file: string; error: any; index: number }[];
	total: number;
}

export async function batchUploadImages(
	files: string[],
	options: BatchUploadOptions
): Promise<BatchUploadResult> {
	const {
		uploadFn,
		compress = true,
		compressOptions = {},
		maxConcurrent = 3,
		maxRetry = 2,
		onProgress,
		onItemSuccess,
		onItemError,
	} = options;

	const result: BatchUploadResult = {
		success: [],
		failed: [],
		total: files.length,
	};

	// 压缩图片
	let processedFiles = files;
	if (compress) {
		try {
			uni.showLoading({ title: '压缩图片中...' });
			processedFiles = await Promise.all(
				files.map((file) => compressImage(file, compressOptions))
			);
			uni.hideLoading();
		} catch (error) {
			console.warn('[Image] 批量压缩失败，使用原图', error);
			uni.hideLoading();
		}
	}

	// 并发上传队列
	const queue = processedFiles.map((file, index) => ({ file, index }));
	const running: Promise<void>[] = [];
	let completed = 0;

	const uploadWithRetry = async (
		file: string,
		index: number,
		retryCount = 0
	): Promise<string> => {
		try {
			return await uploadFn(file);
		} catch (error) {
			if (retryCount < maxRetry) {
				console.log(`[Image] 重试上传 (${retryCount + 1}/${maxRetry})`, index);
				// 延迟重试
				await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
				return uploadWithRetry(file, index, retryCount + 1);
			}
			throw error;
		}
	};

	const processItem = async (item: { file: string; index: number }) => {
		try {
			const url = await uploadWithRetry(item.file, item.index);
			result.success.push(url);
			onItemSuccess?.(url, item.index);
		} catch (error) {
			result.failed.push({ file: item.file, error, index: item.index });
			onItemError?.(error, item.index);
		} finally {
			completed++;
			const percent = Math.floor((completed / files.length) * 100);
			onProgress?.(completed, files.length, percent);
		}
	};

	// 并发控制
	while (queue.length > 0 || running.length > 0) {
		// 填充运行队列
		while (running.length < maxConcurrent && queue.length > 0) {
			const item = queue.shift()!;
			const promise = processItem(item);
			running.push(promise);
		}

		// 等待任一任务完成
		if (running.length > 0) {
			await Promise.race(running);
			// 清理已完成的任务
			for (let i = running.length - 1; i >= 0; i--) {
				const settled = await Promise.race([
					running[i],
					Promise.resolve('pending'),
				]);
				if (settled !== 'pending') {
					running.splice(i, 1);
				}
			}
		}
	}

	return result;
}

/**
 * 选择并上传图片（一站式）
 */
export async function chooseAndUpload(
	uploadFn: (file: string) => Promise<string>,
	options: {
		count?: number;
		compress?: boolean;
		compressOptions?: ImageOptimizeOptions;
		showProgress?: boolean;
	} = {}
): Promise<string[]> {
	const { count = 9, compress = true, compressOptions = {}, showProgress = true } = options;

	// 选择图片
	const files = await chooseImage({
		count,
		compress: false, // 后续统一压缩
	});

	if (files.length === 0) {
		throw new Error('未选择图片');
	}

	// 显示进度
	if (showProgress) {
		uni.showLoading({ title: '上传中 0%' });
	}

	try {
		const result = await batchUploadImages(files, {
			uploadFn,
			compress,
			compressOptions,
			maxConcurrent: 3,
			onProgress: (current, total, percent) => {
				if (showProgress) {
					uni.showLoading({ title: `上传中 ${percent}%` });
				}
			},
		});

		if (showProgress) {
			uni.hideLoading();
		}

		if (result.failed.length > 0) {
			uni.showToast({
				title: `${result.success.length} 张成功，${result.failed.length} 张失败`,
				icon: 'none',
			});
		} else {
			uni.showToast({
				title: `已上传 ${result.success.length} 张`,
				icon: 'success',
			});
		}

		return result.success;
	} catch (error) {
		if (showProgress) {
			uni.hideLoading();
		}
		throw error;
	}
}

/**
 * 给图片添加水印（用于异常报告、质检记录等）
 */
export interface WatermarkOptions {
	/** 水印文字 */
	text: string;
	/** 位置 */
	position?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
	/** 字体大小 */
	fontSize?: number;
	/** 字体颜色 */
	color?: string;
	/** 透明度 */
	opacity?: number;
}

export async function addWatermark(
	imagePath: string,
	options: WatermarkOptions
): Promise<string> {
	const {
		text,
		position = 'bottomRight',
		fontSize = 14,
		color = '#ffffff',
		opacity = 0.6,
	} = options;

	return new Promise((resolve, reject) => {
		// 获取图片信息
		uni.getImageInfo({
			src: imagePath,
			success: (imgInfo) => {
				const { width, height } = imgInfo;

				// 创建 canvas 上下文
				const ctx = uni.createCanvasContext('watermarkCanvas');

				// 绘制原图
				ctx.drawImage(imagePath, 0, 0, width, height);

				// 设置水印样式
				ctx.setFontSize(fontSize);
				ctx.setFillStyle(color);
				ctx.setGlobalAlpha(opacity);

				// 计算水印位置
				let x = 10;
				let y = 10;

				switch (position) {
					case 'topLeft':
						x = 10;
						y = fontSize + 10;
						break;
					case 'topRight':
						x = width - ctx.measureText(text).width - 10;
						y = fontSize + 10;
						break;
					case 'bottomLeft':
						x = 10;
						y = height - 10;
						break;
					case 'bottomRight':
						x = width - ctx.measureText(text).width - 10;
						y = height - 10;
						break;
					case 'center':
						x = (width - ctx.measureText(text).width) / 2;
						y = height / 2;
						break;
				}

				// 绘制水印
				ctx.fillText(text, x, y);

				// 导出图片
				ctx.draw(false, () => {
					uni.canvasToTempFilePath(
						{
							canvasId: 'watermarkCanvas',
							success: (res) => {
								resolve(res.tempFilePath);
							},
							fail: reject,
						},
						this
					);
				});
			},
			fail: reject,
		});
	});
}
