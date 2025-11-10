/**
 * CForm Watch批处理Hook
 *
 * 负责批量处理字段变化监听，替代原有的per-field watch
 * 将200+个watch实例优化为2-3个批量watch
 *
 * 职责：
 * - 构建字段依赖图
 * - 批量监听级联变化（cascadeTo）
 * - 批量监听异步选项依赖（asyncOptions.dependOn）
 * - 批量监听可见性变化（visible + clearWhenHidden）
 *
 * 性能优化：
 * - 从200+个watch → 2-3个watch
 * - 减少响应式追踪开销
 * - 提升初始化速度
 *
 * @module c-form/core/useFormWatch
 */

import { watch } from 'vue'
import type { CFormSchema, CFormSchemaField, InternalFieldState } from '../types'

/**
 * 依赖关系类型
 */
interface DependencyRelation {
  /** 源字段prop */
  source: string
  /** 目标字段prop */
  target: string
  /** 依赖类型: cascade=级联, asyncOptions=异步选项依赖 */
  type: 'cascade' | 'asyncOptions'
  /** 是否在依赖变化时清空目标字段 */
  clearOnChange: boolean
}

/**
 * 可见性监听字段
 */
interface VisibilityField {
  /** 字段prop */
  prop: string
  /** 字段配置 */
  field: CFormSchemaField
  /** 是否清空隐藏字段 */
  clearWhenHidden: boolean
}

/**
 * Watch批处理Hook
 *
 * @param schema - 表单schema
 * @param fieldStates - 字段状态存储
 * @param setValue - 设置字段值的函数
 * @param loadAsyncOptions - 加载异步选项的函数
 * @param isFieldVisible - 判断字段是否可见的函数
 * @param isSlotField - 判断是否为Slot字段的函数
 */
