// 进步曲线（021 research R4、data-model）：从交卷记录算出一科的趋势。纯函数
import { moduleOf } from '@/account/mistakes'
import { listeningDefaults, readingDefaults } from '@/exam/bandScaleDefaults'
import type { Cet } from '@/exam/cet'
import { bandFor } from '@/exam/practice'
import type { QuestionType } from '@/exam/scoring'
import { accuracyByType, emptyStore, type PracticeRecord } from '@/practice/store'

export const WINDOW = 5
export const MAX_POINTS = 60

export type Point = { at: number; unitId: string; score: number; total: number; pct: number; avg: number; duration?: number }
export type BandPoint = { at: number; unitId: string; score: number; band: number }
export type Progress = {
  count: number
  points: Point[]
  truncated: boolean
  recent: number | null
  delta: number | null
  bands: BandPoint[]
  lastBand: number | null
  secPerQ: number | null
  types: { label: string; correct: number; total: number }[]
}

/** 整套：套题整科（t{id}-l / t{id}-r，没有 Part 号）或 028 模考一科（m{no}-l / m{no}-r），且 40 题 */
export const isWhole = (r: PracticeRecord) => /^[tm]\d+-[lr]$/.test(r.unitId) && r.total === 40

const ratio = (list: PracticeRecord[]) => {
  const total = list.reduce((s, r) => s + r.total, 0)
  return total ? list.reduce((s, r) => s + r.score, 0) / total : null
}

/** 不给 exam：雅思这一科（四 / 六级记录不计）；给了 exam：该考试听力阅读合在一起，module 只用来选 Band 换算表，四 / 六级没有整套所以不出 Band（033） */
export const progressOf = (records: PracticeRecord[], module: 'listening' | 'reading', typeName: (t: QuestionType) => string, exam?: Cet): Progress => {
  const m = module === 'listening' ? 'l' : 'r'
  const mine = records
    .filter((r) => r.total > 0 && (exam ? r.exam === exam : !r.exam && moduleOf(r, r.unitId) === m))
    .sort((a, b) => a.at - b.at)

  const all = mine.map((r, i) => ({
    at: r.at,
    unitId: r.unitId,
    score: r.score,
    total: r.total,
    pct: r.score / r.total,
    avg: ratio(mine.slice(Math.max(0, i - WINDOW + 1), i + 1))!,
    ...(typeof r.duration === 'number' ? { duration: r.duration } : {}),
  }))

  const recentList = mine.slice(-WINDOW)
  const scale = module === 'listening' ? listeningDefaults : readingDefaults
  const bands = mine.filter(isWhole).map((r) => ({ at: r.at, unitId: r.unitId, score: r.score, band: bandFor(r.score, scale) ?? 0 }))
  const timed = recentList.filter((r) => typeof r.duration === 'number')
  const timedQ = timed.reduce((s, r) => s + r.total, 0)
  const recent = ratio(recentList)
  const prev = mine.length >= WINDOW * 2 ? ratio(mine.slice(-WINDOW * 2, -WINDOW)) : null

  const store = emptyStore()
  store.records = mine
  return {
    count: mine.length,
    points: all.slice(-MAX_POINTS),
    truncated: all.length > MAX_POINTS,
    recent,
    delta: recent !== null && prev !== null ? Math.round((recent - prev) * 100) : null,
    bands,
    lastBand: bands.length ? bands[bands.length - 1].band : null,
    secPerQ: timedQ ? timed.reduce((s, r) => s + (r.duration ?? 0), 0) / timedQ : null,
    types: accuracyByType(store, typeName).sort((a, b) => a.correct / a.total - b.correct / b.total || a.label.localeCompare(b.label)),
  }
}
