import { describe, expect, it } from 'vitest'

import { isSyncData, mergeData } from '@/account/sync'
import { listeningDefaults } from '@/exam/bandScaleDefaults'
import { bandOf, checkPaper, composePapers, doneUnits, drawPaper, fitsSlot, overall, type Pool, type ComposeUnit, type SlotUnit } from '@/exam/mock'
import {
  activeAttempt,
  attemptId,
  audioPosition,
  expired,
  next,
  partFallback,
  startAttempt,
  trimMocks,
  type MockAttempt,
} from '@/practice/mockAttempt'

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const paper = (): SlotUnit[] => [
  { slot: 'l1', module: 'listening', part: 1, numbers: range(1, 10) },
  { slot: 'l2', module: 'listening', part: 2, numbers: range(11, 20) },
  { slot: 'l3', module: 'listening', part: 3, numbers: range(21, 30) },
  { slot: 'l4', module: 'listening', part: 4, numbers: range(31, 40) },
  { slot: 'r1', module: 'reading', part: 1, numbers: range(1, 13) },
  { slot: 'r2', module: 'reading', part: 2, numbers: range(14, 26) },
  { slot: 'r3', module: 'reading', part: 3, numbers: range(27, 40) },
]

describe('checkPaper', () => {
  it('合规的 7 个单元没有错误', () => expect(checkPaper(paper())).toEqual([]))

  it('Part 号、模块、缺位置、题号重叠、合计不是 40 都报错', () => {
    const wrongPart = paper()
    wrongPart[5] = { ...wrongPart[5], part: 3 }
    expect(checkPaper(wrongPart).join()).toMatch(/r2/)

    const wrongModule = paper()
    wrongModule[0] = { ...wrongModule[0], module: 'reading' }
    expect(checkPaper(wrongModule).join()).toMatch(/l1/)

    expect(checkPaper(paper().slice(0, 6)).join()).toMatch(/r3/)

    const overlap = paper()
    overlap[0] = { ...overlap[0], numbers: range(5, 14) }
    expect(checkPaper(overlap).join()).toMatch(/重复/)

    const short = paper()
    short[6] = { ...short[6], numbers: range(27, 39) }
    expect(checkPaper(short).join()).toMatch(/39/)
  })
})

describe('bandOf / overall', () => {
  it('40 题直接查表，不是 40 题先折算', () => {
    expect(bandOf(30, 40, listeningDefaults)).toBe(7)
    expect(bandOf(29, 39, listeningDefaults)).toBe(bandOf(30, 40, listeningDefaults))
    expect(bandOf(0, 40, listeningDefaults)).toBe(0)
    expect(bandOf(0, 0, listeningDefaults)).toBe(0)
  })

  it('两科平均按官方规则进位到 0.5', () => {
    expect(overall(7, 6.5)).toBe(7)
    expect(overall(6, 6.5)).toBe(6.5)
    expect(overall(5.5, 6)).toBe(6)
    expect(overall(6, 6)).toBe(6)
  })
})

describe('audioPosition / expired', () => {
  const d = [300, 400, 350, 500]
  it('按真实时间找到 Part 和偏移', () => {
    expect(audioPosition(d, 0, 0)).toEqual({ part: 0, offset: 0 })
    expect(audioPosition(d, 0, 450_000)).toEqual({ part: 1, offset: 150 })
    expect(audioPosition(d, 1000, 1000 + 1_550_000)).toBe('ended')
  })

  it('读不到时长时退回原文末句 + 5 秒或 600 秒', () => {
    expect(partFallback(301)).toBe(306)
    expect(partFallback(undefined)).toBe(600)
  })

  it('到截止时间算过期', () => {
    expect(expired({ deadline: 1000 }, 999)).toBe(false)
    expect(expired({ deadline: 1000 }, 1000)).toBe(true)
  })
})

describe('阶段迁移', () => {
  it('按顺序推进，任一阶段可放弃，非法迁移抛错', () => {
    let a = startAttempt(3, 'v', 100)
    expect(a.stage).toBe('intro')
    expect(attemptId(a)).toBe('m3@100')
    for (const s of ['listening', 'break', 'reading', 'done'] as const) a = next(a, s, a.at + 1)
    expect(a.stage).toBe('done')
    expect(() => next(a, 'reading', 999)).toThrow()
    expect(next(startAttempt(3, 'v', 1), 'abandoned', 2).stage).toBe('abandoned')
    expect(() => next(next(next(startAttempt(3, 'v', 1), 'listening', 2), 'break', 3), 'listening', 4)).toThrow()
  })
})

const att = (no: number, startedAt: number, stage: MockAttempt['stage']): MockAttempt => ({ no, startedAt, at: startedAt, stage, version: 'v' })
const toMap = (list: MockAttempt[]) => Object.fromEntries(list.map((a) => [attemptId(a), a]))

describe('trimMocks / activeAttempt', () => {
  it('超过上限先删最早的放弃，再删最早的完成，不删进行中的', () => {
    const list = [att(1, 1, 'reading'), ...range(2, 31).map((i) => att(i, i, 'done')), ...range(32, 61).map((i) => att(i, i, 'abandoned'))]
    const kept = trimMocks(toMap(list), 50)
    expect(Object.keys(kept)).toHaveLength(50)
    expect(kept['m1@1']).toBeDefined()
    expect(Object.values(kept).filter((a) => a.stage === 'done')).toHaveLength(30)
    expect(kept['m32@32']).toBeUndefined()
  })

  it('只返回进行中的那场', () => {
    expect(activeAttempt(toMap([att(1, 1, 'done'), att(2, 2, 'listening')]))?.no).toBe(2)
    expect(activeAttempt(toMap([att(1, 1, 'done')]))).toBeUndefined()
  })
})

