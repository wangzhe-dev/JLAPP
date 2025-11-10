// 全端通用的方法可以写在这里

/**
 * 保存图片到手机
 * @param url 图片的路径，可以是相对路径，临时文件路径，存储文件路径，网络图片路径
 */
export const saveImageToPhotosAlbum = (url : string) : Promise<void> => {
	return new Promise(async (resolve, reject) => {
		// 当前是否为网络图片
		const isNetworkImage = url.startsWith('http://') || url.startsWith('https://')

		// #ifdef H5
		// 在uniapp环境中打开的webview的h5网页，可以使用plus对象
		if (navigator.userAgent.indexOf('uni-app') !== -1) {
			plus.gallery.save(url, () => {
				uni.showToast({
					title: '保存成功',
					icon: 'success'
				})
				resolve()
			}, () => {
				uni.$tao.toast('保存失败')
				reject()
			})
		} else {
			try {
				const filePath = await downloadFile(url)
				const oA = document.createElement('a')
				oA.download = ''
				oA.href = filePath
				document.body.appendChild(oA)
				oA.click()
				oA.remove()
				uni.showToast({
					title: '保存成功',
					icon: 'success'
				})
				resolve()
			} catch {
				reject()
			}
		}
		// #endif

		// #ifndef H5
		try {
			let filePath = url
			if (isNetworkImage) filePath = await downloadFile(url)

			// 保存图片到系统相册
			uni.saveImageToPhotosAlbum({
				filePath,
				success: () => {
					uni.showToast({
						title: '保存成功',
						icon: 'success'
					})
					resolve()
				},
				fail: (err) => {
					uni.$tao.toast('保存图片失败：' + err.errMsg)
					reject()
				}
			})
		} catch {
			reject()
		}
		// #endif
	})
}

/**
 * 下载文件资源到本地
 * @param url 下载资源的 url
 * @param header HTTP 请求 Header, header 中不能设置 Referer
 * @param filePath 指定文件下载后存储的路径 (本地路径)
 * @return 返回文件的本地临时路径
 */
export const downloadFile = (url : string, header : Record<string, string> = {}, filePath ?: string) : Promise<string> => {
	return new Promise((resolve, reject) => {
		uni.downloadFile({
			url,
			header,
			filePath,
			success: (res) => {
				if (res.statusCode === 200) {
					resolve(res.tempFilePath)
				} else {
					if (res.errMsg) uni.$tao.toast(res.errMsg)
					reject(new Error(res.errMsg))
				}
			},
			fail: (err) => {
				uni.$tao.toast('下载文件失败')
				reject(new Error(err))
			}
		})
	})
}