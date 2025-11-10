import type { BuiltinPresetFactory, CFormRule } from './types'

const emailPattern = /^(?:[a-zA-Z0-9_'^&/+-])+(?:\.(?:[a-zA-Z0-9_'^&/+-])+)*@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/
const mobilePattern = /^1\d{10}$/
const idcardPattern = /(^\d{15}$)|(^\d{17}[\dXx]$)/

export const builtinPresets: Record<string, BuiltinPresetFactory | CFormRule | CFormRule[]> = {
  required: () => ({ required: true, message: '必填项不能为空' }),
  mobile: () => ({ pattern: mobilePattern, message: '手机号格式不正确' }),
  email: () => ({ pattern: emailPattern, message: '邮箱格式不正确' }),
  idcard: () => ({ pattern: idcardPattern, message: '身份证格式不正确' }),
  positiveInt: () => ({ pattern: /^[1-9]\d*$/, message: '请输入正整数' }),
  nonNegative: () => ({ pattern: /^(0|[1-9]\d*)(\.\d+)?$/, message: '请输入非负数字' }),
  amount: () => ({ pattern: /^(0|[1-9]\d*)(\.\d{1,2})?$/, message: '金额格式最多两位小数' })
}

export function resolvePresets(preset: string | string[] | undefined, ctx: any): CFormRule[] {
  if (!preset) return []
  const names = Array.isArray(preset) ? preset : [preset]
  const rules: CFormRule[] = []
  names.forEach(name => {
    const item = builtinPresets[name]
    if (!item) return
    if (typeof item === 'function') {
      const produced = (item as BuiltinPresetFactory)(ctx)
      if (Array.isArray(produced)) rules.push(...produced)
      else rules.push(produced)
    } else if (Array.isArray(item)) rules.push(...item)
    else rules.push(item)
  })
  return rules
}
