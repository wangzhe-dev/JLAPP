// 统一接口路径常量，便于维护与替换
export const EP = {
  AUTH_LOGIN: '/auth/repairAppLogin',
  AUTH_REFRESH: '/auth/refreshToken',
  USER_INFO: '/system/user/getByUserId',
  MENU_ROUTERS: '/system/menu/getRouters',
  USER_MESSAGE_PAGE: '/infra/user/message/pageList',
  USER_MESSAGE_PAGE_ALL: '/infra/user/message/pageAllList',
  USER_MESSAGE_MARK_ALL_READ: '/infra/user/message/read',
  DICT_LIST: '/system/dict/data/queryDictList',
  MASTER_DEPT_TREE: '/erpMaster/costDepartment/listTree',
  // ===== 工单分页（示例占位，需按后端实际路径调整） =====
  WO_REPAIR_PAGE: '/workorder/repair/page',
  WO_MAINTAIN_PAGE: '/workorder/maintain/page',
  WO_INSPECTION_PAGE: '/workorder/inspection/page',
  BC_CUT_PAGE: '/produce/bcCut/page',
  // ===== 质量检测相关接口 =====
  QUALITY_FILLIN_LIST: '/quality/fillin/list',
  QUALITY_FILLIN_DELETE: '/quality/fillin/delete',
  QUALITY_FILLIN_DETAIL: '/quality/fillin/detail',
  QUALITY_FILLIN_SAVE: '/quality/fillin/save',
  QUALITY_FILLIN_UPDATE: '/quality/fillin/update',
} as const

export type EndpointKey = keyof typeof EP
