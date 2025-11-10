/**
 * 权限与角色工具：
 * - PAGE_PERMISSION_MAP: 页面访问所需的最小权限/角色映射（示例）
 * - hasRole / hasPermission: 判定工具
 * - checkPageAccess: 根据页面路径判断是否允许访问
 *
 * 说明：实际项目可从后端下发菜单树 / 权限点，再动态构造映射。
 */

export interface PermissionStateLike {
  roles?: string[]
  permissions?: string[]
}

// 页面访问要求（示例，可按需扩展）
// key 使用 pages.json 中的 path 或规范化后的 '/pages/xxx/index'
export const PAGE_PERMISSION_MAP: Record<string, { roles?: string[]; permissions?: string[] }> = {
  '/pages/controlManagement/index': { roles: ['ADMIN','LEADER'] },
  '/pages/exceptionManagement/index': { permissions: ['EXCEPTION_VIEW'] },
  '/pages/qualityControl/index': { permissions: ['QC_VIEW'] },
  // 新增示例：计划编辑需要计划编辑权限
  '/pages/inspectionPlan/editor/index': { permissions: ['PLAN_EDIT'] },
  // 设备维修页需要维修处理权限
  '/pages/eqManagement/repair/index': { permissions: ['REPAIR_HANDLE'] },
  // 保养工单详情仅管理员或维保角色
  '/pages/upkeepWorkOrderDetail/index': { roles: ['ADMIN','MAINTAIN'] },
  // 审核页面：组长或管理员
  '/pages/examine/index': { roles: ['LEADER','ADMIN'] },
  // 工单管理：任一工单查看权限
  '/pages/eqManagement/orderManagement/index': { permissions: ['ORDER_VIEW','ORDER_HANDLE'] },
}

export function hasRole(state: PermissionStateLike, role: string) {
  return !!state.roles?.includes(role)
}
export function hasPermission(state: PermissionStateLike, perm: string) {
  return !!state.permissions?.includes(perm)
}

export function matchAny<T extends string>(owned: T[] | undefined, required: T[] | undefined): boolean {
  if (!required || required.length === 0) return true
  if (!owned || owned.length === 0) return false
  return required.some(r => owned.includes(r))
}

export function checkPageAccess(path: string, state: PermissionStateLike) {
  // 放开模式：VITE_RELAX_ALL 或 VITE_RELAX_PERMISSION 任一开启则直接放行
  const relaxAll = (import.meta as any).env?.VITE_RELAX_ALL === '1'
  const relaxPerm = relaxAll || (import.meta as any).env?.VITE_RELAX_PERMISSION === '1'
  if (relaxPerm) return true
  const rule = PAGE_PERMISSION_MAP[path]
  if (!rule) return true // 未配置默认放行
  const roleOk = matchAny(state.roles as string[] | undefined, rule.roles)
  const permOk = matchAny(state.permissions as string[] | undefined, rule.permissions)
  return roleOk && permOk
}
