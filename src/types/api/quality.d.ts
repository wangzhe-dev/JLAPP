// 质量检测相关类型定义
export interface QualityTestItem {
  id: string
  fillinOrder: string
  fillinStatus: string
  qualityTypeCode: string
  processesId: string
  shipNumber: string
  sectionNumber: string
  assemblyUnitNumber: string
  checkoutName: string
  flawDetectionName: string
  checkoutDate: string
  buttonPermissionList?: any
  [key: string]: any
}

export interface QualityListQuery {
  shipOrSection?: string
  fillinStatus?: string
  pageNum?: number
  pageSize?: number
}

export interface CardAction {
  code: string | number
  label: string
  type?: 'primary' | 'danger' | 'warning' | 'success'
}

export interface QualityFillinListResponse {
  records: QualityTestItem[]
  total: number
  size: number
  current: number
  pages: number
}

export interface DictItem {
  dictValue: string
  dictLabel: string
  dictType?: string
  dictSort?: number
}

export interface DictListResponse {
  [key: string]: DictItem[]
}
