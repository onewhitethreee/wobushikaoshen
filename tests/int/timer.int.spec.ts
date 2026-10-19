import { describe, expect, it } from 'vitest'

import { isSyncData, mergeData } from '@/account/sync'
import type { GroupView, PracticeUnit, Section } from '@/exam/practice'
import { anchorOf, clampSec, fmt, limitSeconds, tick, topTimes, toSaved, type Clock } from '@/practice/timer'
import type { PracticeRecord } from '@/practice/store'

// 020 做题计时：时长、格式、累计、最长题、同步校验（research R1–R5）
const qs = (from: number, n: number, span = 1) => Array.from({ length: n }, (_, i) => ({ number: from + i * span, span, options: [], answers: 'a' }))
const group = (questions: GroupView['questions'], type: GroupView['type'] = 'tfng'): GroupView => ({ key: 'g', type, instructions: '', options: [], questions })
const unit = (module: PracticeUnit['module'], sections: Section[]): PracticeUnit => ({ id: 'u1', docId: 1, source: 'unit', version: '1', module, title: 't', whole: false, sections })

describe('limitSeconds', () => {
  it('阅读每题 1.5 分钟，向上取整到分钟；多选按题号数', () => {
    expect(limitSeconds(unit('reading', [{ label: 'P1', groups: [group(qs(1, 6)), group(qs(7, 7))] }]))).toBe(20 * 60)
    expect(limitSeconds(unit('reading', [1, 2, 3].map(() => ({ label: 'P', groups: [group(qs(1, 13))] })).concat([{ label: 'P', groups: [group(qs(1, 1))] }])))).toBe(60 * 60)
    expect(limitSeconds(unit('reading', [{ label: 'P1', groups: [group(qs(1, 5))] }]))).toBe(8 * 60)
    expect(limitSeconds(unit('reading', [{ label: 'P1', groups: [group(qs(21, 2, 2), 'multi_choice')] }]))).toBe(6 * 60)
  })

  it('听力按最后一句的 end 求和，没有时间戳的 Part 按 10 分钟', () => {
    const t = (end: number) => [{ n: 1, text: 'a', start: 0, end: 1 }, { n: 2, text: 'b', start: 1, end }]
    expect(limitSeconds(unit('listening', [{ label: 'P1', transcript: t(301.2), groups: [] }, { label: 'P2', transcript: t(455), groups: [] }]))).toBe(13 * 60)
    expect(limitSeconds(unit('listening', [{ label: 'P1', transcript: 'plain', groups: [] }]))).toBe(600)
  })
})

describe('fmt / clampSec', () => {
  it('分:秒，满一小时 时:分:秒', () => {
    expect([0, 65, 599.9, 3725, -35].map(fmt)).toEqual(['0:00', '1:05', '9:59', '1:02:05', '0:35'])
  })
  it('取整、夹到 0–86400', () => {
    expect([-1, 2.6, 90000, NaN].map(clampSec)).toEqual([0, 3, 86400, 0])
  })
})

describe('tick / anchorOf / topTimes / toSaved', () => {
  it('有当前题时同时累计到该题，没有只加总数', () => {
    const c: Clock = { elapsed: 0, times: {} }
    tick(c, 3)
    c.current = 5
    tick(c, 2)
    tick(c, 1.5)
    expect(c).toMatchObject({ elapsed: 6.5, times: { 5: 3.5 } })
  })

  it('多选题的第二个题号映射到首题号', () => {
    const u = unit('reading', [{ label: 'P', groups: [group(qs(1, 3)), group(qs(21, 2, 2), 'multi_choice')] }])
    expect([2, 21, 22, 24, 99].map((n) => anchorOf(u, n))).toEqual([2, 21, 21, 23, undefined])
  })

  it('不足 5 秒的不算，最多 3 道，降序', () => {
    expect(topTimes({ 1: 4.9, 2: 30, 3: 12, 4: 60, 5: 12 })).toEqual([
      [4, 60],
      [2, 30],
      [3, 12],
    ])
    expect(topTimes({ 1: 2 })).toEqual([])
  })

  it('保存时取整、去掉 0', () => {
    expect(toSaved({ elapsed: 65.4, times: { 1: 0.2, 2: 30.6 } })).toEqual({ elapsed: 65, times: { 2: 31 } })
  })
})

describe('同步', () => {
  const rec = (extra: Partial<PracticeRecord> = {}): PracticeRecord => ({ unitId: 'u1', at: 1, score: 1, total: 2, items: [], ...extra })

  it('合法的新字段通过；旧记录也通过', () => {
    expect(isSyncData({ records: [rec({ duration: 600, limit: 1200, times: { 1: 20, 21: 5 } }), rec()] })).toBe(true)
    expect(isSyncData({ progress: { u1: { version: 'v', answers: {}, savedAt: 1, elapsed: 30, times: { 3: 10 } } } })).toBe(true)
  })

  it('负数、小数、超过 86400、键太多都拒收', () => {
    const many = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [i + 1, 1]))
    for (const bad of [{ duration: -1 }, { duration: 1.5 }, { limit: 86401 }, { times: { 1: -2 } }, { times: many }, { times: [] }])
      expect(isSyncData({ records: [rec(bad as Partial<PracticeRecord>)] })).toBe(false)
    expect(isSyncData({ progress: { u1: { version: 'v', answers: {}, savedAt: 1, elapsed: 'x' } } })).toBe(false)
  })

  it('合并后用时字段原样保留', () => {
    const r = rec({ duration: 600, times: { 1: 20 }, limit: 1200 })
    expect(mergeData({ records: [r] }, { records: [] }).records[0]).toMatchObject({ duration: 600, times: { 1: 20 }, limit: 1200 })
  })
})
