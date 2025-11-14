import { minioBaseUrl, imgUrl, requestUrl } from '@/config'

const BASE_CANDIDATES = Array.from(
  new Set([minioBaseUrl, imgUrl, requestUrl].filter((base): base is string => !!base))
).map((base) => base.replace(/\/+$/, ''))

const DEFAULT_PROTOCOL = 'https:'

export function ensurePicturePreviewUrl(entry: any): string {
  if (!entry) return ''
  let raw = ''
  if (typeof entry === 'string') raw = entry
  else if (typeof entry === 'object') {
    raw =
      entry.resultUrl ||
      entry.url ||
      entry.fileUrl ||
      entry.thumb ||
      entry.path ||
      entry.filepath ||
      ''
  }
  if (!raw) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  if (/^(?:data:|blob:|file:|wxfile:|http:\/\/tmp|https:\/\/tmp)/i.test(trimmed)) return trimmed
  if (/^\/(?:_doc|_downloads|_www|storage|private)/i.test(trimmed)) return trimmed
  if (/^\//.test(trimmed)) {
    const base = BASE_CANDIDATES[0]
    return base ? `${base}${trimmed}` : trimmed
  }
  if (/^\/\//.test(trimmed)) return `${DEFAULT_PROTOCOL}${trimmed}`
  if (/^(?:https?:|wss?:|ftp:)/i.test(trimmed)) return trimmed
  const base = BASE_CANDIDATES[0]
  if (!base) return trimmed
  return `${base}/${trimmed.replace(/^\/+/, '')}`
}

function normalizeCandidate(base: string): string {
  const trimmed = base.trim()
  if (!trimmed) return ''
  return trimmed.replace(/\/+$/, '')
}

const STRIP_BASE_CANDIDATES = BASE_CANDIDATES.flatMap((base) => {
  const normalized = normalizeCandidate(base)
  if (!normalized) return []
  if (/^https?:\/\//i.test(normalized)) {
    return [normalized, normalized.replace(/^https?:\/\//i, '')]
  }
  return [normalized]
})

function matchAndStripBase(url: string, base: string): string | null {
  if (!base) return null
  const normalizedBase = normalizeCandidate(base)
  if (!normalizedBase) return null
  const candidates = [normalizedBase]
  if (/^https?:\/\//i.test(normalizedBase)) {
    candidates.push(normalizedBase.replace(/^https?:\/\//i, ''))
  }
  for (const candidate of candidates) {
    if (!candidate) continue
    if (url === candidate) return ''
    if (url.startsWith(`${candidate}/`) || url.startsWith(`${candidate}?`)) {
      return url.slice(candidate.length)
    }
  }
  return null
}

export function stripPictureBaseUrl(raw: any): string {
  if (!raw) return ''
  const value =
    typeof raw === 'string'
      ? raw
      : raw?.originUrl || raw?.url || raw?.resultUrl || raw?.fileUrl || raw?.path || raw?.filepath || ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  const attempts = [trimmed]
  if (/^https?:\/\//i.test(trimmed)) {
    attempts.push(trimmed.replace(/^https?:\/\//i, ''))
  } else if (/^\/\//.test(trimmed)) {
    attempts.push(trimmed.replace(/^\/\//, ''))
  }
  for (const item of attempts) {
    for (const base of STRIP_BASE_CANDIDATES) {
      const stripped = matchAndStripBase(item, base)
      if (stripped !== null) {
        if (!stripped) return ''
        return stripped.startsWith('/') ? stripped : `/${stripped.replace(/^\/+/, '')}`
      }
    }
  }
  return trimmed
}

/**
 * 规范化图片列表数据
 *
 * 处理多种输入格式：
 * - 字符串（逗号或分号分隔）: "url1,url2;url3"
 * - 数组: [url1, url2] 或 [{url: ...}, {src: ...}]
 * - null/undefined
 *
 * @param raw - 原始图片数据
 * @returns 标准化的图片对象数组
 *
 * @example
 * normalizePictureList("img1.jpg,img2.jpg")
 * // [{id:"0",src:"https://...img1.jpg"}, {id:"1",src:"https://...img2.jpg"}]
 *
 * normalizePictureList([{url:"img1.jpg"}, "img2.jpg"])
 * // [{id:"0",src:"https://...img1.jpg"}, {id:"1",src:"https://...img2.jpg"}]
 */
export function normalizePictureList(raw: any): Array<{ id: string; src: string }> {
  if (!raw) return []

  // 转换为数组
  let items: any[] = []
  if (Array.isArray(raw)) {
    items = raw
  } else if (typeof raw === 'string') {
    // 字符串：按逗号或分号分割
    items = String(raw)
      .replace(/,$/, '') // 移除末尾逗号
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean)
  } else if (typeof raw === 'object') {
    // 单个对象，转换为数组
    items = [raw]
  } else {
    return []
  }

  // 提取URL并规范化
  const normalized = items
    .flatMap((item: any) => {
      if (!item) return []

      // 如果是字符串，可能还需要进一步分割
      if (typeof item === 'string') {
        return item
          .split(/[,;]/)
          .map(s => s.trim())
          .filter(Boolean)
      }

      // 如果是对象，提取URL字段
      if (typeof item === 'object') {
        const url = item.url || item.src || item.path || item.resultUrl || item.fileUrl || item.filepath || ''
        return url ? [url] : []
      }

      return [item]
    })
    .map((item, index) => ({
      id: `${index}`,
      src: ensurePicturePreviewUrl(item),
    }))
    .filter(item => !!item.src) // 过滤掉空URL

  return normalized
}

/**
 * 将图片列表序列化为逗号分隔的字符串（用于提交）
 *
 * 从多种输入格式中提取URL并转换为后端期望的逗号分隔字符串
 *
 * @param input - 图片数据（数组或单个值）
 * @returns 逗号分隔的URL字符串
 *
 * @example
 * normalizeImagePathList([{url: "img1.jpg"}, "img2.jpg"])
 * // "img1.jpg,img2.jpg"
 *
 * normalizeImagePathList("img1.jpg")
 * // "img1.jpg"
 *
 * normalizeImagePathList(null)
 * // ""
 */
export function normalizeImagePathList(input: any): string {
  if (!input) return ''

  const list = Array.isArray(input) ? input : [input]

  const urls = list
    .map((item: any) => {
      if (!item) return ''
      if (typeof item === 'string') return item.trim()

      // 提取对象中的URL字段（按优先级）
      return (
        item.url ||
        item.resultUrl ||
        item.originUrl ||
        item.path ||
        item.tempFilePath ||
        item.src ||
        item.fileUrl ||
        item.filepath ||
        (item.response && (item.response.url || item.response.data)) ||
        ''
      )
    })
    .map((url: any) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url: string) => !!url)

  return urls.join(',')
}
