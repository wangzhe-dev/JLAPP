// 维修报修表单 Schema （使用内置字段组件；无额外自定义注册）
import type { CFormSchema } from "@/components/c-form/types";
import { http } from "@/utils/request";
import { requestUrl } from "@/config";
export const repairFormSchema: CFormSchema = {
	showReset: false,
	resetBehavior: "back",
	submitText: "提交报修",
	fields: [
		// ===== 基本信息 =====
		{ groupTitle: "基本信息" },
		{
			prop: "equipmentCode",
			label: "设备编号",
			component: "Scan",
			placeholder: "请扫描设备二维码",
			required: true,
			componentProps: {
				mockValue: "",
			},
		},
		{
			prop: "equipmentName",
			label: "设备名称",
			component: "Normal",
			readonly: true,
			placeholder: "设备名称",
			required: true,
			componentProps: { copyable: true, emptyText: "-" },
			// 扫码成功后由前端请求接口回填设备名称
		},
		{
			prop: "factoryName",
			label: "设备位置",
			component: "Input",
			placeholder: "请输入设备位置",
		},
		{
			prop: "warnType",
			label: "故障类型",
			component: "Dict",
			placeholder: "请选择故障类型",
			componentProps: {
				labelProp: "warnDesc",
			},
			// onClick: ({ model }) => {
			// 	// 例如：必须先选设备编号
			// 	// if (!model.equipmentCode) {
			// 	console.log(model);

			// 	// 	uni.showToast({ title: "请先扫描设备编号", icon: "none" });
			// 	// 	// 若未来你需要“阻止弹出”，当前 picker 组件没有 before-open，暂时只能提示后返回
			// 	// 	// 这里返回 false 只是预留，后续可扩展自定义 picker 时判断
			// 	// 	return false;
			// 	// }
			// },
			onChange: ({ value, model, options }) => {
				const selected = Array.isArray(options) ? options[0] : null;
				if (selected) {
					const origin = selected.origin || selected.raw || {};
					const raw = origin?.raw || origin;
					model.warnDesc =
						selected.label ||
						origin.warnDesc ||
						origin.faultTypeDesc ||
						raw?.warnDesc ||
						raw?.faultTypeDesc ||
						origin.label ||
						origin.text ||
						origin.name ||
						"";
				} else if (!value) {
					model.warnDesc = "";
				}

				// 例如：选择故障类型后清空问题描述
				// if (value !== prev) {
				// 	model.problemDetail = "";
				// }
			},
			// 统一使用 Dict 组件；这里直接通过 asyncOptions 远程获取即可（Dict 组件内部走 getOptions 优先级）
			asyncOptions: {
				// 每次点击都重新拉取，确保实时性
				reloadOnOpen: true,
				// 使用懒加载：首次/每次打开时再调接口（与 reloadOnOpen 组合）
				lazy: true,
				immediate: false,
				cache: false,
				api: async () => {
					try {
						const resp: any = await http.post(
							"/equipment/faultType/select-ftpmFaultType",
							{}
						);
						const list = Array.isArray(resp) ? resp : resp?.data || [];
						return list.map((it: any) => ({
							label: it.faultTypeDesc,
							value: it.faultTypeCode,
							raw: it,
						}));
					} catch {
						return [];
					}
				},
			},
		},
		{
			prop: "warnDesc",
			label: "故障类型描述",
			component: "Normal",
			visible: false,
			readonly: true,
			defaultValue: "",
		},
		{
			prop: "faultDesc",
			label: "报修部门/车间",
			component: "Input",
			placeholder: "可输入报修部门/车间",
			componentProps: {
				emptyText: "-",
			},
		},
		{
			prop: "expectRepairTime",
			label: "损坏时间",
			component: "DateTime",
			required: true,
		},
		{
			prop: "problemDetail",
			label: "问题描述",
			component: "Textarea",
			required: true,
			placeholder: "请输入问题描述",
		},
		// 当故障类型为 OTHER 时显示补充描述
		{
			prop: "problemDetailExtra",
			label: "其它说明",
			component: "Textarea",
			placeholder: "请补充其它类型说明",
			showWhen: { warnType: "YJGZ" },
			clearWhenHidden: true,
		},
		{
			prop: "imagePath",
			label: "上传图片",
			component: "Uploader",
			placeholder: "上传图片",
			required: true,
			componentProps: {
				limit: 9,
				uploadUrl: "/file/upload",
				uploadBaseUrl: requestUrl,
				fieldName: "file",
			},
		},
	],
};
