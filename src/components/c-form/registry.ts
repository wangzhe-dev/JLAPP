import { reactive } from 'vue'
import type { CFormSchemaField } from './types'

export type FieldRenderer = (field: CFormSchemaField, ctx: { setValue: (prop:string,v:any)=>void; getValue:(prop:string)=>any }) => any

const componentMap: Record<string, FieldRenderer> = reactive({})

export function registerFormComponent(name: string, renderer: FieldRenderer) {
  componentMap[name] = renderer
}

export function getFormComponent(name: string) {
  return componentMap[name]
}

export function listRegisteredComponents() {
  return Object.keys(componentMap)
}
