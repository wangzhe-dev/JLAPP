import type { Ref } from "vue";
import type { CFormSchemaField } from "@/components/c-form/types";

export type OptionItem = { label: string; value: string; raw?: any };

export interface BuildRepairFormFieldsOptions {
	repairResultOptions: Ref<OptionItem[]>;
	faultReasonTypeOptions: Ref<OptionItem[]>;
	faultReasonOptions: Ref<OptionItem[]>;
	faultMeasureTypeOptions: Ref<OptionItem[]>;
	faultMeasureOptions: Ref<OptionItem[]>;
	requestUrl: string;
	repairGroupTitle?: string;
}

export function buildRepairFormFields({
	repairResultOptions,
	faultReasonTypeOptions,
	faultReasonOptions,
	faultMeasureTypeOptions,
	faultMeasureOptions,
	requestUrl,
	repairGroupTitle,
}: BuildRepairFormFieldsOptions): CFormSchemaField[] {
	const repairTitle = repairGroupTitle || "维修记录";
	const toProp = (suffix: string) => `repairFormData.${suffix}`;
	return [
		{
			component: "GroupTitle",
			groupTitle: repairTitle,
			prop: "_group_repair",
		},
		{
			label: "维修结果",
			prop: toProp("repairReasonCode"),
			component: "Dict",
			required: true,
			placeholder: "请选择维修结果",
			options: () => repairResultOptions.value,
			defaultValue: "",
		},

		{
			label: "开始时间",
			prop: toProp("repairStartTime"),
			component: "DateTime",
			required: true,
			placeholder: "请选择开始时间",
			// defaultValue: () => new Date().toISOString(),
		},
		{
			label: "结束时间",
			prop: toProp("repairEndTime"),
			component: "DateTime",
			required: true,
			placeholder: "请选择结束时间",
		},
		{
			label: "维修净时(min)",
			prop: toProp("maintenanceTime"),
			component: "Number",
			required: true,
			placeholder: "请输入维修净时",
			preset: "nonNegative",
		},
		{
			label: "故障原因",
			prop: toProp("faultReasonDesc"),
			component: "Textarea",
			placeholder: "请输入故障原因",
		},
		{
			component: "GroupTitle",
			groupTitle: "更换备件",
			prop: "_group_changeParts",
			groupSlot: "changePartsActions",
		},
		{
			label: "更换备件",
			prop: toProp("changeParts"),
			slotName: "changeParts",
		},
		{
			label: "维修过程",
			prop: toProp("repairProcess"),
			component: "Textarea",
			placeholder: "请输入维修过程",
		},
		{
			label: "原因或建议",
			prop: toProp("reason"),
			component: "Textarea",
			placeholder: "请输入原因或建议",
		},
		{
			label: "拍照记录",
			prop: toProp("imagePath"),
			component: "Uploader",
			componentProps: {
				limit: 9,
				uploadUrl: "/file/upload",
				uploadBaseUrl: requestUrl,
				fieldName: "file",
			},
		},
	];
}
