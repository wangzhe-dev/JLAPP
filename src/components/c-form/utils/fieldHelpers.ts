/**
 * CForm字段辅助工具函数
 *
 * 纯函数集合，用于处理字段路径、模型值访问等
 *
 * @module c-form/utils/fieldHelpers
 */

import type { CFormSchemaField } from '../types'

/**
 * 分割属性路径为数组
 *
 * @param prop - 属性路径，支持点号分隔
 * @returns 路径片段数组
 *
 * @example
 * splitPropPath("user.profile.name") // ["user", "profile", "name"]
 * splitPropPath("age") // ["age"]
 * splitPropPath("") // []
 */
export function splitPropPath(prop?: string): string[] {
  if (!prop) return []
  return prop
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
}

/**
 * 根据属性路径获取模型值
 *
 * 支持嵌套路径访问，如 "user.profile.name"
 *
 * @param model - 数据模型对象
 * @param prop - 属性路径
 * @returns 对应的值，如果路径不存在返回undefined
 *
 * @example
 * const model = { user: { profile: { name: "张三" } } }
 * getModelValueByProp(model, "user.profile.name") // "张三"
 * getModelValueByProp(model, "user.age") // undefined
 */
export function getModelValueByProp(
  model: Record<string, any>,
  prop?: string
): any {
  if (!model || !prop) return undefined
  const segments = splitPropPath(prop)
  if (!segments.length) return undefined

  return segments.reduce((acc: any, key) => {
    if (acc === undefined || acc === null) return undefined
    return acc[key]
  }, model)
}

/**
 * 确保模型路径存在
 *
 * 自动创建中间对象，确保路径可以被赋值
 *
 * @param model - 数据模型对象
 * @param segments - 路径片段数组
 * @returns 最终的父对象
 *
 * @example
 * const model = {}
 * ensureModelPath(model, ["user", "profile", "name"])
 * // model 变为 { user: { profile: {} } }
 */
export function ensureModelPath(
  model: Record<string, any>,
  segments: string[]
): Record<string, any> {
  let cursor = model
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]
    const next = cursor[key]
    if (typeof next !== 'object' || next === null) {
      cursor[key] = {}
    }
    cursor = cursor[key]
  }
  return cursor
}

/**
 * 根据属性路径设置模型值
 *
 * 支持嵌套路径赋值，自动创建中间对象
 *
 * @param model - 数据模型对象
 * @param prop - 属性路径
 * @param value - 要设置的值
 *
 * @example
 * const model = {}
 * setModelValueByProp(model, "user.profile.name", "张三")
 * // model 变为 { user: { profile: { name: "张三" } } }
 */
export function setModelValueByProp(
  model: Record<string, any>,
  prop: string,
  value: any
): void {
  if (!model || !prop) return
  const segments = splitPropPath(prop)
  if (!segments.length) return

  const parent = ensureModelPath(model, segments)
  parent[segments[segments.length - 1]] = value
}

/**
 * 解析字段名称
 *
 * 将字段属性路径转换为表单组件需要的name格式
 *
 * @param field - 字段配置
 * @returns 字段名称（字符串或数组）
 *
 * @example
 * resolveFieldName({ prop: "name" }) // "name"
 * resolveFieldName({ prop: "user.profile.name" }) // ["user", "profile", "name"]
 */
export function resolveFieldName(
  field: CFormSchemaField
): string | string[] | undefined {
  if (!field?.prop) return field?.prop
  const segments = splitPropPath(field.prop)
  if (!segments.length) return field.prop
  return segments.length > 1 ? segments : field.prop
}
