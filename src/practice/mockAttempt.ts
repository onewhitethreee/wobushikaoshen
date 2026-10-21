// 028 一场模考的状态（data-model「MockAttempt」、research R4–R6）：阶段迁移、到点判断、续播位置、上限裁剪、标签页锁。
// 除标签页锁外都是纯函数
import type { Answers } from '@/exam/practice'
import type { Marks } from '@/practice/marks'

export type MockStage = 'intro' | 'listening' | 'break' | 'reading' | 'done' | 'abandoned'
export const STAGES: MockStage[] = ['intro', 'listening', 'break', 'reading', 'done', 'abandoned']

export type SectionState = {
  /** 本科开始（听力 = 音频开始），毫秒 */
  startedAt: number
  /** 截止时间，毫秒；按真实时间走，关掉页面也照走 */
  deadline: number
  /** 听力 4 个 Part 的音频秒数 */
  durations?: number[]
  answers: Answers
  marks?: Marks
  /** 标记复查的题号 */
  flags?: number[]
  elapsed?: number
  times?: Record<number, number>
  submittedAt?: number
  score?: number
  total?: number
  band?: number | null
  /** 到点自动交卷 */
  auto?: boolean
}

export type MockAttempt = {
  no: number
  /** 最后修改时间，同步时取新 */
  at: number
  startedAt: number
  stage: MockStage
  version: string
  /** 随机一场（no = 0）：抽到的 7 个单元 id，按 l1–l4、r1–r3 */
  units?: number[]
  l?: SectionState
  r?: SectionState
}

export const MAX_MOCKS = 50

export const attemptId = (a: Pick<MockAttempt, 'no' | 'startedAt'>) => `m${a.no}@${a.startedAt}`

export const startAttempt = (no: number, version: string, now = Date.now(), units?: number[]): MockAttempt => ({
  no,
  at: now,
  startedAt: now,
  stage: 'intro',
  version,
  ...(units ? { units } : {}),
})

/** 随机一场的编号 */
export const RANDOM_NO = 0

/** 这一场是不是考这张卷子（随机一场还要 7 个单元一样） */
export const sameExam = (a: Pick<MockAttempt, 'no' | 'units'>, p: { no: number; units: number[] }) =>
  a.no === p.no && (p.no !== RANDOM_NO || (a.units ?? []).join() === p.units.join())

const NEXT: Partial<Record<MockStage, MockStage>> = { intro: 'listening', listening: 'break', break: 'reading', reading: 'done' }

export const isActive = (a: MockAttempt) => a.stage !== 'done' && a.stage !== 'abandoned'

export const next = (a: MockAttempt, to: MockStage, now = Date.now()): MockAttempt => {
  const ok = to === 'abandoned' ? isActive(a) : NEXT[a.stage] === to
  if (!ok) throw new Error(`模考不能从 ${a.stage} 进入 ${to}`)
  return { ...a, stage: to, at: now }
}

export const expired = (s: Pick<SectionState, 'deadline'>, now = Date.now()) => now >= s.deadline
export const remaining = (s: Pick<SectionState, 'deadline'>, now = Date.now()) => Math.max(0, Math.ceil((s.deadline - now) / 1000))

/** 读不到音频时长：原文末句结束时间 + 5 秒，再没有就 600 秒 */
export const partFallback = (transcriptEnd?: number) => (typeof transcriptEnd === 'number' && transcriptEnd > 0 ? transcriptEnd + 5 : 600)

/** 按真实时间算音频应在的位置；全部播完返回 'ended' */
export const audioPosition = (durations: number[], startedAt: number, now = Date.now()): { part: number; offset: number } | 'ended' => {
  let t = Math.max(0, (now - startedAt) / 1000)
  for (let part = 0; part < durations.length; part++) {
    if (t < durations[part]) return { part, offset: t }
    t -= durations[part]
  }
  return 'ended'
}

/** 超出上限时先删最早的放弃，再删最早的完成；进行中的不删 */
export const trimMocks = (mocks: Record<string, MockAttempt>, max = MAX_MOCKS) => {
  const keys = Object.keys(mocks)
  if (keys.length <= max) return mocks
  const rank = (a: MockAttempt) => (a.stage === 'abandoned' ? 0 : a.stage === 'done' ? 1 : 2)
  const order = keys
    .filter((k) => !isActive(mocks[k]))
    .sort((x, y) => rank(mocks[x]) - rank(mocks[y]) || mocks[x].startedAt - mocks[y].startedAt)
  const out = { ...mocks }
  for (const k of order.slice(0, keys.length - max)) delete out[k]
  return out
}

/** 进行中的那一场（同一时间只有一场，FR-019）；万一有多场取最近开始的 */
export const activeAttempt = (mocks: Record<string, MockAttempt> = {}) =>
  Object.values(mocks)
    .filter(isActive)
    .sort((a, b) => b.startedAt - a.startedAt)[0]

/** 某张卷子最近一次考完的场次 */
export const lastDone = (mocks: Record<string, MockAttempt> = {}, no: number) =>
  Object.values(mocks)
    .filter((a) => a.no === no && a.stage === 'done')
    .sort((a, b) => b.startedAt - a.startedAt)[0]

// —— 标签页锁（research R6）：同一场只在一个标签页作答 ——
export const LOCK_KEY = 'ybz:mock-lock'
export type Lock = { tab: string; at: number }

export const readLock = (): Lock | null => {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null') as Lock | null
    return v && typeof v.tab === 'string' && typeof v.at === 'number' ? v : null
  } catch {
    return null
  }
}

export const writeLock = (tab: string, now = Date.now()) => {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ tab, at: now }))
  } catch {
    // 存不了就不锁，考试照常
  }
}

export const lockedByOther = (lock: Lock | null, tab: string, now = Date.now()) => !!lock && lock.tab !== tab && now - lock.at < 5000
