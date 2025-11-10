import type { Ref } from 'vue'

export type FormValidateTrigger = 'change' | 'blur' | 'submit'

export interface CFormRule {
  required?: boolean
  message?: string
  trigger?: FormValidateTrigger | FormValidateTrigger[]
  pattern?: RegExp
  validator?: (value: any, rule: CFormRule, model: Record<string, any>) => boolean | Promise<boolean>
  min?: number
  max?: number
  type?: 'string' | 'number' | 'array' | 'email' | 'mobile' | 'idcard'
}

export interface BuiltinPresetContext {
  model: Record<string, any>
  field: CFormSchemaField
}

export type BuiltinPresetFactory = (ctx: BuiltinPresetContext) => CFormRule | CFormRule[]

export interface AsyncOptionsConfig<T = any> {
  immediate?: boolean // 进入时是否立即加载
  lazy?: boolean // 懒加载：首次点击再加载（等价于 immediate:false）
  api: (dependValues: Record<string, any>, field: CFormSchemaField) => Promise<T[]>
  labelKey?: string
  valueKey?: string
  cache?: boolean | number // 缓存时间（ms）或 true 表示 session 级
  dependOn?: string[] // 依赖字段变更触发重新拉取
  transform?: (raw: T[]) => any[]
  /** 每次打开（点击）都重新拉取；忽略已存在的 options 长度。适用于需要实时字典或频繁变化数据。 */
  reloadOnOpen?: boolean
}

// 字典配置：通过 type 拉取后端通用字典，统一标准化为 {label,value,raw}
export interface DictOptionsConfig<T = any> {
  type: string // 字典类型编码
  labelKey?: string // 后端返回的 label 字段名，默认自动猜测
  valueKey?: string // 后端返回的 value 字段名，默认自动猜测
  transform?: (raw: T[]) => any[] // 可自定义二次转换（在标准化前执行）
  immediate?: boolean // 是否在挂载时立即加载（默认 true）
  cache?: boolean | number // 与 asyncOptions 规则一致
}

export interface DynamicVisibleContext {
  model: Record<string, any>
  values: Record<string, any>
  field: CFormSchemaField
}

export interface CFormSchemaFieldBase {
  /**
   * 字段唯一标识。对于分组标题（groupTitle）可省略，运行时自动生成 _g_x。
   */
  prop?: string
  /** 分组标题：若存在则该项渲染为标题分隔行，不参与校验与取值 */
  groupTitle?: string
  /** 分组标题右侧自定义插槽名称（默认为 group:${prop}） */
  groupSlot?: string
  /** 分组结束标记：用于标记分组的结束位置 */
  groupEnd?: boolean
  /** Slot 类型字段对应的插槽名称 */
  slotName?: string
  /** 是否使用 sar-form-item 包裹 Slot 字段（默认为 label 存在时开启） */
  slotFormItem?: boolean
  label?: string
  // 更简写的类型声明：用户可直接写 type:"input"，内部会映射为对应 component
  // 若同时提供 component 与 type，以 component 优先
  type?: string
  required?: boolean
  disabled?: boolean | ((ctx: DynamicVisibleContext) => boolean)
  // 只读：与 disabled 区分，readonly 显示值但不允许修改，提交仍包含该值
  readonly?: boolean | ((ctx: DynamicVisibleContext) => boolean)
  visible?: boolean | ((ctx: DynamicVisibleContext) => boolean)
  /**
   * 简化显隐语法：当满足对象中所有键值判断时显示。等价于 visible:()=> 条件组合。
   * 支持：
   *  showWhen: { status: 'A' }
   *  showWhen: { type: ['A','B'], level: 2 }
   * 判定规则：
   *  - 若值为数组 => model[prop] 在该数组内
   *  - 否则严格等于
   * 与 visible 同时存在时：二者 AND 关系
   */
  showWhen?: Record<string, any | any[]>
  /** 当 visible 从 true 变为 false 时是否自动清空该字段的值（默认保留） */
  clearWhenHidden?: boolean
  placeholder?: string
  help?: string
  extra?: string | ((ctx: DynamicVisibleContext) => string)
  defaultValue?: any
  col?: number
  rules?: CFormRule[]
  preset?: string | string[]
  validateTrigger?: FormValidateTrigger | FormValidateTrigger[]
  transformIn?: (value: any, model: Record<string, any>) => any
  transformOut?: (value: any, model: Record<string, any>) => any
  asyncOptions?: AsyncOptionsConfig
  // 字典：与 asyncOptions 互斥（若同时提供，以 options/local > dict > async 优先级）
  dict?: string | DictOptionsConfig
  // 当依赖字段变化时，是否清空当前值
  clearOnDependChange?: boolean
  // 交互事件：点击字段（打开选择前）与值变化后回调
  onClick?: (ctx: { field: CFormSchemaField; model: Record<string, any>; value: any }) => void | boolean | Promise<void | boolean>
  onChange?: (ctx: {
    field: CFormSchemaField
    model: Record<string, any>
    value: any
    prev: any
    options?: any[]
    indexes?: number[]
  }) => void | Promise<void>
  // 是否显示“级联快速清空”按钮（仅对 Dict/选择类有意义）
  showCascadeClear?: boolean
}

