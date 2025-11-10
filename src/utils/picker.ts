// 工单选择统一 Promise 接口 (token 方案)
// @ts-nocheck

export interface WorkOrderPickResult {
  workOrder: string
  processName?: string
  processCode?: string
  batchNumber?: string
  materialsCode?: string
  materialsName?: string
  specifications?: string
  projectNumber?: string
  segmentNumber?: string
  equipName?: string
  equipId?: string
}

interface PickOptions {
  initial?: string
  timeoutMs?: number
  multiple?: boolean // 是否多选
}

export const WORK_ORDER_PICK_RESULT_CACHE_KEY = "WORK_ORDER_PICK_RESULT";

function genToken(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8)
}

// 多选时返回数组，单选返回对象
export function pickWorkOrder(options: PickOptions = {}): Promise<WorkOrderPickResult | WorkOrderPickResult[] | null> {
  const token = genToken()
  const initial = options.initial ? encodeURIComponent(options.initial) : ''
  const timeoutMs = options.timeoutMs ?? 15000
  const multiple = options.multiple ? 1 : 0
  let resolved = false
  let timer: any = null
  let interval: any = null

  const safeResolve = (val: any) => {
    if (resolved) return
    resolved = true
    if (timer) clearTimeout(timer)
    if (interval) clearInterval(interval)
    try { uni.removeStorageSync('PICK_RESULT_' + token) } catch {}
    resolveFn(val)
  }

  let resolveFn: (v: WorkOrderPickResult | WorkOrderPickResult[] | null)=>void
  const p = new Promise<WorkOrderPickResult | WorkOrderPickResult[] | null>((resolve)=>{
    resolveFn = resolve
    uni.navigateTo({
      url: `/pages/workOrderPicker/index?token=${token}${initial?`&initial=${initial}`:''}&multiple=${multiple}`,
      success(res){
        try {
          const ec = res.eventChannel
          ec.on && ec.on('workOrderPicked', (data:any)=>{
            if (data?.token === token) safeResolve(data.payload || null)
          })
          ec.on && ec.on('workOrderCancel', (data:any)=>{
            if (data?.token === token) safeResolve(null)
          })
        } catch {}
      },
      fail(err){
        try {
          const msg = (err && (err.errMsg || err.message)) ? `无法打开选择页: ${err.errMsg || err.message}` : '无法打开选择页'
          uni.showToast({ title: msg, icon: 'none' })
          // 控制台输出更完整的错误对象，方便排查
          // @ts-ignore
          console.warn('[pickWorkOrder] navigateTo fail', err)
        } catch {}
        safeResolve(null)
      }
    })

    // timeout 兜底
    timer = setTimeout(()=> safeResolve(null), timeoutMs)
    // storage 轮询兜底（不同端 eventChannel 可能未触达）
    interval = setInterval(()=>{
      if (resolved) return
      try {
        const cached = uni.getStorageSync('PICK_RESULT_' + token)
        if (typeof cached === 'undefined') return
        if (cached && typeof cached === 'object' && cached.__cancel__) {
          safeResolve(null)
        } else if (cached !== undefined) {
          safeResolve(cached)
        }
      } catch {}
    }, 400)
  })
  return p
}
