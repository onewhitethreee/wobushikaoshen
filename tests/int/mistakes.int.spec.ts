import { describe, expect, it } from 'vitest'

import { mistakes } from '@/account/mistakes'
import type { QuestionType } from '@/exam/scoring'
import type { PracticeRecord } from '@/practice/store'

const rec = (at: number, items: [string, number, boolean, QuestionType?][], extra: Partial<PracticeRecord> = {}): PracticeRecord => ({
  unitId: items[0][0],
  at,
  score: 0,
  total: items.length,
  items: items.map(([groupKey, number, correct, type]) => ({ groupKey, number, correct, type: type ?? 'tfng' })),
  ...extra,
})

describe('mistakes', () => {
  it('先错后对 → 已掌握；先对后错 → 错题；一直对的不出现', () => {
    const m = mistakes([
      rec(1, [['u1-g1', 1, false], ['u1-g1', 2, true], ['u1-g1', 3, true]], { module: 'r' }),
      rec(2, [['u1-g1', 1, true], ['u1-g1', 2, false], ['u1-g1', 3, true]], { module: 'r' }),
    ])
    expect(m.map((x) => [x.key, x.state])).toEqual([
      ['u1-g1#1', 'mastered'],
      ['u1-g1#2', 'wrong'],
    ])
  })

  it('多选题按得分点各算一题', () => {
    const m = mistakes([rec(1, [['u2-g1', 5, true, 'multi_choice'], ['u2-g1', 6, false, 'multi_choice']], { module: 'l' })])
    expect(m.map((x) => x.key)).toEqual(['u2-g1#6'])
    expect(m[0].type).toBe('multi_choice')
  })

  it('旧记录没有 module 时按套题标识判断', () => {
    const m = mistakes([rec(1, [['t3-l1-g2', 1, false]])])
    expect(m[0].module).toBe('l')
  })

  it('最近一次的答案跟着走；按最近作答时间倒序', () => {
    const m = mistakes([
      rec(1, [['u1-g1', 1, false]], { module: 'r', answers: { 1: 'TRUE' } }),
      rec(5, [['u9-g1', 1, false]], { module: 'l', answers: { 1: 'cat' } }),
      rec(3, [['u1-g1', 1, false]], { module: 'r', answers: { 1: 'FALSE' } }),
    ])
    expect(m.map((x) => x.key)).toEqual(['u9-g1#1', 'u1-g1#1'])
    expect(m[1].answers).toEqual({ 1: 'FALSE' })
  })

  it('移除的题不再出现，撤销移除后回来', () => {
    const records = [rec(1, [['u1-g1', 1, false]], { module: 'r' })]
    expect(mistakes(records, { 'u1-g1#1': { at: 2, on: true } })).toEqual([])
    expect(mistakes(records, { 'u1-g1#1': { at: 3, on: false } })).toHaveLength(1)
  })
})
