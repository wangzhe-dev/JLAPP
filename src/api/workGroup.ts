import http from "@/utils/request";

export function selectWorkGroupPerson(params: Record<string, any>) {
	return http.post(
		"/equipment/workGroupPerson/selectWorkGroupPerson",
		params,
		{ skipRepeatCheck: true }
	);
}

export function employeeQueryList(params: Record<string, any>) {
	const { departmentCode, ...payload } = params || {};
	const query = departmentCode ? { departmentCode } : undefined;
	const mergedPayload = departmentCode
		? { departmentCode, ...payload }
		: payload;
	return http.postQuery(
		"/erpMaster/employee/queryList",
		query,
		{ skipRepeatCheck: true, extraData: mergedPayload }
	);
}
