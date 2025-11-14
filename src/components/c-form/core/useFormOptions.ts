/**
 * CForm选项管理Hook
 *
 * 负责处理表单字段的选项加载和缓存，包括：
 * - 字典选项加载（dict）
 * - 异步选项加载（asyncOptions）
 * - 选项缓存管理
 * - 初始化选项加载
 *
 * 职责：
 * - 管理异步选项缓存（asyncOptionCache）
 * - 加载字典选项（loadDict）
 * - 加载异步选项（loadAsyncOptions）
 * - 初始化immediate选项加载
 * - 处理编辑场景的lazy选项回显
 * - 提供选项刷新接口（refreshOptions）
 *
 * 性能优化：
 * - 支持选项缓存（session缓存或TTL缓存）
 * - 懒加载支持（lazy选项）
 * - 批量刷新接口
 *
 * @module c-form/core/useFormOptions
 */

import { reactive } from 'vue'
import { fetchDict } from '../dict'
import { getModelValueByProp } from '../utils/fieldHelpers'
import type { CFormSchema, CFormSchemaField, InternalFieldState } from '../types'

/**
 * 选项缓存项
 */
interface OptionCacheItem {
  /** 缓存时间戳 */
  ts: number
  /** 缓存数据 */
  data: any[]
}

/**
 * 选项管理Hook
 *
 * @param props - 组件props（包含schema和modelValue）
 * @param fieldStates - 字段状态存储
 * @param fieldOptionsStore - 字段选项存储（来自useFormState）
 * @param isSlotField - 判断是否为Slot字段的函数
 */
export function useFormOptions(
  props: { schema: CFormSchema; modelValue: Record<string, any> },
  fieldStates: Record<string, InternalFieldState>,
  fieldOptionsStore: Record<string, any[]>,
  isSlotField: (field: CFormSchemaField) => boolean
) {
  /**
   * 异步选项缓存
   * key: field.prop
   * value: { ts: 时间戳, data: 选项数据 }
   */
  const asyncOptionCache: Record<string, OptionCacheItem> = reactive({})

  /**
   * 获取字段选项
   *
   * 若字段的options是函数（动态计算），直接调用，不缓存
   * 否则返回fieldOptionsStore中的选项
   *
   * @param field - 字段配置
   * @returns 选项数组
   */
  function getOptions(field: CFormSchemaField): any[] {
    // 若字段原生 options 是函数（动态计算），直接调用，不缓存
    if (typeof field.options === 'function') {
      try {
        return (
          field.options({
            model: props.modelValue,
            values: props.modelValue,
            field,
          }) || []
        )
      } catch (e) {
        return []
      }
    }
    return fieldOptionsStore[field.prop] || []
  }

  /**
   * 加载异步选项
   *
   * 从API加载选项数据，支持缓存和懒加载
   *
   * @param field - 字段配置
   * @param force - 是否强制刷新（跳过缓存）
   */
  async function loadAsyncOptions(field: CFormSchemaField, force = false): Promise<void> {
    if (!field.asyncOptions) return

    // 懒加载：由字段点击时触发，这里直接返回（除非 force 指定刷新）
    if (field.asyncOptions.lazy && !field.asyncOptions.immediate) {
      if (!force) return
    }

    const {
      api,
      cache,
      transform,
      labelKey = 'label',
      valueKey = 'value',
    } = field.asyncOptions

    // 检查缓存
    const cacheItem = asyncOptionCache[field.prop]
    const now = Date.now()
    if (!force && cache) {
      const ttl = cache === true ? 0 : cache // true 表示 session 缓存（不判断过期）
      if (cacheItem && (ttl === 0 || now - cacheItem.ts < ttl)) {
        fieldOptionsStore[field.prop] = cacheItem.data
        return
      }
    }

    try {
      // 收集依赖字段的值
      const dependValues: Record<string, any> = {}
      field.asyncOptions.dependOn?.forEach((d) => {
        dependValues[d] = fieldStates[d]?.value
      })

      // 调用API
      const raw = await api(dependValues, field)
      let list = transform ? transform(raw) : raw

      // 标准化为 {label,value}
      if (Array.isArray(list) && list.length && typeof list[0] === 'object') {
        list = list.map((it: any) => ({
          label: it[labelKey],
          value: it[valueKey],
          raw: it,
        }))
      }

      // 存储选项
      fieldOptionsStore[field.prop] = list

      // 缓存选项
      if (cache) {
        asyncOptionCache[field.prop] = { ts: now, data: list }
      }
    } catch (e) {
      // 失败不抛出，保持静默
    }
  }

  /**
   * 加载字典选项
   *
   * 从字典服务加载选项数据
   *
   * @param field - 字段配置
   * @param force - 是否强制刷新
   */
  async function loadDict(field: CFormSchemaField, force = false): Promise<void> {
    if (!field.dict) return

    // 规范化字典配置
    let cfg: any =
      typeof field.dict === 'string'
        ? { type: field.dict, immediate: true }
        : field.dict

    const { type, cache, labelKey, valueKey, transform, immediate = true } = cfg

    // 若不是immediate且没有预设options，直接返回
    if (!immediate && !field.options) return

    try {
      const list = await fetchDict(type, {
        cache,
        labelKey,
        valueKey,
        transform,
      })

      // 只在强制刷新或选项为空时更新
      if (force || !fieldOptionsStore[field.prop] || !fieldOptionsStore[field.prop].length) {
        fieldOptionsStore[field.prop] = list
      }
    } catch (e) {
      // 失败静默处理
    }
  }

  /**
   * 初始化选项加载
   *
   * 在组件挂载时执行以下操作：
   * 1. 加载所有immediate的字典和异步选项
   * 2. 对于编辑/查看场景，强制加载lazy字段的选项以便回显
   */
  function initializeOptions(): void {
    // 1. 初始需要 immediate 的字典 / 异步字段加载
    props.schema.fields.forEach((f) => {
      if (isSlotField(f)) return
      if (f.dict) loadDict(f)
      if (f.asyncOptions?.immediate) loadAsyncOptions(f, true)
    })

    // 2. 编辑/查看场景回显：若字段已经有值，但其选项是 lazy（未立即加载），需要强制加载一次以便显示 label
    props.schema.fields.forEach((f) => {
      if (isSlotField(f)) return

      const currentVal = getModelValueByProp(props.modelValue, f.prop)
      if (currentVal !== undefined && currentVal !== null && currentVal !== '') {
        // 异步 lazy 且 immediate 为 false -> 强制拉取一次（force=true 跳过缓存）
        if (f.asyncOptions && (f.asyncOptions.lazy || f.asyncOptions.immediate === false)) {
          loadAsyncOptions(f, true)
        }
        // 字典：若 dict.immediate === false 但已有值，需要加载字典项
        if (f.dict && typeof f.dict === 'object' && f.dict.immediate === false) {
          loadDict(f)
        }
      }
    })
  }

  /**
   * 刷新选项
   *
   * 批量刷新指定字段的选项（字典和异步选项）
   * 若不指定propsList，则刷新所有字段
   *
   * @param propsList - 要刷新的字段prop数组
   */
  async function refreshOptions(propsList?: string[]): Promise<void> {
    const targets = propsList
      ? props.schema.fields.filter((f) => propsList.includes(f.prop))
      : props.schema.fields

    for (const f of targets) {
      if (f.dict) await loadDict(f, true)
      if (f.asyncOptions) await loadAsyncOptions(f, true)
    }
  }

  return {
    asyncOptionCache,
    getOptions,
    loadAsyncOptions,
    loadDict,
    initializeOptions,
    refreshOptions,
  }
}
