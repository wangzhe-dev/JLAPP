import { http } from '@/utils/request'
import { EP } from './endpoints'

// 批量查询字典：传入字符串数组
// 注意：全局 http 封装已自动返回 envelope.data，这里直接就是 { code1: [...], code2: [...] }
export async function queryDictList(codes: string[]): Promise<Record<string, any[]>> {
  try {
    const mapping: any = await http.post(EP.DICT_LIST, codes)
    return (mapping && typeof mapping === 'object') ? mapping : {}
  } catch (e) {
    console.warn('[dict] queryDictList error', e)
    return {}
  }
}
