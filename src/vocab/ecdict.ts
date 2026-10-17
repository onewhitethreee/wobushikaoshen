// ECDICT CSV 的解析与整理（013 research R1）。纯函数，scripts/import-dict.ts 和测试共用
import { parseExchange } from './lookup'

const KEY_RE = /^[a-z]+(['-][a-z]+)*$/
const FORM_TYPES = new Set(['p', 'd', 'i', '3', 's', 'r', 't'])

export type Row = { word: string; phonetic: string; translation: string; exchange: string; lemma?: string }

/** 逐行喂入，返回已凑齐的整条记录（引号内可以有逗号、换行，"" 表示一个引号）；没凑齐时返回 null */
export const csvParser = () => {
  let fields: string[] = []
  let cur = ''
  let quoted = false
  return (line: string): string[] | null => {
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (c === '"') quoted = false
        else cur += c
      } else if (c === '"') quoted = true
      else if (c === ',') {
        fields.push(cur)
        cur = ''
      } else cur += c
    }
    if (quoted) {
      cur += '\n'
      return null
    }
    fields.push(cur)
    const out = fields
    fields = []
    cur = ''
    return out
  }
}

/** 由 CSV 记录（含表头映射后）算出要导入的行：小写键、优先原本就是小写的行、补变形 */
export const buildRows = (records: Iterable<Record<string, string>>): { rows: Row[]; forms: number } => {
  const byKey = new Map<string, Row>()
  for (const r of records) {
    const key = r.word?.toLowerCase()
    if (!key || !KEY_RE.test(key) || !r.translation?.trim()) continue
    const old = byKey.get(key)
    if (old && old.word === key) continue // 已有原本就是小写的那行
    byKey.set(key, { word: r.word === key ? key : r.word, phonetic: r.phonetic ?? '', translation: r.translation.trim(), exchange: r.exchange ?? '' })
  }
  const rows = [...byKey.entries()].map(([key, r]) => ({ ...r, word: key }))
  let forms = 0
  for (const r of rows) {
    for (const [t, f] of Object.entries(parseExchange(r.exchange))) {
      const k = f.toLowerCase()
      if (!FORM_TYPES.has(t) || !KEY_RE.test(k) || byKey.has(k)) continue
      byKey.set(k, { word: k, phonetic: '', translation: '', exchange: `0:${r.word}/1:${t}`, lemma: r.word })
      forms++
    }
  }
  return { rows: [...byKey.entries()].map(([key, r]) => ({ ...r, word: key })), forms }
}
