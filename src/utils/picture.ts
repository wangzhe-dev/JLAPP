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
