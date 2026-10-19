import { describe, expect, it } from 'vitest'

import { isSyncData, mergeData } from '@/account/sync'
import { calendar, dailyTarget, daysLeft, doneToday, doneUnits, weakest } from '@/practice/plan'
import type { PracticeRecord } from '@/practice/store'
import type { WordItem } from '@/vocab/store'

// 024 备考计划（research R2–R5）；时间都用本地时间构造
const at = (s: string) => new Date(s).getTime()
const rec = (unitId: string, when: string, module: 'l' | 'r' = 'l'): PracticeRecord => ({ unitId, module, at: at(when), score: 1, total: 2, items: [] })

describe('daysLeft', () => {
  it('按日历日相减，凌晨 4 点前算前一天', () => {
    expect(daysLeft('2026-12-12', at('2026-10-19T10:00'))).toBe(54)
    expect(daysLeft('2026-10-20', at('2026-10-20T03:00'))).toBe(1)
    expect(daysLeft('2026-10-20', at('2026-10-20T05:00'))).toBe(0)
    expect(daysLeft('2026-10-18', at('2026-10-19T10:00'))).toBe(-1)
    expect(daysLeft('2026-11-01', at('2026-10-31T23:00'))).toBe(1)
  })
})

describe('dailyTarget', () => {
  it('未做 ÷ 剩余天数，最少 1，按阶段设上限，做完为 0', () => {
    expect(dailyTarget(300, 30, 'listening')).toBe(2)
    expect(dailyTarget(10, 30, 'listening')).toBe(1)
    expect(dailyTarget(0, 30, 'reading')).toBe(0)
    expect(dailyTarget(300, 10, 'listening')).toBe(4)
    expect(dailyTarget(300, 10, 'reading')).toBe(3)
    expect(dailyTarget(5, 10, 'reading')).toBe(1)
  })
})

describe('doneToday / doneUnits / weakest', () => {
  it('今天（凌晨 4 点起）这科做过的不同单元，题组归到单元', () => {
    const now = at('2026-10-19T20:00')
    const rs = [rec('u1-g1', '2026-10-19T09:00'), rec('u1-g2', '2026-10-19T10:00'), rec('u2', '2026-10-19T04:30'), rec('u3', '2026-10-19T03:59'), rec('u4', '2026-10-19T12:00', 'r')]
    expect(doneToday(rs, 'listening', now)).toBe(2)
    expect(doneToday(rs, 'reading', now)).toBe(1)
    expect(doneUnits(rs, 'listening').size).toBe(3)
  })
  it('题数不足 5 的题型不算', () => {
    expect(weakest([{ label: '判断', correct: 0, total: 3 }, { label: '填空', correct: 3, total: 6 }, { label: '单选', correct: 5, total: 6 }])).toBe('填空')
    expect(weakest([{ label: '判断', correct: 0, total: 3 }])).toBeUndefined()
  })
})

describe('calendar', () => {
  const word = (review: string): WordItem => ({ at: 0, on: true, card: { due: 0, stability: 1, difficulty: 1, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: at(review) } })

  it('35 天，交卷或背单词算打卡，连续天数到今天', () => {
    const now = at('2026-10-19T20:00')
    const c = calendar([rec('u1', '2026-10-19T09:00'), rec('u1', '2026-10-17T09:00')], { a: word('2026-10-18T22:00') }, now)
    expect(c.days).toHaveLength(35)
    expect(c.days[34]).toMatchObject({ date: '2026-10-19', active: true, today: true })
    expect(c.days[33]).toMatchObject({ date: '2026-10-18', active: true })
    expect(c.days[0].date).toBe('2026-09-15')
    expect(c.streak).toBe(3)
  })
  it('今天还没打卡时从昨天往前数', () => {
    const c = calendar([rec('u1', '2026-10-18T09:00')], {}, at('2026-10-19T20:00'))
    expect(c.streak).toBe(1)
    expect(calendar([rec('u1', '2026-10-17T09:00')], {}, at('2026-10-19T20:00')).streak).toBe(0)
  })
})

describe('计划同步', () => {
  it('合法通过、非法拒收、合并取新', () => {
    expect(isSyncData({ plan: { at: 1, examDate: '2026-12-12', target: 7 } })).toBe(true)
    expect(isSyncData({ plan: { at: 1, examDate: null, target: 6.5 } })).toBe(true)
    for (const bad of [{ at: 1, examDate: '12/12', target: 7 }, { at: 1, examDate: '2026-12-12', target: 7.3 }, { at: 1, examDate: '2026-12-12', target: 10 }])
      expect(isSyncData({ plan: bad })).toBe(false)
    expect(mergeData({ plan: { at: 1, examDate: '2026-12-12', target: 7 } }, { plan: { at: 2, examDate: null, target: 7 } }).plan?.examDate).toBeNull()
  })
})
