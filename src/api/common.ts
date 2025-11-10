import { http } from '@/utils/request'
import { EP } from './endpoints'
import type { GetDict } from '@/types/api/common'

// 根据字典类型查询字典数据信息
export const getDictByType = (type : string) => http.get<GetDict.Body[]>(`/szg-admin/api/app/dictdata/type/${type}`)

// 根据key查询参数配置信息
export const getConfigByKey = (key : string) => http.get<string>(`/system/common/config/configKey/${key}`)

// 查询部门树（主数据）
export const getDepartmentTree = (query: Record<string, any> = {}) =>
	http.post<any[]>(EP.MASTER_DEPT_TREE, query, { skipRepeatCheck: true })
