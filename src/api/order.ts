// 工单相关接口封装（根据用户提供的 order.js 迁移为 TypeScript 并适配统一 http 封装）
// 说明：原 order.js 使用 service({...})，此处全部通过 http.post/http.get 封装；
// http 封装会自动解包 envelope.data，因此这些函数直接返回后端 data 层。

import { http } from "@/utils/request";

function buildQueryString(params: Record<string, any> | undefined | null) {
	if (!params || typeof params !== "object") return "";
	const entries = Object.entries(params).filter(
		([, value]) => value !== undefined && value !== null && value !== ""
	);
	if (!entries.length) return "";
	return entries
		.map(
			([key, value]) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
		)
		.join("&");
}

function postWithQuery<T = any>(url: string, params?: Record<string, any>) {
	const query = buildQueryString(params);
	const finalUrl = query ? `${url}?${query}` : url;
	return http.post<T>(finalUrl, params);
}

// ---- 列表 & 基础 ----
export function selectMaintainOrder(params: any) {
	return http.post<any>(
		"/equipment/maintain/WechatEquipmentMaintain/selectMaintainOrder",
		params
	);
}
export function selectPlanOrder(params: any) {
	return postWithQuery<any>(
		"/equipment/maintain/workOrder/selectCompleteOrder",
		params
	);
}
// export function selectPlanOrder(params: any) {
// 	return http.get<any>(
// 		"/equipment/applet/maintain/workOrder/selectPlanOrder",
// 		params,
// 	);
// }
export function getOrderList(params: any) {
	return http.post<any>(
		"/equipment/repair/WechatEquipmentRepair/getOrderList",
		params
	);
}
export function orderListDetail(params: any) {
	return http.post<any>(
		"/equipment/repair/WechatEquipmentRepair/orderListDetail",
		params
	);
}
export function getRepairdispatch(params: any) {
	return postWithQuery<any>(
		"/equipment/repair/WechatEquipmentRepair/getRepairdispatch",
		params
	);
}
export function getRepairMessage(params: any) {
	return postWithQuery<any>(
		"/equipment/repair/WechatEquipmentRepair/getRepairMessage",
		params
	);
}
export function getFactoryTree(params: any) {
	return http.post<any>("/equipment/factory/getFactoryTree", params);
}
export function selectJneEquipmentInfoList(params: any) {
	return http.post<any>(
		"/equipment/rpc/equipmentInfo/selectJneEquipmentInfoList",
		params
	);
}

export function selectEquipmentInfo(params: {
	equipmentCode?: string;
	equipmentName?: string;
}) {
	return http.post<any>("/equipment/equipmentInfo/queryEquipmentCode", params);
}
export function getFtpmFaultType(params: any) {
	return http.post<any>("/equipment/faultType/select-ftpmFaultType", params);
}
export function getFtpmFaultDesc(params: any) {
	return http.post<any>("/equipment/faultDesc/select-ftpmFaultDesc", params);
}
export function queryDictList(params: any) {
	return http.post<any>("/system/dict/data/queryDictList", params);
}
export function getPartsManagementlist(params: any) {
	return http.post<any>("/produce/jneWorkshopJples/ifCmwhJplesMom07", params);
}
export function upload(params: any) {
	return http.post<any>("/file/upload", params);
}
export function equipmentRepaircommit(params: any) {
	return http.post<any>("/equipment/repair/equipmentRepaircommit/add", params);
}
export function equipmentRepairdispatch(params: any) {
	return http.post<any>(
		"/equipment/repair/equipmentRepairdispatch/add",
		params
	);
}
export function issueOrder(params: any) {
	return http.post<any>(
		"/equipment/applet/maintain/workOrder/issueOrder",
		params
	);
}
export function userAllList(params: any) {
	return http.post<any>("/system/user/getAllUsers", params);
}
export function equipmentRepairAdd(params: any) {
	return http.post<any>("/equipment/repair/equipmentRepair/add", params);
}
export function requestOrder(params: any) {
	return http.post<any>(
		"/equipment/repair/equipmentRepairdispatch/requestOrder",
		params
	);
}
export function getWorkOrder(params: any) {
	// 原代码使用 GET + data，这里改成 post 以保持统一（如需保持 GET，请改用 http.get 并确认后端支持 query）
	return http.get<any>(
		"/equipment/applet/maintain/workOrder/getWorkOrder",
		params
	);
}
export function transferOrder(params: any) {
	return http.get<any>(
		"/equipment/applet/maintain/workOrder/transferOrder",
		params
	);
}
export function equipmentRepairauditing(params: any) {
	return http.post<any>(
		"/equipment/repair/equipmentRepairauditing/add",
		params
	);
}
export function getRepairauditing(params: any) {
	return postWithQuery<any>(
		"/equipment/repair/WechatEquipmentRepair/getRepairauditing",
		params
	);
}
export function selectFaultReasonType(params: any) {
	return http.post<any>(
		"/equipment/faultReasonType/select-faultReasonType",
		params
	);
}
export function selectFaultReason(params: any) {
	return http.post<any>("/equipment/faultReason/select-faultReason", params);
}
export function selectFaultMeasureType(params: any) {
	return http.post<any>(
		"/equipment/faultMeasureTypeType/select-faultMeasureType",
		params
	);
}
export function selectFaultMeasure(params: any) {
	return http.post<any>("/equipment/faultMeasure/select-faultMeasure", params);
}
export function submitOrder(params: any) {
	return http.post<any>(
		"/equipment/applet/maintain/workOrder/submitOrder",
		params
	);
}
export function selectMyOrderPageCheck(params: any) {
	return http.post<any>(
		"/equipment/equipmentCheck/selectMyOrderPageCheck",
		params
	);
}
export function selectOrderPageCheck(params: any) {
	return http.post<any>(
		"/equipment/equipmentCheck/selectOrderPageCheck",
		params
	);
}
export function inspectIssueOrder(params: any) {
	return http.post<any>("/equipment/equipmentCheck/issueOrder", params);
}
export function inspectIssueOrderList(params: any) {
	return http.post<any>("/equipment/equipmentCheck/issueOrderList", params);
}
export function inspectWorkOrder(params: any) {
	return http.post<any>("/equipment/equipmentCheck/getWorkOrder", params);
}
export function inspectTransferOrder(params: any) {
	return http.post<any>("/equipment/equipmentCheck/transferOrder", params);
}
export function queryEquipmentCode(params: any) {
	return http.post<any>("/equipment/equipmentInfo/queryEquipmentCode", params);
}
export function getInfo() {
	return http.get<any>("/system/user/getInfo");
}

// ---- 辅助：统一分页数据提取 ----
export function extractPage(result: any) {
	if (!result) return { list: [], total: 0 };
	const list = Array.isArray(result.records)
		? result.records
		: Array.isArray(result.rows)
		? result.rows
		: Array.isArray(result.list)
		? result.list
		: [];
	const total = result.total ?? result.count ?? list.length;
	return { list, total };
}