export type CFormComponentType =
  | 'Input'
  | 'Textarea'
  | 'Number'
  | 'PickerPopout'
  | 'RadioPopout'
  | 'RadioInput'
  | 'Cascader'
  | 'MaterialSelect' // 自定义业务组件：选择物料
  | 'DeviceSelect'   // 自定义业务组件：选择设备（含扫码）
  | 'WorkOrderSelect' // 自定义业务组件：选择加工单
  | 'WorkOrderMultiSelect' // 多选加工单（与单选区分）
  | 'Scan'
  | 'Uploader'
  | 'Image'
  | 'Date'
  | 'DateTime'
  | 'Dict'
  | 'Normal' // 新增：纯展示只读字段
  | 'DispatchPerson'
  | 'CheckboxGroup'

export interface CFormSchemaField extends CFormSchemaFieldBase {
  component?: CFormComponentType | 'GroupTitle'
  /**
   * 组件特定属性：按组件语义约定（并非强类型约束，保持向后兼容）
   * - Dict/选择类：popupProps, clearable, multiple, showSearch...
   * - Scan: { mockValue?: string; appendButtons?: any[]; parseTask?: { enable?: boolean; fieldMap?: Record<string,string>; splitter?: RegExp|string; separators?: string[]; toast?: boolean } }
   * - Uploader: { uploadUrl?: string; uploadRequest?: (file:any, field:CFormSchemaField)=>Promise<any>; beforeChoose?: ()=>Promise<boolean|void>|boolean|void; parseResponse?: (res:any)=>{ url:string; name?:string } }
   * - Normal: { emptyText?: string; copyable?: boolean; lines?: number }
   * - GroupTitle: { 
   *     style?: 'default' | 'card' | 'line'; 
   *     card?: { showBorder?: boolean; showShadow?: boolean; background?: string }; 
   *     customStyle?: Record<string, any>;
   *     showArrow?: boolean;
   *     icon?: string;
   *     wrap?: boolean; // 是否包裹后续字段（卡片模式）
   *     itemCount?: number; // 包裹的字段数量
   *   }
   */
  componentProps?: Record<string, any> | ((ctx: DynamicVisibleContext) => Record<string, any>)
  // 级联：指向子字段 prop 列表，子字段在上一级未选时自动禁用/清空
  cascadeTo?: string[]
  // 选项数据（本地）
  options?: any[] | ((ctx: DynamicVisibleContext) => any[])
}

export interface CFormSchema {
  fields: CFormSchemaField[]
  layout?: 'vertical' | 'inline'
  labelWidth?: string | number
  gutter?: number
  submitText?: string
  submitButtons?: Array<{
    text: string
    type?: string
    theme?: string
    size?: string
    round?: boolean
    ghost?: boolean
    danger?: boolean
    disabled?: boolean | ((ctx: { model: Record<string, any> }) => boolean)
    show?: boolean | ((ctx: { model: Record<string, any> }) => boolean)
    /** 自定义点击回调，若返回 false 则阻断默认提交行为 */
    onTap?: (ctx: { model: Record<string, any>; submit: () => Promise<void>; validate: () => Promise<boolean> }) => void | Promise<void | boolean | undefined | false>
    /** 额外 payload：追加到默认提交参数中（浅合并） */
    payload?: Record<string, any> | ((model: Record<string, any>) => Record<string, any>)
    /** 按钮键值：外部可通过 schema 修改状态 */
    key?: string
  }>
  showReset?: boolean
  resetText?: string
  showActions?: boolean
  showErrorBanner?: boolean
  /** 重置按钮行为：默认 reset（清空/还原默认值）；back 则执行上一页返回 */
  resetBehavior?: 'reset' | 'back'
  // 错误展示模式：banner(默认)/inline/toast/first
  /**
   * 错误展示模式：
   * - inline: 行内显示（当前实现占位返回空串，预留扩展）
   * - toast: 首条错误 toast
   * - first: 等同 toast（兼容命名）
   * - banner: (已废弃) 之前顶部汇总条，现已移除，仅保留类型兼容
   */
  errorDisplay?: 'banner' | 'inline' | 'toast' | 'first'
  // 全局只读（不破坏字段 disabled），字段级 readonly 覆盖优先
  readonly?: boolean
  // 预留差异化提交（后续阶段实现）
  diffSubmit?: boolean
  // 简化的钩子（阶段一）
  hooks?: {
    beforeValidate?: (model: Record<string, any>) => Promise<boolean | void> | boolean | void
    beforeSubmit?: (params: { model: Record<string, any>; diff: Record<string, any>; all: Record<string, any> }) => Promise<boolean | void> | boolean | void
    afterValidate?: (result: { ok: boolean; errors: ValidateErrorItem[] }) => void | Promise<void>
  }
}

export interface ValidateErrorItem {
  prop: string
  message: string
}

export interface CFormExpose {
  validate: (props?: string[]) => Promise<boolean>
  // 新增：返回详细错误结构（不中断兼容）
  validateDetail: (props?: string[]) => Promise<{ ok: boolean; errors: ValidateErrorItem[] }>
  getValues: () => Record<string, any>
  refreshOptions: (props?: string[]) => Promise<void>
  reset: (props?: string[]) => void
  clearValidate: (props?: string[]) => void
  setValue: (prop: string, value: any) => void
  getFieldState: (prop: string) => { value: any; errors: string[] }
  clearCascade: (rootProp: string, includeRoot?: boolean) => string[]
}

export interface InternalFieldState {
  value: any
  errors: string[]
  validating: boolean
  touched: boolean
}

export type CFormInstance = Ref<CFormExpose | undefined>
