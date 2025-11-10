/**
 * CForm验证逻辑Hook
 *
 * 负责表单验证、错误聚合、错误显示和滚动定位
 *
 * 职责：
 * - 执行表单验证（调用formRef.validate）
 * - 聚合多种格式的验证错误
 * - 显示验证错误（toast/first模式）
 * - 滚动到第一个错误字段
 * - 清除验证错误
 *
 * @module c-form/core/useFormValidation
 */

import type { Ref } from 'vue'
import type { CFormSchema, CFormSchemaField, InternalFieldState, ValidateErrorItem } from '../types'
import { resolveFieldName } from '../utils/fieldHelpers'

/**
 * 验证返回值
 */
export interface FormValidationReturn {
  validate: (propsList?: string[]) => Promise<boolean>
  validateDetail: (propsList?: string[]) => Promise<{ ok: boolean; errors: ValidateErrorItem[] }>
  clearValidate: (propsList?: string[]) => void
}

/**
 * 表单验证Hook
 *
 * @param props - 组件props
 * @param formRef - 表单ref引用
 * @param fieldStates - 字段状态存储
 * @param emits - emit函数
 * @returns 验证方法
 */
export function useFormValidation(
  props: {
    schema: CFormSchema
    modelValue: Record<string, any>
  },
  formRef: Ref<any>,
  fieldStates: Record<string, InternalFieldState>,
  emits: any
): FormValidationReturn {
  /**
   * 聚合验证错误
   *
   * 处理3种不同的错误格式：
   * 1. 数组格式: [{name, message}, ...]
   * 2. errors字段格式: {errors: [...]}
   * 3. 对象格式: {prop1: message1, prop2: message2}
   *
   * @param err - 原始错误对象
   * @returns 标准化的错误数组
   */
  function aggregateErrors(err: any): ValidateErrorItem[] {
    if (!err) return []

    // 格式1: 数组格式
    if (Array.isArray(err)) {
      return err
        .map((e: any) => ({
          prop: e.name || e.field || e.prop,
          message: e.message || e.msg || '校验失败',
        }))
        .filter((e) => e.prop)
    }

    // 格式2: errors字段格式
    if (err?.errors && Array.isArray(err.errors)) {
      return err.errors.map((e: any) => ({
        prop: e.name || e.field || e.prop,
        message: e.message || e.msg || '校验失败',
      }))
    }

    // 格式3: 对象格式
    if (err && typeof err === 'object') {
      return Object.keys(err).map((k) => ({
        prop: k,
        message: (err as any)[k],
      }))
    }

    return []
  }

  /**
   * 显示验证错误
   *
   * 根据errorDisplay模式显示错误：
   * - toast/first: 显示第一个错误
   * - inline: 不显示toast（由字段自己显示）
   * - banner: 已废弃，不处理
   *
   * @param errors - 错误列表
   * @param mode - 错误显示模式
   */
  function showValidationError(errors: ValidateErrorItem[], mode?: string) {
    if (!errors.length) return

    // toast/first模式：显示第一个错误
    if (mode === 'toast' || mode === 'first') {
      uni.showToast({ title: errors[0].message, icon: 'none' })
    }

    // inline模式：不显示toast
    // banner模式：已废弃，不处理
  }

  /**
   * 滚动到错误字段
   *
   * 使用uni.createSelectorQuery定位到第一个错误字段并滚动
   *
   * @param propPath - 字段属性路径
   */
  function scrollToError(propPath: string) {
    if (!propPath) return

    const id = `#cform-item-${propPath}`
    try {
      uni
        .createSelectorQuery()
        .select(id)
        .boundingClientRect((rect) => {
          if (rect) {
            uni.pageScrollTo({
              duration: 200,
              scrollTop: rect.top + (rect.top > 60 ? rect.top - 60 : 0),
            })
          }
        })
        .exec()
    } catch (e) {
      // 静默失败
    }
  }

  /**
   * 详细验证（返回错误列表）
   *
   * @param propsList - 可选的字段列表，只验证这些字段
   * @returns 验证结果和错误列表
   */
  async function validateDetail(propsList?: string[]): Promise<{ ok: boolean; errors: ValidateErrorItem[] }> {
    // 1. 执行beforeValidate hook
    if (props.schema.hooks?.beforeValidate) {
      const pass = await props.schema.hooks.beforeValidate(props.modelValue)
      if (pass === false) return { ok: false, errors: [] }
    }

    // 2. 执行表单验证
    let ok = true
    let errorsAgg: ValidateErrorItem[] = []

    try {
      await formRef.value?.validate()
    } catch (err: any) {
      ok = false
      errorsAgg = aggregateErrors(err)
    }

    // 3. 过滤指定字段的错误
    if (propsList?.length) {
      errorsAgg = errorsAgg.filter((e) => propsList.includes(e.prop))
      ok = errorsAgg.length === 0
    }

    // 4. 显示错误
    if (!ok) {
      showValidationError(errorsAgg, props.schema.errorDisplay)

      // 5. 滚动到第一个错误（如果未禁用）
      if (props.schema.scrollToFirstError === false && errorsAgg.length) {
        scrollToError(errorsAgg[0].prop)
      }
    }

    // 6. 触发validated事件
    emits('validated', ok)

    // 7. 执行afterValidate hook
    if (props.schema.hooks?.afterValidate) {
      try {
        await props.schema.hooks.afterValidate({ ok, errors: errorsAgg })
      } catch (e) {
        // 静默失败
      }
    }

    return { ok, errors: errorsAgg }
  }

  /**
   * 简单验证（只返回布尔值）
   *
   * @param propsList - 可选的字段列表
   * @returns 验证是否通过
   */
  async function validate(propsList?: string[]): Promise<boolean> {
    return (await validateDetail(propsList)).ok
  }

  /**
   * 清除验证错误
   *
   * @param propsList - 可选的字段列表，只清除这些字段的错误
   */
  function clearValidate(propsList?: string[]) {
    // 清除formRef的验证错误
    if (Array.isArray(propsList) && propsList.length) {
      const targets = propsList
        .map((prop) => {
          const field = props.schema.fields.find((f) => f.prop === prop)
          if (!field) return undefined
          return resolveFieldName(field)
        })
        .filter(Boolean)
      if (targets.length) formRef.value?.clearValidate?.(targets as any)
    } else {
      formRef.value?.clearValidate?.()
    }

    // 清除fieldStates的错误
    if (!propsList || !propsList.length) {
      Object.values(fieldStates).forEach((st) => {
        if (st) st.errors = []
      })
      return
    }

    propsList.forEach((prop) => {
      const st = fieldStates[prop]
      if (st) st.errors = []
    })
  }

  return {
    validate,
    validateDetail,
    clearValidate,
  }
}
