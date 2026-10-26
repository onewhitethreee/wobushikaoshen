// 浏览器本地的作答进度与交卷记录（research R3），结构见 data-model「本地存储」。
// 读写都包在 try/catch 里：隐私模式、配额满时练习照常，只是不保存。
import type { Answers, ScoreItem, UnitId } from '@/exam/practice'
import type { QuestionType } from '@/exam/scoring'
import type { Marks } from '@/practice/marks'
import { trimMocks, type MockAttempt } from '@/practice/mockAttempt'
import type { Plan } from '@/practice/plan'

export const KEY = 'ybz:practice:v1'
export const WRITING_KEY = 'ybz:writing:v1'
export const MAX_RECORDS = 500

// marks：014 做题高亮，交卷前随进度保存（旧进度没有）
// elapsed / times：020 做题计时，已用秒数与每题秒数（键为题的首题号）
export type Progress = { version: string; answers: Answers; savedAt: number; marks?: Marks; elapsed?: number; times?: Record<number, number> }
// module：练习单元的网址 u{id} 看不出听力 / 阅读，记录里另存（旧记录没有，按网址判断）
// answers：009 起交卷时一并保存，错题本显示"你的答案"（旧记录没有）
export type PracticeRecord = {
  unitId: UnitId
  module?: 'l' | 'r'
  /** 033：四 / 六级单元交卷时写；缺省 = 雅思 */
  exam?: 'cet4' | 'cet6'
  at: number
  score: number
  total: number
  items: ScoreItem[]
  answers?: Answers
  /** 020：总用时、每题用时（秒），用了倒计时时的限时（秒） */
  duration?: number
  times?: Record<number, number>
  limit?: number
}
// 收藏 / 错题本移除的下架题：取消也记一条带时间的 on: false，同步时不会被旧设备复活（009 research R6）
export type Mark = { at: number; on: boolean }
// 023 听写错句：键 u{id}#句号#模式（整句、挖空分开记，挖空写对不抵消整句的错）；有错记 wrong，之后同一模式全对改 mastered
export type DictEntry = { at: number; unitId: string; n: number; text: string; input: string; mode: 'full' | 'blank'; state: 'wrong' | 'mastered' }
export const MAX_DICTATION = 1000

export type Store = {
  progress: Record<UnitId, Progress>
  records: PracticeRecord[]
  favorites: Record<string, Mark>
  dismissed: Record<string, Mark>
  dictation: Record<string, DictEntry>
  /** 024 备考计划；清除时 examDate 为 null（保留时间，同步时旧计划不会复活） */
  plan?: Plan
  /** 028 模考：每一场（进行中 / 已完成 / 已放弃），键 m{no}@{startedAt} */
  mocks: Record<string, MockAttempt>
  /** 已登录时：上次同步到的账号版本、上次同步的时间（只推这之后改动的条目） */
  syncedRev?: number
  syncedAt?: number
}

export const emptyStore = (): Store => ({ progress: {}, records: [], favorites: {}, dismissed: {}, dictation: {}, mocks: {} })

export const isPlan = (p: unknown): p is Plan => {
  const x = p as Plan | undefined
  return (
    !!x && typeof x === 'object' && typeof x.at === 'number' && Number.isFinite(x.at) &&
    (x.examDate === null || (typeof x.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.examDate))) &&
    typeof x.target === 'number' && x.target >= 4 && x.target <= 9 && Number.isInteger(x.target * 2)
  )
}

/** 024：设置或清除（examDate = null）备考计划 */
export const setPlan = (store: Store, examDate: string | null, target: number, now = Date.now()) => {
  store.plan = { at: now, examDate, target }
}

const obj = <T,>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {})

/** ok=false：本机存储不可用（读不了、写不了或内容损坏），返回空 store */
export const load = (): { store: Store; ok: boolean } => {
  try {
    localStorage.setItem(KEY + ':probe', '1')
    localStorage.removeItem(KEY + ':probe')
    const raw = localStorage.getItem(KEY)
    if (!raw) return { store: emptyStore(), ok: true }
    const s = JSON.parse(raw) as Partial<Store>
    return {
      store: {
        progress: obj(s.progress),
        records: Array.isArray(s.records) ? s.records : [],
        favorites: obj(s.favorites),
        dismissed: obj(s.dismissed),
        dictation: obj(s.dictation),
        mocks: obj(s.mocks),
        plan: isPlan(s.plan) ? s.plan : undefined,
        syncedRev: s.syncedRev,
        syncedAt: s.syncedAt,
      },
      ok: true,
    }
  } catch {
    return { store: emptyStore(), ok: false }
  }
}

export const save = (store: Store): boolean => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export type Draft = { text: string; at: number }

/** 写作草稿：009 前的值是字符串，读成 at = 0 */
export const loadDrafts = (): Record<string, Draft> => {
  try {
    const raw = obj<unknown>(JSON.parse(localStorage.getItem(WRITING_KEY) ?? '{}'))
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? { text: v, at: 0 } : (v as Draft)]),
    )
  } catch {
    return {}
  }
}

