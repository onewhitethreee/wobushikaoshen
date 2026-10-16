// 单词本合并（013 data-model "合并"）。纯函数，同步接口和浏览器共用；与 009 later() 一样满足交换律
import type { Source, VocabSettings, WordItem } from './store'

/** 每个词最多保留的原句条数 */
export const MAX_SRC = 5

const later = <T,>(x: T, y: T, at: (v: T) => number): T => {
  const d = at(y) - at(x)
  if (d) return d > 0 ? y : x
  return JSON.stringify(y) > JSON.stringify(x) ? y : x
}

const mergeSrc = (a: Source[] = [], b: Source[] = []): Source[] => {
  const byText = new Map<string, Source>()
  for (const s of [...a, ...b]) {
    const old = byText.get(s.text)
    byText.set(s.text, old ? later(old, s, (x) => x.at) : s)
  }
  return [...byText.values()].sort((x, y) => x.at - y.at || (x.text < y.text ? -1 : 1)).slice(-MAX_SRC)
}

export const mergeWord = (a: WordItem | undefined, b: WordItem | undefined): WordItem => {
  if (!a || !b) return (a ?? b)!
  if (!a.on || !b.on) return later(a, b, (w) => w.at)
  const newer = later(a, b, (w) => w.at)
  const reviewed = later(a, b, (w) => w.card?.last_review ?? (w.card ? 0 : -1))
  const card = reviewed.card ?? newer.card
  const firsts = [a.first, b.first].filter((x): x is number => typeof x === 'number')
  return {
    ...newer,
    at: Math.max(a.at, b.at),
    src: mergeSrc(a.src, b.src),
    ...(card ? { card } : {}),
    ...(firsts.length ? { first: Math.min(...firsts) } : {}),
  }
}

export const mergeWords = (a: Record<string, WordItem> = {}, b: Record<string, WordItem> = {}) => {
  const out: Record<string, WordItem> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = mergeWord(out[k], v)
  return out
}

export const mergeVocab = (a?: VocabSettings, b?: VocabSettings) => (a && b ? later(a, b, (s) => s.at) : (a ?? b))
