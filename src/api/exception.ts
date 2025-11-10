/*
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-13 13:15:50
 * @LastEditors: liangjia
 * @LastEditTime: 2025-10-27 13:38:56
 * @FilePath: /NEWAPP/src/api/exception.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import http from '@/utils/request';

/**
 * 异常知识库搜索接口
 * @param params 搜索参数
 * @returns 异常知识库搜索结果
 */
export function knowledgeSearch(params: Record<string, any>) {
  return http.post("/dispatch/exception/management/knowledgeSearch", params, {
    skipRepeatCheck: true,
  });
}

/**
 * 异常知识库详情
 */
export function findDetailsById(params: Record<string, any>) {
	return http.post("/dispatch/exception/management/findDetailsById", params);
}

/**
 * 异常派工
 */
export function dispatchException(params: Record<string, any>) {
	return http.post(
		"/dispatch/exception/management/dispatchException",
		params
	);
}

/**
 * 异常接收
 */
export function receiveException(params: Record<string, any>) {
	return http.post(
		"/dispatch/exception/management/receiveException",
		params
	);
}

/**
 * 异常转派
 */
export function reassignException(params: Record<string, any>) {
	return http.post(
		"/dispatch/exception/management/reassignException",
		params
	);
}

/**
 * 异常处理完成
 */
export function completeException(params: Record<string, any>) {
	return http.post(
		"/dispatch/exception/management/completeException",
		params
	);
}

/**
 * 异常升级
 */
export function escalateException(params: Record<string, any>) {
	return http.post(
		"/dispatch/exception/management/escalationException",
		params
	);
}