export const saveDrafts = (drafts: Record<string, Draft>): boolean => {
  try {
    localStorage.setItem(WRITING_KEY, JSON.stringify(drafts))
    return true
  } catch {
    return false
  }
}

/** 收藏键：u:{单位标识}（单元 / 套题 Part / 题组）、q:{题组}#{题号}、w:{写作题 id}（009 research R7） */
export const favKeyFromHref = (href: string): string | null => {
  const p = /^\/practice\/([^/?#]+)/.exec(href)
  if (p && !p[1].startsWith('latest-')) return `u:${p[1]}`
  const w = /^\/writing\/(\d+)/.exec(href)
  return w ? `w:${w[1]}` : null
}

export const isFavorite = (store: Store, key: string) => Boolean(store.favorites[key]?.on)

/** 取消也记一条 on: false，同步时旧设备的收藏不会复活 */
export const toggleFavorite = (store: Store, key: string) => {
  store.favorites[key] = { at: Date.now(), on: !isFavorite(store, key) }
  return store.favorites[key].on
}

/** 023：记一次听写检查。有错 → wrong（覆盖）；全对且已在错题本里 → mastered；全对且不在 → 不记 */
export const recordDictation = (store: Store, e: Omit<DictEntry, 'state'>, allRight: boolean) => {
  const key = `${e.unitId}#${e.n}#${e.mode}`
  if (allRight && !store.dictation[key]) return
  store.dictation[key] = { ...e, input: e.input.slice(0, 500), text: e.text.slice(0, 500), state: allRight ? 'mastered' : 'wrong' }
  const keys = Object.keys(store.dictation)
  if (keys.length <= MAX_DICTATION) return
  // 超出上限：先删最早的已掌握，再删最早的
  const order = keys.sort((a, b) => {
    const [x, y] = [store.dictation[a], store.dictation[b]]
    return Number(x.state === 'wrong') - Number(y.state === 'wrong') || x.at - y.at
  })
  for (const k of order.slice(0, keys.length - MAX_DICTATION)) delete store.dictation[k]
}

/** 028：写入一场模考（同一键覆盖），超出上限时裁剪 */
export const saveAttempt = (store: Store, a: MockAttempt) => {
  store.mocks = trimMocks({ ...store.mocks, [`m${a.no}@${a.startedAt}`]: a })
}

/** 错题本里移除一道（已下架的）题 */
export const dismissMistake = (store: Store, key: string) => {
  store.dismissed[key] = { at: Date.now(), on: true }
}

/** 题目改过（版本不符）的旧进度直接丢弃（FR-050） */
export const getProgress = (store: Store, unitId: UnitId, version: string): Progress | null => {
  const p = store.progress[unitId]
  if (!p) return null
  if (p.version !== version) {
    delete store.progress[unitId]
    return null
  }
  return p
}

export const setProgress = (
  store: Store,
  unitId: UnitId,
  version: string,
  answers: Answers,
  marks?: Marks,
  time?: { elapsed: number; times: Record<number, number> },
) => {
  const kept = marks && Object.fromEntries(Object.entries(marks).filter(([, l]) => l.length))
  store.progress[unitId] = {
    version,
    answers,
    savedAt: Date.now(),
    ...(kept && Object.keys(kept).length ? { marks: kept } : {}),
    ...(time ? { elapsed: time.elapsed, times: time.times } : {}),
  }
}

export const addRecord = (store: Store, record: PracticeRecord) => {
  store.records.push(record)
  delete store.progress[record.unitId]
  if (store.records.length > MAX_RECORDS) store.records.splice(0, store.records.length - MAX_RECORDS)
}

const isGroupKey = (id: string) => /-g\d+$/.test(id)

/** 栏目页一行的"上次成绩"：题组行看最近一次含该组的任何记录，其余行看同一单位的最近记录 */
export const lastScore = (store: Store, rowId: string): { correct: number; total: number } | null => {
  for (let i = store.records.length - 1; i >= 0; i--) {
    const r = store.records[i]
    if (isGroupKey(rowId)) {
      const items = r.items.filter((x) => x.groupKey === rowId)
      if (items.length) return { correct: items.filter((x) => x.correct).length, total: items.length }
    } else if (r.unitId === rowId) return { correct: r.score, total: r.total }
  }
  return null
}

/** 按题型正确率：每道题（题组 + 题号）只算最近一次 */
export const accuracyByType = (store: Store, typeName: (type: QuestionType) => string) => {
  const latest = new Map<string, ScoreItem>()
  for (const r of store.records) for (const x of r.items) latest.set(`${x.groupKey}#${x.number}`, x)
  const sum = new Map<string, { label: string; correct: number; total: number }>()
  for (const x of latest.values()) {
    const label = typeName(x.type)
    const s = sum.get(label) ?? { label, correct: 0, total: 0 }
    s.total++
    if (x.correct) s.correct++
    sum.set(label, s)
  }
  return [...sum.values()].filter((s) => s.total > 0)
}