describe('mocks 同步', () => {
  const good = { 'm3@100': { ...att(3, 100, 'reading'), l: { startedAt: 100, deadline: 200, durations: [300, 400, 350, 500], answers: { 1: 'a' }, flags: [5], score: 30, total: 40, band: 7 } } }

  it('合法的通过，不合法的拒收', () => {
    expect(isSyncData({ mocks: good })).toBe(true)
    const bad = (patch: object) => isSyncData({ mocks: { 'm3@100': { ...good['m3@100'], ...patch } } })
    expect(bad({ stage: 'paused' })).toBe(false)
    expect(bad({ l: { ...good['m3@100'].l, flags: [41] } })).toBe(false)
    expect(bad({ l: { ...good['m3@100'].l, durations: [1, 2, 3, 4, 5] } })).toBe(false)
    expect(bad({ l: { ...good['m3@100'].l, score: 41 } })).toBe(false)
    expect(isSyncData({ mocks: Object.fromEntries(range(1, 51).map((i) => [`m${i}@1`, att(i, 1, 'done')])) })).toBe(false)
  })

  it('同一场取新的，完成的不被旧的进行中覆盖', () => {
    const done = { ...att(3, 100, 'done'), at: 500 }
    const old = { ...att(3, 100, 'reading'), at: 300 }
    expect(mergeData({ mocks: { 'm3@100': done } }, { mocks: { 'm3@100': old } }).mocks?.['m3@100'].stage).toBe('done')
    expect(mergeData({ mocks: { 'm3@100': old } }, { mocks: { 'm3@100': done } }).mocks?.['m3@100'].stage).toBe('done')
  })
})

describe('composePapers', () => {
  const R: Record<string, [number, number]> = { l1: [1, 10], l2: [11, 20], l3: [21, 30], l4: [31, 40], r1: [1, 13], r2: [14, 26], r3: [27, 40] }
  let id = 0
  const u = (slot: string, sourceSets = 'A'): ComposeUnit => ({
    id: ++id,
    module: slot[0] === 'l' ? 'listening' : 'reading',
    part: Number(slot[1]),
    sourceSets,
    numbers: range(...R[slot]),
  })

  it('组数取最小值、单元不重复、编号接续、同题集优先', () => {
    id = 0
    const units = [
      ...['l1', 'l2', 'l3', 'l4'].flatMap((s) => [u(s), u(s), u(s)]),
      u('r1', 'A'), u('r2', 'B'), u('r3', 'A'), u('r1', 'B'), u('r2', 'A'), u('r3', 'B'),
    ]
    const { papers, sameSet } = composePapers(units, new Set(), 5)
    expect(papers.map((p) => p.no)).toEqual([5, 6])
    expect(sameSet).toBe(2)
    const ids = papers.flatMap((p) => [p.l1, p.l2, p.l3, p.l4, p.r1, p.r2, p.r3])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('排除已用的单元，题号不合规的跳过', () => {
    id = 0
    const units = [...['l1', 'l2', 'l3', 'l4', 'r1', 'r2', 'r3'].map((s) => u(s)), ...['l1', 'l2', 'l3', 'l4', 'r1', 'r2'].map((s) => u(s))]
    const bad = { ...u('r3'), numbers: range(27, 39) }
    const { papers, skipped } = composePapers([...units, bad], new Set([1]), 1)
    expect(papers).toHaveLength(1)
    expect(papers[0].l1).not.toBe(1)
    expect(papers[0].r3).not.toBe(bad.id)
    expect(skipped).toEqual([bad.id])
    expect(composePapers(units, new Set(), 1).papers).toHaveLength(1)
  })
})

describe('随机一场', () => {
  const pool: Pool = { l1: [1, 2], l2: [3, 4], l3: [5, 6], l4: [7, 8], r1: [9, 10], r2: [11, 12], r3: [13, 14] }

  it('优先没做过的，都做过了在全部里抽', () => {
    const done = new Set([1, 3, 5, 7, 9, 11, 13])
    expect(drawPaper(pool, done, () => 0)).toEqual({ l1: 2, l2: 4, l3: 6, l4: 8, r1: 10, r2: 12, r3: 14 })
    expect(drawPaper({ ...pool, l1: [1] }, done, () => 0.99)!.l1).toBe(1)
    expect(drawPaper({ ...pool, r3: [] }, done)).toBeNull()
  })

  it('做过的单元从记录和题组键里找', () => {
    expect([...doneUnits([{ unitId: 'u5', items: [] }, { unitId: 'm0-l', items: [{ groupKey: 'u7-g1' }, { groupKey: 't1-l1-g1' }] }])].sort()).toEqual([5, 7])
  })

  it('summary 正好覆盖位置的标准题号才算合规', () => {
    expect(fitsSlot('reading', 2, [{ count: 6, range: '14–19' }, { count: 7, range: '20–26' }])).toBe(true)
    expect(fitsSlot('reading', 2, [{ count: 6, range: '14–19' }])).toBe(false)
    expect(fitsSlot('listening', 1, [{ count: 1, range: '1' }, { count: 9, range: '2–10' }])).toBe(true)
  })
})
