// 本机单词本（013 data-model "单词本条目""学习设置"，research R6）。与做题记录分开存一个键；
// 写不进去（存储不可用 / 配额已满）时直接返回失败，不改内存、不推送，界面要如实提示（FR-027）
import { STORE_EVENT, schedulePush } from '@/practice/syncClient'

import { MAX_SRC } from './merge'

export const VOCAB_KEY = 'ybz:vocab:v1'
export const MAX_WORDS = 5000

/** ts-fsrs Card，日期存毫秒数 */
export type StoredCard = {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: number
}
export type Source = { text: string; href: string; title: string; at: number }
export type WordItem = {
  at: number
  on: boolean
  added?: number
  phonetic?: string
  meaning?: string
  src?: Source[]
  first?: number
  card?: StoredCard
}
export type VocabSettings = { at: number; newPerDay: number; accent: 'gb' | 'us' }
export type Vocab = { words: Record<string, WordItem>; vocab: VocabSettings }

export const defaultSettings = (): VocabSettings => ({ at: 0, newPerDay: 20, accent: 'gb' })

const obj = <T,>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {})

/** ok = false：本机存储不可用 */
export const load = (): Vocab & { ok: boolean } => {
  try {
    localStorage.setItem(VOCAB_KEY + ':probe', '1')
    localStorage.removeItem(VOCAB_KEY + ':probe')
    const raw = JSON.parse(localStorage.getItem(VOCAB_KEY) ?? '{}') as Partial<Vocab>
    return { words: obj(raw.words), vocab: { ...defaultSettings(), ...obj(raw.vocab) }, ok: true }
  } catch {
    return { words: {}, vocab: defaultSettings(), ok: false }
  }
}

export type SaveResult = 'ok' | 'unavailable' | 'quota'

/** 整体写回；sync = true 时触发推送并通知页面重读 */
export const save = (v: Vocab, sync = true): SaveResult => {
  try {
    localStorage.setItem(VOCAB_KEY, JSON.stringify({ words: v.words, vocab: v.vocab }))
  } catch (e) {
    return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22) ? 'quota' : 'unavailable'
  }
  if (sync && typeof window !== 'undefined') {
    schedulePush()
    window.dispatchEvent(new Event(STORE_EVENT))
  }
  return 'ok'
}

/** 有效的（没被移出的）单词 */
export const activeWords = (words: Record<string, WordItem>) => Object.entries(words).filter(([, w]) => w.on)

export type AddResult = 'added' | 'appended' | 'exists' | 'full' | SaveResult

/** 加入单词本；已有时追加原句（按 text 去重，最多 5 条，删最早的） */
export const addWord = (entry: { word: string; phonetic?: string; meanings: string[] }, source: Source, now = Date.now()): AddResult => {
  const v = load()
  if (!v.ok) return 'unavailable'
  const old = v.words[entry.word]
  let result: AddResult
  if (old?.on) {
    if (old.src?.some((s) => s.text === source.text)) return 'exists'
    v.words[entry.word] = { ...old, at: now, src: [...(old.src ?? []), source].slice(-MAX_SRC) }
    result = 'appended'
  } else {
    if (activeWords(v.words).length >= MAX_WORDS) return 'full'
    v.words[entry.word] = {
      at: now,
      on: true,
      added: now,
      ...(entry.phonetic ? { phonetic: entry.phonetic } : {}),
      meaning: entry.meanings.join('\n').slice(0, 800),
      src: [source],
    }
    result = 'added'
  }
  const saved = save(v)
  return saved === 'ok' ? result : saved
}

/** 移出单词本：留一条带时间的删除标记，同步时旧设备不会把它复活 */
export const removeWord = (word: string, now = Date.now()) => {
  const v = load()
  v.words[word] = { at: now, on: false }
  return save(v)
}

/** 作答后写回一个词 */
export const putWord = (word: string, item: WordItem) => {
  const v = load()
  v.words[word] = item
  return save(v)
}

export const saveSettings = (s: Omit<VocabSettings, 'at'>, now = Date.now()) => {
  const v = load()
  v.vocab = { ...s, at: now }
  return save(v)
}
