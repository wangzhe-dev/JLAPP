export declare namespace GetDict {
	interface Body {
		/**
		 * 创建者
		 */
		createBy : string
		/**
		 * 创建时间
		 */
		createTime : string
		/**
		 * CSS 类名
		 */
		cssClass : string | null
		/**
		 * 是否为默认项
		 */
		default : boolean
		/**
		 * 字典编码
		 */
		dictCode : string
		/**
		 * 字典标签
		 */
		dictLabel : string
		/**
		 * 字典排序
		 */
		dictSort : number
		/**
		 * 字典类型
		 */
		dictType : string
		/**
		 * 字典值
		 */
		dictValue : string
		/**
		 * 是否为默认值
		 */
		isDefault : string
		/**
		 * 列表类名
		 */
		listClass : string
		/**
		 * 附加参数
		 */
		params : Record<string, unknown>
		/**
		 * 备注信息
		 */
		remark : string | null
		/**
		 * 搜索图标值
		 */
		searchValue : string | null
		/**
		 * 状态
		 */
		status : string
		/**
		 * 更新者
		 */
		updateBy : string | null
		/**
		 * 更新时间
		 */
		updateTime : string | null
	}
}