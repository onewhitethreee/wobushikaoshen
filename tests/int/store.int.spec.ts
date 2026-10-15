import { describe, expect, it } from 'vitest'

import type { ScoreItem } from '@/exam/practice'
import { accuracyByType, addRecord, emptyStore, getProgress, KEY, lastScore, load, loadDrafts, setProgress, WRITING_KEY } from '@/practice/store'

const item = (groupKey: string, number: number, correct: boolean): ScoreItem => ({
  groupKey,
  number,
  type: number % 2 ? 'completion' : 'single_choice',
  correct,
})

describe('本地记录', () => {
  it('版本不符的进度被丢弃', () => {
    const s = emptyStore()
    setProgress(s, 't1-l1', 'v1', { 1: 'a' })
    expect(getProgress(s, 't1-l1', 'v1')?.answers).toEqual({ 1: 'a' })
    expect(getProgress(s, 't1-l1', 'v2')).toBeNull()
    expect(s.progress['t1-l1']).toBeUndefined()
  })

  it('交卷后删除该单位进度，最多保留 500 条', () => {
    const s = emptyStore()
    setProgress(s, 't1-l1', 'v', {})
    for (let i = 0; i < 502; i++) addRecord(s, { unitId: 't1-l1', at: i, score: 0, total: 1, items: [] })
    expect(s.progress['t1-l1']).toBeUndefined()
    expect(s.records).toHaveLength(500)
    expect(s.records[0].at).toBe(2)
  })

  it('题组行取最近一次含该组的记录（整套也算），单位行取同一单位', () => {
    const s = emptyStore()
    addRecord(s, { unitId: 't1-l1-g1', at: 1, score: 0, total: 2, items: [item('t1-l1-g1', 1, false), item('t1-l1-g1', 2, false)] })
    addRecord(s, {
      unitId: 't1-l',
      at: 2,
      score: 2,
      total: 3,
      items: [item('t1-l1-g1', 1, true), item('t1-l1-g1', 2, false), item('t1-l2-g1', 11, true)],
    })
    expect(lastScore(s, 't1-l1-g1')).toEqual({ correct: 1, total: 2 })
    expect(lastScore(s, 't1-l')).toEqual({ correct: 2, total: 3 })
    expect(lastScore(s, 't1-l1')).toBeNull()
    expect(lastScore(s, 't1-l3-g1')).toBeNull()
  })

  it('按题型正确率，同一题只算最近一次', () => {
    const s = emptyStore()
    addRecord(s, { unitId: 'a', at: 1, score: 0, total: 2, items: [item('g', 1, false), item('g', 2, false)] })
    addRecord(s, { unitId: 'a', at: 2, score: 1, total: 1, items: [item('g', 1, true)] })
    const r = accuracyByType(s, (t) => (t === 'completion' ? '填空' : '单选'))
    expect(r).toEqual([
      { label: '填空', correct: 1, total: 1 },
      { label: '单选', correct: 0, total: 1 },
    ])
  })
})

describe('009 本机数据兼容', () => {
  it('009 之前的本机数据读出来补上收藏等新字段', () => {
    localStorage.setItem(KEY, JSON.stringify({ progress: {}, records: [{ unitId: 'u1', at: 1, score: 1, total: 1, items: [] }] }))
    const { store, ok } = load()
    expect(ok).toBe(true)
    expect(store.records).toHaveLength(1)
    expect(store.favorites).toEqual({})
    expect(store.dismissed).toEqual({})
    expect(store.syncedRev).toBeUndefined()
  })

  it('旧的写作草稿（纯文字）读成 { text, at: 0 }', () => {
    localStorage.setItem(WRITING_KEY, JSON.stringify({ w1: '旧草稿', w2: { text: '新草稿', at: 5 } }))
    expect(loadDrafts()).toEqual({ w1: { text: '旧草稿', at: 0 }, w2: { text: '新草稿', at: 5 } })
  })
})
