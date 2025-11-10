// 更精确的邮箱验证，支持国际化域名
const email = (value : string) : boolean => {
	return (/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/).test(value)
}

// 更新手机号验证，支持最新号段
const mobile = (value : string) : boolean => {
	return (/^1(3[0-9]|4[01456879]|5[0-35-9]|6[2567]|7[0-8]|8[0-9]|9[0-35-9])\d{8}$/).test(value)
}

// 简化URL验证，提高可读性
const url = (value : string) : boolean => {
	try {
		new URL(value)
		return true
	} catch {
		return false
	}
}

// 改进日期验证，支持更多格式
const date = (value : string) : boolean => {
	if (!value) return false

	// 支持YYYY-MM-DD, YYYY/MM/DD, YYYY-MM-DD HH:mm:ss等格式
	const datePattern = /^\d{4}[-\/]\d{2}[-\/]\d{2}( \d{1,2}:\d{2}(:\d{2})?)?$/
	if (!datePattern.test(value)) return false

	// 尝试解析日期
	const timestamp = Date.parse(value.replace(/-/g, '/'))
	return !isNaN(timestamp)
}

/**
 * 验证ISO类型的日期格式
 */
const dateISO = (value : string) : boolean => {
	return (/^\d{4}[\/\-](0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])$/).test(value)
}

/**
 * 验证十进制数字
 */
const number = (value : string) : boolean => {
	return (/^[\+-]?(\d+\.?\d*|\.\d+|\d\.\d+e\+\d+)$/).test(value)
}

/**
 * 验证字符串
 */
const string = (value : string) : boolean => {
	return typeof value === 'string'
}

/**
 * 验证整数
 */
const digits = (value : string) : boolean => {
	return (/^\d+$/).test(value)
}

// 增强身份证验证，包括校验位验证
const idCard = (value : string) : boolean => {
	if (!(/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/).test(value)) {
		return false
	}

	// 校验位验证逻辑
	const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
	const checksum = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

	let sum = 0
	for (let i = 0; i < 17; i++) {
		sum += parseInt(value.charAt(i)) * weights[i]
	}

	const lastChar = value.charAt(17).toUpperCase()
	return checksum[sum % 11] === lastChar
}

/**
 * 是否车牌号
 */
const carNo = (value : string) : boolean => {
	// 新能源车牌
	const xreg = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}(([0-9]{5}[DF]$)|([DF][A-HJ-NP-Z0-9][0-9]{4}$))/
	// 旧车牌
	const creg = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9挂学警港澳]{1}$/
	if (value.length === 7) {
		return creg.test(value)
	}
	if (value.length === 8) {
		return xreg.test(value)
	}
	return false
}

/**
 * 金额,只允许2位小数
 */
const amount = (value : string) : boolean => {
	// 金额，只允许保留两位小数
	return (/^[1-9]\d*(,\d{3})*(\.\d{1,2})?$|^0\.\d{1,2}$/).test(value)
}

/**
 * 中文
 */
const chinese = (value : string) : boolean => {
	const reg = /^[\u4e00-\u9fa5]+$/gi
	return reg.test(value)
}

/**
 * 只能输入字母
 */
const letter = (value : string) : boolean => {
	return (/^[a-zA-Z]*$/).test(value)
}

/**
 * 只能是字母或者数字
 */
const enOrNum = (value : string) : boolean => {
	// 英文或者数字
	const reg = /^[0-9a-zA-Z]*$/g
	return reg.test(value)
}

/**
 * 验证是否包含某个值
 */
const contains = (value : string, param : string) : boolean => {
	return value.indexOf(param) >= 0
}

/**
 * 验证一个值范围[min, max]
 */
const range = (value : number, param : number[]) : boolean => {
	return value >= param[0] && value <= param[1]
}

/**
 * 验证一个长度范围[min, max]
 */
const rangeLength = (value : string, param : number[]) : boolean => {
	return value.length >= param[0] && value.length <= param[1]
}

/**
 * 是否固定电话
 */
const landline = (value : string) : boolean => {
	const reg = /^\d{3,4}-\d{7,8}(-\d{3,4})?$/
	return reg.test(value)
}

/**
 * 判断是否为空
 */
const empty = (value : unknown) : boolean => {
	switch (typeof value) {
		case 'undefined':
			return true
		case 'string':
			if (value === '0') return true
			else if (value.replace(/(^[ \t\n\r]*)|([ \t\n\r]*$)/g, '').length === 0) return true
			break
		case 'boolean':
			if (!value) return true
			break
		case 'number':
			if (value === 0 || isNaN(value)) return true
			break
		case 'object':
			for (const key in value) {
				// 对象非空
				if (Object.prototype.hasOwnProperty.call(value, key)) return false
			}
			return true
	}
	return false
}

/**
 * 是否json字符串
 */
const jsonString = (value : string) : boolean => {
	if (typeof value === 'string') {
		try {
			const obj = JSON.parse(value)
			if (typeof obj === 'object' && obj) {
				return true
			}
			return false
		} catch {
			return false
		}
	}
	return false
}

/**
 * 是否数组
 */
const array = (value : unknown) : boolean => {
	if (typeof Array.isArray === 'function') return Array.isArray(value)

	return Object.prototype.toString.call(value) === '[object Array]'
}

/**
 * 是否对象
 */
const object = (value : unknown) : boolean => {
	return typeof value === 'object' && value !== null
}

/**
 * 是否短信验证码
 */
const code = (value : string, len : number = 6) => {
	return new RegExp(`^\\d{${len}}$`).test(value)
}

/**
 * 是否函数方法
 */
const func = (value : unknown) : boolean => {
	return typeof value === 'function'
}

/**
 * 是否promise对象
 */
const promise = (value : unknown) : boolean => {
	return !!value && typeof value === 'object' && 'then' in value && typeof value.then === 'function'
}

/**
 * 是否图片格式
 */
const image = (value : string) : boolean => {
	const newValue = value.split('?')[0]
	const IMAGE_REGEXP = /\.(jpeg|jpg|gif|png|svg|webp|jfif|bmp|dpg)/i
	return IMAGE_REGEXP.test(newValue)
}

/**
 * 是否视频格式
 */
const video = (value : string) : boolean => {
	const VIDEO_REGEXP = /\.(mp4|mpg|mpeg|dat|asf|avi|rm|rmvb|mov|wmv|flv|mkv|m3u8)/i
	return VIDEO_REGEXP.test(value)
}

/**
 * 是否为正则对象
 */
const regExp = (value : unknown) : boolean => {
	return value instanceof RegExp
}

export default {
	email,
	mobile,
	url,
	date,
	dateISO,
	number,
	digits,
	idCard,
	carNo,
	amount,
	chinese,
	letter,
	enOrNum,
	contains,
	range,
	rangeLength,
	empty,
	isEmpty: empty,
	jsonString,
	landline,
	object,
	array,
	code,
	func,
	promise,
	video,
	image,
	regExp,
	string
}