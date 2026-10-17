// 本机与账号之间的数据合并（009 research R6）。纯函数，接口和浏览器共用。
// 规则：记录取并集；其余按时间取新，取消 / 清空也是一条带时间的记录（删除标记），旧设备的数据不会复活
import { MAX_RECORDS, type Draft, type Mark, type PracticeRecord, type Progress } from '@/practice/store'
import { MAX_SRC, mergeVocab, mergeWords } from '@/vocab/merge'
import type { VocabSettings, WordItem } from '@/vocab/store'

export type SyncData = {
  records: PracticeRecord[]
  progress: Record<string, Progress>
  drafts: Record<string, Draft>
  favorites: Record<string, Mark>
  dismissed: Record<string, Mark>
  // 013 单词本与学习设置
  words?: Record<string, WordItem>
  vocab?: VocabSettings
}

export const emptyData = (): SyncData => ({ records: [], progress: {}, drafts: {}, favorites: {}, dismissed: {}, words: {} })

const recordKey = (r: PracticeRecord) => `${r.unitId}@${r.at}`

// 时间相同时按内容定先后，保证 merge(a, b) 与 merge(b, a) 结果一样
const later = <T,>(x: T, y: T, at: (v: T) => number): T => {
  const d = at(y) - at(x)
  if (d) return d > 0 ? y : x
  return JSON.stringify(y) > JSON.stringify(x) ? y : x
}

const newest = <T,>(a: Record<string, T> = {}, b: Record<string, T> = {}, at: (v: T) => number) => {
  const out: Record<string, T> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? later(out[k], v, at) : v
  return out
}

export const mergeData = (a: Partial<SyncData>, b: Partial<SyncData>): SyncData => {
  const byKey = new Map<string, PracticeRecord>()
  for (const r of [...(a.records ?? []), ...(b.records ?? [])]) {
    const k = recordKey(r)
    const old = byKey.get(k)
    byKey.set(k, old ? later(old, r, () => 0) : r)
  }
  const records = [...byKey.values()]
    .sort((x, y) => x.at - y.at || (recordKey(x) < recordKey(y) ? -1 : 1))
    .slice(-MAX_RECORDS)

  // 交卷后进度就没用了：同一单元有不早于进度的记录时丢掉进度
  const lastAt = new Map<string, number>()
  for (const r of records) lastAt.set(r.unitId, Math.max(lastAt.get(r.unitId) ?? 0, r.at))
  const progress = newest(a.progress, b.progress, (p) => p.savedAt)
  for (const [k, p] of Object.entries(progress)) if ((lastAt.get(k) ?? -1) >= p.savedAt) delete progress[k]

  return {
    records,
    progress,
    drafts: newest(a.drafts, b.drafts, (d) => d.at),
    favorites: newest(a.favorites, b.favorites, (m) => m.at),
    dismissed: newest(a.dismissed, b.dismissed, (m) => m.at),
    words: mergeWords(a.words, b.words),
    ...((a.vocab ?? b.vocab) ? { vocab: mergeVocab(a.vocab, b.vocab) } : {}),
  }
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown, max = 200) => typeof v === 'string' && v.length <= max
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const every = (o: unknown, ok: (v: Record<string, unknown>) => boolean, max = 5000, keyMax = 200) =>
  o === undefined || (isObj(o) && Object.keys(o).length <= max && Object.entries(o).every(([k, v]) => str(k, keyMax) && isObj(v) && ok(v)))

// 013 单词本：键 ≤ 64 字符（str 默认 200，这里另限）、原句 ≤ 5 条且每条 ≤ 300 字、释义 ≤ 800 字、卡片数值都是有限数
const MAX_WORDS = 5000
const CARD_NUMS = ['due', 'stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state'] as const
const isWord = (w: Record<string, unknown>) =>
  num(w.at) &&
  typeof w.on === 'boolean' &&
  (w.added === undefined || num(w.added)) &&
  (w.first === undefined || num(w.first)) &&
  (w.phonetic === undefined || str(w.phonetic, 100)) &&
  (w.meaning === undefined || str(w.meaning, 800)) &&
  (w.src === undefined ||
    (Array.isArray(w.src) &&
      w.src.length <= MAX_SRC &&
      w.src.every((s) => isObj(s) && str(s.text, 300) && str(s.href, 300) && str(s.title, 200) && num(s.at)))) &&
  (w.card === undefined || (isObj(w.card) && CARD_NUMS.every((k) => num((w.card as Record<string, unknown>)[k])) && (w.card.last_review === undefined || num(w.card.last_review))))

// 014 做题高亮：键 ≤ 64 个、键长 ≤ 16；每键 ≤ 300 段；每段两个非负整数且 start < end ≤ 200000（data-model）
const int = (v: unknown) => Number.isInteger(v) && (v as number) >= 0
const isMarks = (m: unknown) =>
  m === undefined ||
  (isObj(m) &&
    Object.keys(m).length <= 64 &&
    Object.entries(m).every(
      ([k, l]) =>
        str(k, 16) && Array.isArray(l) && l.length <= 300 &&
        l.every((s) => Array.isArray(s) && s.length === 2 && int(s[0]) && int(s[1]) && s[0] < s[1] && s[1] <= 200_000),
    ))

/** 接口收到的数据逐项校验形状，不合格整体拒收 */
export const isSyncData = (d: unknown): d is Partial<SyncData> =>
  isObj(d) &&
  (d.records === undefined ||
    (Array.isArray(d.records) &&
      d.records.length <= MAX_RECORDS &&
      d.records.every(
        (r) =>
          isObj(r) && str(r.unitId) && num(r.at) && num(r.score) && num(r.total) && Array.isArray(r.items) && r.items.length <= 200 &&
          (r.module === undefined || r.module === 'l' || r.module === 'r') && (r.answers === undefined || isObj(r.answers)),
      ))) &&
  every(d.progress, (p) => str(p.version) && isObj(p.answers) && num(p.savedAt) && isMarks(p.marks)) &&
  every(d.drafts, (x) => str(x.text, 20_000) && num(x.at)) &&
  every(d.favorites, (m) => num(m.at) && typeof m.on === 'boolean') &&
  every(d.dismissed, (m) => num(m.at) && typeof m.on === 'boolean') &&
  every(d.words, isWord, MAX_WORDS, 64) &&
  (d.vocab === undefined ||
    (isObj(d.vocab) && num(d.vocab.at) && Number.isInteger(d.vocab.newPerDay) && (d.vocab.newPerDay as number) >= 0 &&
      (d.vocab.newPerDay as number) <= 100 && (d.vocab.accent === 'gb' || d.vocab.accent === 'us')))
