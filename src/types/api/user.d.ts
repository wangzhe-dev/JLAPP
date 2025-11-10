export declare namespace GetInfo {
	interface Body {
		/**
		 * 用户头像链接
		 */
		avatar : string | null
		/**
		 * 创建者用户名或 ID
		 */
		createBy : string
		/**
		 * 用户创建时间
		 */
		createTime : string
		/**
		 * 自定义标识，用于区分不同类型用户或状态
		 */
		customFlag : number
		/**
		 * 删除标志，用于逻辑删除（例如：0 表示未删除，1 表示已删除）
		 */
		delFlag : string
		/**
		 * 所属部门 ID
		 */
		deptId : string
		/**
		 * 用户电子邮箱地址
		 */
		email : string | null
		/**
		 * 用户身份证号码
		 */
		identityCard : string
		/**
		 * 离职消息标志，用于标识用户是否已离职
		 */
		leaveMsgFlag : number
		/**
		 * 用户最后登录的 IP 地址
		 */
		loginIp : string | null
		/**
		 * 用户昵称
		 */
		nickName : string
		/**
		 * 额外参数，用于存储用户相关的一些附加信息
		 */
		params : Record<string, unknown>
		/**
		 * 用户手机号码
		 */
		phonenumber : string
		/**
		 * 用户真实姓名
		 */
		realName : string
		/**
		 * 用户性别（例如：0 表示未知，1 表示男，2 表示女）
		 */
		sex : string
		/**
		 * 用户状态（例如：0 表示禁用，1 表示启用）
		 */
		status : string
		/**
		 * 用户在系统中的唯一 ID
		 */
		userId : string
		/**
		 * 用户登录名或用户名
		 */
		userName : string
		/**
		 * 用户类型（例如：0 表示普通用户，1 表示管理员）
		 */
		userType : number
	}
}