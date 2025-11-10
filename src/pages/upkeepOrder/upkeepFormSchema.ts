import type { CFormSchemaField } from "@/components/c-form/types";

interface BuildUpkeepFormFieldsOptions {
	groupTitle?: string;
}

const toProp = (suffix: string) => `upkeepFormData.${suffix}`;

export function buildUpkeepFormFields({
	groupTitle,
}: BuildUpkeepFormFieldsOptions): CFormSchemaField[] {
	const upkeepTitle = groupTitle || "保养记录";
	return [
		{
			component: "GroupTitle",
			groupTitle: upkeepTitle,
			prop: "_group_upkeep",
		},
		{
			label: "实际工时(小时)",
			prop: toProp("actualHour"),
			component: "Input",
			required: true,
			placeholder: "请输入实际工时",
			componentProps: {
				type: "number",
			},
		},
		{
			label: "开始时间",
			prop: toProp("startTime"),
			component: "DateTime",
			required: true,
			placeholder: "请选择开始时间",
			defaultValue: () => new Date().toISOString(),
		},
		{
			label: "结束时间",
			prop: toProp("finishTime"),
			component: "DateTime",
			required: true,
			placeholder: "请选择结束时间",
		},
		{
			label: "保养说明",
			prop: toProp("remark"),
			component: "Textarea",
			placeholder: "请输入保养说明",
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
	];
}
