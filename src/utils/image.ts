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
