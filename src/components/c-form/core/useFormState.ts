/**
 * CForm状态管理Hook
 *
 * 负责表单字段状态的管理、初始化和值操作
 *
 * 注意：当前版本保持与原有reactive结构的兼容性
 * 后续优化：考虑改用Map+Ref减少响应式嵌套
 *
 * @module c-form/core/useFormState
 */

import { reactive } from 'vue'
import { getModelValueByProp, setModelValueByProp } from '../utils/fieldHelpers'
import type { CFormSchema, CFormSchemaField, InternalFieldState } from '../types'

/**
 * 状态管理返回值
 */
export interface FormStateReturn {
  // 状态容器（保持reactive兼容）
  fieldStates: Record<string, InternalFieldState>
  fieldOptionsStore: Record<string, any[]>
  initialSnapshot: Record<string, any>

  // 状态操作
  ensureFieldState: (prop: string) => InternalFieldState
  getValue: (prop: string) => any
  getValues: () => Record<string, any>
  setValue: (prop: string, value: any, emitChange?: boolean) => void
  setFieldValue: (prop: string, value: any) => void
  reset: (propsList?: string[]) => void
  clearFieldValidate: (prop: string) => void
  hasFieldValue: (value: any) => boolean

  // 辅助方法
  isSlotField: (field: CFormSchemaField) => boolean
  shouldWrapSlotField: (field: CFormSchemaField) => boolean
}

/**
 * 表单状态管理Hook
 *
 * @param props - 组件props
 * @param emits - emit函数
 * @param emitModel - 触发modelValue更新的函数
 * @returns 状态管理方法和数据
 */
export function useFormState(
  props: {
    schema: CFormSchema
    modelValue: Record<string, any>
  },
  emits: any,
  emitModel: () => void
): FormStateReturn {
  // 字段状态存储（保持reactive兼容）
  const fieldStates: Record<string, InternalFieldState> = reactive({})

  // 选项存储
  const fieldOptionsStore: Record<string, any[]> = reactive({})

  // 初始快照
  const initialSnapshot: Record<string, any> = {}

  /**
   * 确保字段状态存在
   */
  function ensureFieldState(prop: string): InternalFieldState {
    if (!fieldStates[prop]) {
      fieldStates[prop] = reactive({
        value: undefined,
        errors: [],
        validating: false,
        touched: false,
      }) as InternalFieldState
    }
    return fieldStates[prop]
  }

  /**
   * 判断是否为Slot字段
   */
  function isSlotField(field: CFormSchemaField): boolean {
    return field?.component === 'Slot' || !!(field as any)?.slotName
  }

  /**
   * 判断Slot字段是否需要包装FormItem
   */
  function shouldWrapSlotField(field: CFormSchemaField): boolean {
    if (!isSlotField(field)) return false
    if (field.slotFormItem === true) return true
    if (field.slotFormItem === false) return false
    return typeof field.label === 'string' && field.label.trim().length > 0
  }

  /**
   * 获取字段值
   */
  function getValue(prop: string): any {
    return fieldStates[prop]?.value
  }

  /**
   * 获取所有字段值（应用transformOut）
   */
  function getValues(): Record<string, any> {
    const out: Record<string, any> = {}
    props.schema.fields.forEach((f: any) => {
      if (f.component === 'GroupTitle') return // 标题不返回值

      let v = getValue(f.prop)

      // 应用输出转换
      if (typeof f.transformOut === 'function') {
        v = f.transformOut(v, props.modelValue)
      }

      out[f.prop] = v
    })
    return out
  }

  /**
   * 设置字段值
   */
  function setValue(prop: string, value: any, emitChange = true): void {
    const state = ensureFieldState(prop)
    state.value = value
    setModelValueByProp(props.modelValue, prop, value)

    if (emitChange) {
      emits('change', prop, value)
      emitModel()
    }

    // 有值时清除校验错误
    if (hasFieldValue(value)) {
      clearFieldValidate(prop)
    }
  }

  /**
   * 设置字段值（不触发事件）
   */
  function setFieldValue(prop: string, value: any): void {
    setValue(prop, value, false)
  }

  /**
   * 重置字段值
   */
  function reset(propsList?: string[]): void {
    const targets = propsList
      ? props.schema.fields.filter(f => propsList.includes(f.prop))
      : props.schema.fields

    targets.forEach(f => {
      if (f.component === 'GroupTitle' || isSlotField(f)) return

      const state = ensureFieldState(f.prop)

      // 支持函数形式的defaultValue
      const resolvedDefault =
        f.defaultValue !== undefined
          ? typeof f.defaultValue === 'function'
            ? f.defaultValue({ field: f, model: props.modelValue })
            : f.defaultValue
          : undefined

      state.value = resolvedDefault
      state.errors = []
      setModelValueByProp(props.modelValue, f.prop, resolvedDefault)
    })

    emitModel()
  }

  /**
   * 清除字段校验错误
   */
  function clearFieldValidate(prop: string): void {
    const state = fieldStates[prop]
    if (state) {
      state.errors = []
    }
  }

  /**
   * 判断字段是否有有效值
   */
  function hasFieldValue(value: any): boolean {
    if (value === undefined || value === null) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    return true
  }

  /**
   * 初始化字段状态
   */
  function initializeFieldStates(): void {
    props.schema.fields.forEach((f: any) => {
      if (f.component === 'GroupTitle' || isSlotField(f)) return

      // 初始化选项存储
      fieldOptionsStore[f.prop] = Array.isArray(f.options) ? f.options : []

      // 初始化字段状态
      const state = ensureFieldState(f.prop)
      const currentValue = getModelValueByProp(props.modelValue, f.prop)

      // 确定是否使用默认值
      const shouldUseDefault =
        (currentValue === undefined ||
          currentValue === null ||
          currentValue === '') &&
        f.defaultValue !== undefined

      if (shouldUseDefault) {
        // 支持函数形式的defaultValue
        const resolvedDefault =
          typeof f.defaultValue === 'function'
            ? f.defaultValue({ field: f, model: props.modelValue })
            : f.defaultValue

        // 应用输入转换
        state.value =
          typeof f.transformIn === 'function'
            ? f.transformIn(resolvedDefault, props.modelValue)
            : resolvedDefault

        setModelValueByProp(props.modelValue, f.prop, state.value)
      } else {
        state.value = currentValue
      }

      // 保存初始快照
      initialSnapshot[f.prop] = state.value
    })
  }

  // 自动初始化
  initializeFieldStates()

  return {
    fieldStates,
    fieldOptionsStore,
    initialSnapshot,
    ensureFieldState,
    getValue,
    getValues,
    setValue,
    setFieldValue,
    reset,
    clearFieldValidate,
    hasFieldValue,
    isSlotField,
    shouldWrapSlotField,
  }
}
