import { reactive } from 'vue'
import type { CFormRule } from './types'

export async function runFieldValidation(value: any, rules: CFormRule[], model: Record<string, any>): Promise<string[]> {
  const errors: string[] = []
  for (const rule of rules) {
    if (rule.required) {
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
      if (empty) {
        errors.push(rule.message || '必填项')
        if (!rule.validator) continue
      }
    }
    if (rule.pattern && value != null && value !== '') {
      if (!rule.pattern.test(String(value))) {
        errors.push(rule.message || '格式不正确')
        continue
      }
    }
    if (rule.type === 'email' && value) {
      const ok = /.+@.+/.test(value)
      if (!ok) {
        errors.push(rule.message || '邮箱格式不正确')
        continue
      }
    }
    if (rule.type === 'mobile' && value) {
      const ok = /^1\d{10}$/.test(value)
      if (!ok) {
        errors.push(rule.message || '手机号格式不正确')
        continue
      }
    }
    if (rule.min != null && typeof value === 'string' && value.length < rule.min) {
      errors.push(rule.message || `长度至少 ${rule.min}`)
      continue
    }
    if (rule.max != null && typeof value === 'string' && value.length > rule.max) {
      errors.push(rule.message || `长度不能超过 ${rule.max}`)
      continue
    }
    if (rule.validator) {
      try {
        const res = await rule.validator(value, rule, model)
        if (!res) errors.push(rule.message || '校验未通过')
      } catch (e:any) {
        errors.push(rule.message || e?.message || '校验异常')
      }
    }
  }
  return errors
}

export function mergeTriggers(rules: CFormRule[], extra?: string | string[]) {
  const arr = Array.isArray(extra) ? extra : extra ? [extra] : []
  rules.forEach(r => {
    if (!r.trigger) return
    if (Array.isArray(r.trigger)) arr.push(...r.trigger)
    else arr.push(r.trigger)
  })
  return Array.from(new Set(arr))
}
