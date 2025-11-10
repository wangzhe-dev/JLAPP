// 字典缓存与加载封装
// 约定：后端接口: GET /szg-admin/api/app/dictdata/type/:type （示例，根据实际再调整）
// 返回形态假设：{ code:200, data:[{ label:'', value:'', ...}] } 或 数组
// 统一标准化 => { label,value,raw }

import http from '@/utils/request'

interface RawDictItem { [k:string]:any }
interface DictCacheItem { ts:number; data:any[] }

const dictCache: Record<string, DictCacheItem> = {}

export async function fetchDict(type: string, cfg?: { cache?: boolean|number; labelKey?:string; valueKey?:string; transform?: (raw:any[])=>any[] }) {
  const now = Date.now()
  const cacheKey = type
  const cacheOpt = cfg?.cache
  if (cacheOpt) {
    const existed = dictCache[cacheKey]
    const ttl = cacheOpt === true ? 0 : cacheOpt
    if (existed && (ttl === 0 || now - existed.ts < ttl)) return existed.data
  }
  try {
    const resp:any = await http.get(`/szg-admin/api/app/dictdata/type/${type}`)
    let list: any[] = Array.isArray(resp) ? resp : (resp?.data || [])
    if (cfg?.transform) list = cfg.transform(list)
    const labelKey = cfg?.labelKey || guessLabelKey(list[0])
    const valueKey = cfg?.valueKey || guessValueKey(list[0])
    const std = list.map(it=> ({ label: it?.[labelKey], value: it?.[valueKey], raw: it }))
    if (cacheOpt) dictCache[cacheKey] = { ts: now, data: std }
    return std
  } catch (e) {
    return []
  }
}

function guessLabelKey(item:any){
  if(!item) return 'label'
  const cand = ['label','name','text','title','desc']
  return cand.find(k=> k in item) || Object.keys(item)[0] || 'label'
}
function guessValueKey(item:any){
  if(!item) return 'value'
  const cand = ['value','id','code','key']
  return cand.find(k=> k in item) || Object.keys(item)[0] || 'value'
}

export function clearDictCache(type?:string){
  if (type) delete dictCache[type]; else Object.keys(dictCache).forEach(k=> delete dictCache[k])
}
