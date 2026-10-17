import { describe, expect, it } from 'vitest'

import { isSyncData } from '@/account/sync'
import { addMark, regionText, removeMark, toOffsets, toRange, type Span } from '@/practice/marks'
import { emptyStore, getProgress, setProgress } from '@/practice/store'

// 014 FR-031：高亮区间的合并 / 删除，DOM 偏移换算，同步校验，版本变化作废
describe('addMark', () => {
  it('不重叠时按起点插入', () => expect(addMark([[10, 12]], [0, 5])).toEqual([[0, 5], [10, 12]]))
  it('重叠合并', () => expect(addMark([[0, 5]], [3, 8])).toEqual([[0, 8]]))
  it('首尾相接合并', () => expect(addMark([[0, 5]], [5, 8])).toEqual([[0, 8]]))
  it('新区间盖住多段', () => expect(addMark([[1, 2], [4, 5], [9, 10]], [0, 6])).toEqual([[0, 6], [9, 10]]))
  it('被已有区间包含', () => expect(addMark([[0, 10]], [2, 3])).toEqual([[0, 10]]))
  it('空区间不变', () => expect(addMark([[0, 1]], [3, 3])).toEqual([[0, 1]]))
})

describe('removeMark', () => {
  it('只删指定一段', () => expect(removeMark([[0, 1], [3, 4], [6, 7]], 1)).toEqual([[0, 1], [6, 7]]))
})

describe('toOffsets / toRange', () => {
  const region = () => {
    document.body.innerHTML = `<div data-hl="p"><p>Alpha beta.</p><p>Gamma <b data-hl-skip>XX</b>delta.</p></div>`
    return document.querySelector('[data-hl]')!
  }

  it('计数文本跳过 data-hl-skip', () => expect(regionText(region())).toBe('Alpha beta.Gamma delta.'))

  it('跨段往返一致', () => {
    const root = region()
    const span: Span = [6, 17] // "beta.Gamma "
    const r = toRange(root, span)!
    expect(r.toString()).toBe('beta.Gamma ')
    expect(toOffsets(root, r)).toEqual(span)
  })

  it('端点落在跳过的文字里时就近取', () => {
    const root = region()
    const xx = root.querySelector('b')!.firstChild!
    const r = document.createRange()
    r.setStart(root.querySelectorAll('p')[1].firstChild!, 0)
    r.setEnd(xx, 1)
    expect(toOffsets(root, r)).toEqual([11, 17]) // "Gamma "
  })

  it('文本变短时截断，越界返回 null', () => {
    const root = region()
    expect(toRange(root, [20, 99])!.toString()).toBe('ta.')
    expect(toRange(root, [50, 60])).toBeNull()
  })
})

describe('保存（US3）', () => {
  const data = (marks: unknown) => ({ progress: { u1: { version: 'v', answers: {}, savedAt: 1, marks } } })

  it('isSyncData 接受合法 marks 和没有 marks 的旧进度', () => {
    expect(isSyncData(data({ '0:p': [[0, 5], [8, 9]], '1:q': [] }))).toBe(true)
    expect(isSyncData(data(undefined))).toBe(true)
  })

  it.each([
    ['65 个键', Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`${i}:p`, [[0, 1]]]))],
    ['键太长', { '0123456789:abcdefg': [[0, 1]] }],
    ['301 段', { '0:p': Array.from({ length: 301 }, (_, i) => [i * 2, i * 2 + 1]) }],
    ['start >= end', { '0:p': [[5, 5]] }],
    ['负数', { '0:p': [[-1, 3]] }],
    ['end 超上限', { '0:p': [[0, 200_001]] }],
    ['非整数', { '0:p': [[0.5, 3]] }],
    ['不是数组', { '0:p': 'x' }],
  ])('isSyncData 拒收：%s', (_, m) => expect(isSyncData(data(m))).toBe(false))

  it('setProgress 带 marks，同版本取回、空区域不存；换版本作废', () => {
    const store = emptyStore()
    setProgress(store, 'u1', 'v1', {}, { '0:p': [[0, 3]], '0:q': [] })
    expect(getProgress(store, 'u1', 'v1')?.marks).toEqual({ '0:p': [[0, 3]] })
    setProgress(store, 'u2', 'v1', { 1: 'a' }, {})
    expect(getProgress(store, 'u2', 'v1')).not.toHaveProperty('marks')
    expect(getProgress(store, 'u1', 'v2')).toBeNull()
    expect(store.progress.u1).toBeUndefined()
  })
})