export function useFormWatch(
  schema: CFormSchema,
  fieldStates: Record<string, InternalFieldState>,
  setValue: (prop: string, value: any) => void,
  loadAsyncOptions: (field: CFormSchemaField) => Promise<void>,
  isFieldVisible: (field: CFormSchemaField) => boolean,
  isSlotField: (field: CFormSchemaField) => boolean
) {
  /**
   * 构建依赖图
   *
   * 分析schema.fields，构建字段之间的依赖关系
   *
   * @returns 依赖关系数组
   */
  function buildDependencyGraph(): DependencyRelation[] {
    const relations: DependencyRelation[] = []

    schema.fields.forEach((field) => {
      if (isSlotField(field)) return
      if (!field.prop) return

      // 1. 级联依赖 (cascadeTo)
      if (field.cascadeTo?.length) {
        field.cascadeTo.forEach((targetProp) => {
          relations.push({
            source: field.prop!,
            target: targetProp,
            type: 'cascade',
            clearOnChange: true, // 级联总是清空子字段
          })
        })
      }

      // 2. 异步选项依赖 (asyncOptions.dependOn)
      if (field.asyncOptions?.dependOn?.length) {
        field.asyncOptions.dependOn.forEach((sourceProp) => {
          relations.push({
            source: sourceProp,
            target: field.prop!,
            type: 'asyncOptions',
            clearOnChange: !!field.clearOnDependChange,
          })
        })
      }
    })

    return relations
  }

  /**
   * 收集需要监听可见性的字段
   *
   * @returns 可见性字段数组
   */
  function collectVisibilityFields(): VisibilityField[] {
    const fields: VisibilityField[] = []

    schema.fields.forEach((field) => {
      if (isSlotField(field)) return
      if (!field.prop) return

      // 有visible配置或clearWhenHidden的字段需要监听
      if (field.visible || field.clearWhenHidden) {
        fields.push({
          prop: field.prop,
          field,
          clearWhenHidden: !!field.clearWhenHidden,
        })
      }
    })

    return fields
  }

  /**
   * 处理字段值变化
   *
   * 根据依赖图处理级联和异步选项依赖
   *
   * @param changedProp - 变化的字段prop
   * @param newVal - 新值
   * @param oldVal - 旧值
   * @param relations - 依赖关系数组
   */
  async function handleFieldChange(
    changedProp: string,
    newVal: any,
    oldVal: any,
    relations: DependencyRelation[]
  ) {
    // 跳过初始化时的undefined → value变化
    if (oldVal === undefined) return
    // 跳过相同值
    if (newVal === oldVal) return

    // 查找所有依赖当前字段的关系
    const affectedRelations = relations.filter((r) => r.source === changedProp)

    if (affectedRelations.length === 0) return

    // 按类型分组处理
    const cascadeTargets: string[] = []
    const asyncTargets: CFormSchemaField[] = []

    affectedRelations.forEach((relation) => {
      const targetField = schema.fields.find((f) => f.prop === relation.target)
      if (!targetField) return

      if (relation.type === 'cascade') {
        // 级联：清空子字段 + 加载选项
        cascadeTargets.push(relation.target)
        if (relation.clearOnChange) {
          setValue(relation.target, undefined)
        }
        asyncTargets.push(targetField)
      } else if (relation.type === 'asyncOptions') {
        // 异步选项：可选清空 + 加载选项
        if (relation.clearOnChange) {
          setValue(relation.target, undefined)
        }
        asyncTargets.push(targetField)
      }
    })

    // 批量加载异步选项（并行）
    if (asyncTargets.length > 0) {
      await Promise.all(asyncTargets.map((field) => loadAsyncOptions(field)))
    }
  }

  /**
   * 处理可见性变化
   *
   * @param field - 可见性字段
   * @param visible - 当前可见性
   * @param prevVisible - 之前可见性
   */
  function handleVisibilityChange(field: VisibilityField, visible: boolean, prevVisible: boolean) {
    // 从可见变为不可见，且配置了clearWhenHidden
    if (prevVisible === true && visible === false && field.clearWhenHidden) {
      setValue(field.prop, undefined)
    }
  }

  // ========== 批量Watch设置 ==========

  const dependencyGraph = buildDependencyGraph()
  const visibilityFields = collectVisibilityFields()

  // Watch 1: 批量监听字段值变化（级联 + 异步选项依赖）
  if (dependencyGraph.length > 0) {
    // 收集所有需要监听的源字段
    const sourcePropSet = new Set(dependencyGraph.map((r) => r.source))
    const sourceProps = Array.from(sourcePropSet)

    // 单个watch监听所有源字段
    watch(
      () => {
        const values: Record<string, any> = {}
        sourceProps.forEach((prop) => {
          values[prop] = fieldStates[prop]?.value
        })
        return values
      },
      (newVals, oldVals) => {
        // 检测变化并批量处理
        sourceProps.forEach((prop) => {
          const newVal = newVals[prop]
          const oldVal = oldVals?.[prop]
          if (newVal !== oldVal) {
            handleFieldChange(prop, newVal, oldVal, dependencyGraph)
          }
        })
      }
    )
  }

  // Watch 2: 批量监听可见性变化
  if (visibilityFields.length > 0) {
    watch(
      () => visibilityFields.map((f) => isFieldVisible(f.field)),
      (newVisibles, oldVisibles) => {
        visibilityFields.forEach((field, index) => {
          const visible = newVisibles[index]
          const prevVisible = oldVisibles?.[index]
          if (visible !== prevVisible) {
            handleVisibilityChange(field, visible, prevVisible)
          }
        })
      }
    )
  }

  // 返回依赖图和字段信息（供调试）
  return {
    dependencyGraph,
    visibilityFields,
    stats: {
      totalDependencies: dependencyGraph.length,
      totalVisibilityFields: visibilityFields.length,
      watchCount: (dependencyGraph.length > 0 ? 1 : 0) + (visibilityFields.length > 0 ? 1 : 0),
    },
  }
}
