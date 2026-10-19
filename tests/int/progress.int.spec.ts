import { describe, expect, it } from 'vitest'

import type { QuestionType } from '@/exam/scoring'
import { isWhole, progressOf } from '@/practice/progress'
import type { PracticeRecord } from '@/practice/store'

// 021 进步曲线：科目、整套、加权滑动平均、对比、Band、每题用时、截断、题型（research R4）
const rec = (at: number, score: number, total: number, extra: Partial<PracticeRecord> = {}): PracticeRecord => ({
  unitId: 'u1',
  module: 'r',
  at,
  score,
  total,
  items: [],
  ...extra,
})
const name = (t: QuestionType) => t

describe('isWhole', () => {
  it('套题整科且 40 题', () => {
    expect(isWhole(rec(1, 30, 40, { unitId: 't3-l' }))).toBe(true)
    expect(isWhole(rec(1, 30, 40, { unitId: 't3-l2' }))).toBe(false)
    expect(isWhole(rec(1, 30, 39, { unitId: 't3-l' }))).toBe(false)
    expect(isWhole(rec(1, 30, 40, { unitId: 'u5' }))).toBe(false)
  })
})

describe('progressOf', () => {
  it('按科目筛选：有 module 的按 module，没有的按网址，判断不了的跳过；题数 0 跳过', () => {
    const p = progressOf(
      [
        rec(1, 1, 2),
        rec(2, 1, 2, { module: 'l' }),
        rec(3, 1, 2, { module: undefined, unitId: 't3-r1' }),
        rec(4, 1, 2, { module: undefined, unitId: 'u9' }),
        rec(5, 0, 0),
      ],
      'reading',
      name,
    )
    expect(p.points.map((x) => x.at)).toEqual([1, 3])
    expect(p.count).toBe(2)
  })

  it('每次正确率与按题数加权的最近 5 次滑动平均', () => {
    const p = progressOf([rec(1, 1, 2), rec(2, 9, 10), rec(3, 0, 3), rec(4, 3, 3), rec(5, 2, 2), rec(6, 0, 40)], 'reading', name)
    expect(p.points.map((x) => x.pct)).toEqual([0.5, 0.9, 0, 1, 1, 0])
    expect(p.points[1].avg).toBeCloseTo(10 / 12)
    // 第 6 次：最近 5 次为第 2–6 次
    expect(p.points[5].avg).toBeCloseTo((9 + 0 + 3 + 2 + 0) / (10 + 3 + 3 + 2 + 40))
    expect(p.recent).toBeCloseTo(p.points[5].avg)
  })

  it('交卷不足 10 次没有对比；10 次起为最近 5 次与之前 5 次的百分点差', () => {
    const nine = Array.from({ length: 9 }, (_, i) => rec(i, 5, 10))
    expect(progressOf(nine, 'reading', name).delta).toBeNull()
    const ten = [...Array.from({ length: 5 }, (_, i) => rec(i, 5, 10)), ...Array.from({ length: 5 }, (_, i) => rec(10 + i, 7, 10))]
    expect(progressOf(ten, 'reading', name).delta).toBe(20)
  })

  it('整套 Band 用默认换算表', () => {
    const r = progressOf(
      [rec(1, 25, 40, { unitId: 't1-r' }), rec(2, 29, 40, { unitId: 't2-r' }), rec(3, 5, 13), rec(4, 33, 40, { unitId: 't3-r' })],
      'reading',
      name,
    )
    expect(r.bands.map((b) => b.band)).toEqual([6, 6.5, 7.5])
    expect(r.lastBand).toBe(7.5)
    const l = progressOf([rec(1, 30, 40, { unitId: 't1-l', module: 'l' })], 'listening', name)
    expect(l.lastBand).toBe(7)
    expect(progressOf([rec(1, 5, 13)], 'reading', name).lastBand).toBeNull()
  })

  it('平均每题用时只算最近 5 次中有用时的记录', () => {
    expect(progressOf([rec(1, 1, 10)], 'reading', name).secPerQ).toBeNull()
    const p = progressOf([rec(1, 1, 10, { duration: 9999 }), ...Array.from({ length: 4 }, (_, i) => rec(2 + i, 1, 10)), rec(9, 1, 10, { duration: 300 })], 'reading', name)
    expect(p.secPerQ).toBe(30)
  })

  it('最多 60 个点', () => {
    const p = progressOf(Array.from({ length: 70 }, (_, i) => rec(i, 1, 2)), 'reading', name)
    expect(p.points).toHaveLength(60)
    expect(p.points[0].at).toBe(10)
    expect(p.truncated).toBe(true)
    expect(p.count).toBe(70)
  })

  it('题型正确率按每道题最近一次，升序', () => {
    const items = (g: string, list: [number, boolean, QuestionType][]) => list.map(([number, correct, type]) => ({ groupKey: g, number, correct, type }))
    const p = progressOf(
      [
        rec(1, 0, 3, { items: items('u1-g1', [[1, false, 'tfng'], [2, false, 'tfng'], [3, true, 'completion']]) }),
        rec(2, 2, 2, { items: items('u1-g1', [[1, true, 'tfng'], [4, true, 'completion']]) }),
      ],
      'reading',
      name,
    )
    expect(p.types).toEqual([
      { label: 'tfng', correct: 1, total: 2 },
      { label: 'completion', correct: 2, total: 2 },
    ])
  })
})
