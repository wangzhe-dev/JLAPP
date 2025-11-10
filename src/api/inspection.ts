import { http } from "@/utils/request";

export function getInspectionDetail(params: {
	mtNo: string;
	type?: string | number;
}) {
	return http.post<any>("/equipment/equipmentCheck/wechatCheckOrderById", params);
}

export function getInspectionProcessList(params: any) {
	return http.post<any>(
		"/equipment/equipCheckProcess/selectCheckProcessByPage",
		params,
	);
}

export function commitCheckMission(params: any) {
	return http.post<any>(
		"/equipment/equipmentCheckMission/commitCheckMission",
		params
	);
}
