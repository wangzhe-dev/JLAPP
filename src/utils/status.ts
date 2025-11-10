/*
 * @Author: wangzhe 1320100598@qq.com
 * @Date: 2025-10-16 17:10:47
 * @LastEditors: wangzhe 1320100598@qq.com
 * @LastEditTime: 2025-10-20 09:57:44
 * @FilePath: /NEWAPP/src/utils/status.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
export function resolveStatusState(statusText: string, rawStatus?: string | number) {
  const text = (statusText || '').toLowerCase()
  const codeNum = Number(rawStatus)
  if (!Number.isNaN(codeNum)) {
    // if (codeNum >= 4) return 'done'
    if ([0, 1].includes(codeNum)) return 'pending'
    if ([2, 3].includes(codeNum)) return 'processing'
    if ([4].includes(codeNum)) return 'fail'
    if ([6].includes(codeNum)) return 'cancel'
    if (codeNum < 0) return 'warning'
  }
  if (!text) return ''
  if (/完成|解决|关闭|已办|已处理|done|resolved|closed/.test(text)) return 'done'
  if (/通过|合格|pass|success|ok/.test(text)) return 'success'
  if (/待|未|处理中|processing|排队|待处理/.test(text)) return 'pending'
  if (/转单|审核|审批|排程|warning/.test(text)) return 'warning'
  if (/取消|已撤销|cancel/.test(text)) return 'cancel'
  if (/拒绝|驳回|失败|异常|fault|error|终止|fail/.test(text)) return 'fail'
  return ''
}
