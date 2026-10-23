// 029 上传请求检查（research R3、R6）：只做本接口独有的限制，单元本身的校验交给 importPackage()（validateUnit）

export const MAX_UNITS = 10
export const MAX_BODY = 20 * 1024 * 1024
export const MAX_IMAGE = 2 * 1024 * 1024
export const API_TAG = '每日精选'
export const DEFAULT_SETS = '内容接口'
const SOURCE_TYPES = ['ai_rewrite', 'ai_generated']
// 系统算 / 站长另跑 / 由接口决定的字段：调用方传了也忽略
const IGNORED = ['summary', 'pendingCount', 'paraphrases', 'paraphraseChecked', 'viaApi', '_status', 'id', 'createdAt', 'updatedAt']

type Item = Record<string, unknown>

const at = (i: number, item: Item) => `第 ${i + 1} 项${typeof item.sourceId === 'string' && item.sourceId ? `（${item.sourceId}）` : ''}`

export const checkRequest = (body: unknown): { errors: string[]; publish: boolean; items: Item[]; files: unknown } => {
  const errors: string[] = []
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: ['请求体必须是 JSON 对象 { publish, data, files }'], publish: false, items: [], files: undefined }
  const { publish, data, files } = body as { publish?: unknown; data?: unknown; files?: unknown }
  if (publish !== undefined && typeof publish !== 'boolean') errors.push('publish 必须是 true 或 false')
  if (!Array.isArray(data) || !data.length) return { errors: [...errors, 'data 必须是非空数组（1–10 个阅读单元）'], publish: false, items: [], files }
  if (data.length > MAX_UNITS) errors.push(`一次最多上传 ${MAX_UNITS} 个单元，本次 ${data.length} 个，请分批`)

  const items = data.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`第 ${i + 1} 项：必须是对象`)
      return {}
    }
    const item = { ...(raw as Item) }
    const where = at(i, item)
    if (item.module !== 'reading') errors.push(`${where}：module 只能是 reading`)
    if (!SOURCE_TYPES.includes(item.sourceType as string)) errors.push(`${where}：sourceType 只能是 ai_rewrite（改写自原文）或 ai_generated（AI 原创）`)
    if (!item.sourceUrl) errors.push(`${where}：缺少原文链接 sourceUrl`)
    else if (typeof item.sourceUrl !== 'string' || !/^https?:\/\/\S+$/i.test(item.sourceUrl)) errors.push(`${where}：原文链接 sourceUrl 必须是 http:// 或 https:// 开头的网址`)
    for (const k of IGNORED) delete item[k]
    item.viaApi = true
    item.sourceTag = API_TAG
    if (typeof item.sourceSets !== 'string' || !item.sourceSets.trim()) item.sourceSets = DEFAULT_SETS
    return item
  })
  return { errors, publish: publish === true, items, files }
}

const NAME = /^[A-Za-z0-9_.-]{1,80}\.(png|jpe?g|webp)$/i
const sniff = (b: Buffer): 'png' | 'jpg' | 'webp' | null => {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

/** files: [{ name, data(base64，可带 data: 前缀) }] → 文件名 → 内容 */
export const decodeFiles = (files: unknown): { errors: string[]; files: Map<string, { data: Buffer; size: number }> } => {
  const errors: string[] = []
  const out = new Map<string, { data: Buffer; size: number }>()
  if (files === undefined || files === null) return { errors, files: out }
  if (!Array.isArray(files)) return { errors: ['files 必须是数组 [{ name, data }]'], files: out }
  files.forEach((f, i) => {
    const where = `files 第 ${i + 1} 个`
    const { name, data } = (f ?? {}) as { name?: unknown; data?: unknown }
    if (typeof name !== 'string' || !NAME.test(name)) {
      errors.push(`${where}：文件名「${String(name)}」不合规（只能用字母、数字、_ . -，扩展名 png / jpg / jpeg / webp）`)
      return
    }
    if (out.has(name)) return errors.push(`${where}：文件名 ${name} 重复`)
    const b64 = typeof data === 'string' ? data.replace(/^data:[^,]*;base64,/, '').replace(/\s+/g, '') : ''
    if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return errors.push(`${where}（${name}）：data 不是合法的 base64`)
    const buf = Buffer.from(b64, 'base64')
    if (buf.length > MAX_IMAGE) return errors.push(`${where}（${name}）：图片超过 2 MB`)
    const ext = name.split('.').pop()!.toLowerCase().replace('jpeg', 'jpg')
    const kind = sniff(buf)
    if (kind !== ext) return errors.push(`${where}（${name}）：文件内容${kind ? `是 ${kind}` : '不是 png / jpg / webp 图片'}，与扩展名不符`)
    out.set(name, { data: buf, size: buf.length })
  })
  return { errors, files: out }
}
