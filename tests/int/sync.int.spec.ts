import { describe, expect, it } from 'vitest'

import { mergeData, type SyncData } from '@/account/sync'
import type { PracticeRecord } from '@/practice/store'

const rec = (unitId: string, at: number, score = 1): PracticeRecord => ({ unitId, at, score, total: 2, items: [] })

const a: Partial<SyncData> = {
  records: [rec('u1', 100), rec('u2', 200)],
  progress: { u3: { version: 'v', answers: { 1: 'a' }, savedAt: 150 } },
  drafts: { w1: { text: '手机上的', at: 300 } },
  favorites: { 'u:u1': { at: 10, on: true } },
}
const b: Partial<SyncData> = {
  records: [rec('u2', 200), rec('u3', 400)],
  progress: { u3: { version: 'v', answers: { 1: 'b' }, savedAt: 160 }, u4: { version: 'v', answers: {}, savedAt: 50 } },
  drafts: { w1: { text: '', at: 500 } },
  favorites: { 'u:u1': { at: 20, on: false }, 'u:u9': { at: 5, on: true } },
}

describe('mergeData', () => {
  it('记录取并集，同一条只算一次', () => {
    expect(mergeData(a, b).records.map((r) => `${r.unitId}@${r.at}`)).toEqual(['u1@100', 'u2@200', 'u3@400'])
  })

  it('交换律与幂等', () => {
    const ab = mergeData(a, b)
    expect(mergeData(b, a)).toEqual(ab)
    expect(mergeData(a, ab)).toEqual(ab)
    expect(mergeData(ab, ab)).toEqual(ab)
  })

  it('已交卷单元的进度被丢弃，其余进度取新', () => {
    const m = mergeData(a, b)
    expect(m.progress.u3).toBeUndefined() // u3 在 400 交卷
    expect(m.progress.u4.savedAt).toBe(50)
  })

  it('取消收藏和清空草稿不会被旧设备复活', () => {
    const m = mergeData(a, b)
    expect(m.favorites['u:u1'].on).toBe(false)
    expect(m.favorites['u:u9'].on).toBe(true)
    expect(m.drafts.w1.text).toBe('')
  })

  it('记录超过 500 条时删最早的', () => {
    const many = Array.from({ length: 510 }, (_, i) => rec('u1', i + 1))
    const m = mergeData({ records: many }, {})
    expect(m.records).toHaveLength(500)
    expect(m.records[0].at).toBe(11)
  })

  it('缺少的部分按空处理', () => {
    expect(mergeData({}, {})).toEqual({ records: [], progress: {}, drafts: {}, favorites: {}, dismissed: {}, words: {}, dictation: {}, mocks: {} })
  })
})
