// 同义替换对照（026 research R2、R5）：题目文字、防编造验证、数据形状、前台标记。纯函数，脚本和页面共用
import type { GroupView } from './practice'

export type Pair = { q: string; s: string }
export type ParaphraseData = { at: number; model: string; items: Record<string, Pair[]> }

export const MAX_PAIRS = 3
const MAX_LEN = 200

type Question = GroupView['questions'][number]

/** 这道题的题目文字：题干、题目选项、选择题的题组选项、填空正文里含 {{n}} 的行 */
export const questionTexts = (g: GroupView, q: Question): string => {
  const numbers = Array.from({ length: Math.max(q.span, 1) }, (_, i) => q.number + i)
  const lines = (g.content ?? '').split('\n').filter((l) => numbers.some((n) => l.includes(`{{${n}}}`)))
  const choice = g.type === 'single_choice' || g.type === 'multi_choice'
  return [q.prompt ?? '', ...q.options.map((o) => o.text), ...(choice ? g.options.map((o) => o.text) : []), ...lines.map((l) => l.replace(/\{\{\d+\}\}/g, ' '))]
    .filter(Boolean)
    .join('\n')
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** 只留两边都能在原文里找到、且互不包含的对；去重，最多 3 对 */
export const validatePairs = (raw: unknown, question: string, evidence: string): Pair[] => {
  if (!Array.isArray(raw)) return []
  const [qt, et] = [norm(question), norm(evidence)]
  const out: Pair[] = []
  const seen = new Set<string>()
  for (const p of raw) {
    if (out.length >= MAX_PAIRS) break
    if (!p || typeof p !== 'object') continue
    const { q, s } = p as Record<string, unknown>
    if (typeof q !== 'string' || typeof s !== 'string') continue
    const [nq, ns] = [norm(q), norm(s)]
    // 一边包含另一边（如 tunnels ↔ tunnels in a leaf）只是照抄，不算替换
    if (!nq || !ns || nq.includes(ns) || ns.includes(nq) || q.length > MAX_LEN || s.length > MAX_LEN) continue
    if (!qt.includes(nq) || !et.includes(ns)) continue
    const key = `${nq}|${ns}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ q: q.trim(), s: s.trim() })
  }
  return out
}

/** 后台保存时的形状校验；null / 空表示没有数据 */
export const isParaphraseData = (v: unknown): boolean => {
  if (v === null || v === undefined) return true
  if (typeof v !== 'object' || Array.isArray(v)) return false
  const d = v as Partial<ParaphraseData>
  if (typeof d.at !== 'number' || typeof d.model !== 'string' || !d.items || typeof d.items !== 'object' || Array.isArray(d.items)) return false
  return Object.entries(d.items).every(
    ([k, list]) =>
      /^\d+$/.test(k) &&
      Array.isArray(list) &&
      list.length <= MAX_PAIRS &&
      list.every((p) => p && typeof p.q === 'string' && typeof p.s === 'string' && p.q.length <= MAX_LEN && p.s.length <= MAX_LEN),
  )
}

/** 把文本切成普通 / 标记片段：所有短语的所有出现处（不分大小写），重叠时取先出现的 */
export const markPhrases = (text: string, phrases: string[]): { text: string; mark: boolean }[] => {
  const lower = text.toLowerCase()
  const hits: [number, number][] = []
  for (const p of phrases.map((x) => x.toLowerCase()).filter(Boolean))
    for (let i = lower.indexOf(p); i >= 0; i = lower.indexOf(p, i + p.length)) hits.push([i, i + p.length])
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const out: { text: string; mark: boolean }[] = []
  let at = 0
  for (const [a, b] of hits) {
    if (a < at) continue
    if (a > at) out.push({ text: text.slice(at, a), mark: false })
    out.push({ text: text.slice(a, b), mark: true })
    at = b
  }
  if (at < text.length || !out.length) out.push({ text: text.slice(at), mark: false })
  return out
}
