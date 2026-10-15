import { describe, expect, it } from 'vitest'

import { focusPage } from '@/components/Journal/focusPage'
import type { PracticeRow, Tab } from '@/sample'

const row = (i: number, done: boolean): PracticeRow => ({
  id: `r${i}`,
  lead: '',
  title: '',
  meta: [],
  facets: { kind: 'unit' },
  record: done ? '上次 1/1' : undefined,
  actions: [],
})
const rows = Array.from({ length: 60 }, (_, i) => row(i, i % 2 === 0))
const tab: Tab = { id: 'unit', label: '整篇练', match: { kind: 'unit' }, filters: [] }

describe('focusPage', () => {
  it('按过滤后的位置算页码', () => {
    expect([0, 19, 20, 45].map((i) => focusPage(rows, tab, {}, `r${i}`, 20))).toEqual([1, 1, 2, 3])
  })

  it('不在结果里或没有 focus 返回 1', () => {
    expect(focusPage(rows, tab, {}, 'nope', 20)).toBe(1)
    expect(focusPage(rows, tab, {}, undefined, 20)).toBe(1)
    expect(focusPage(rows, tab, { status: '已做' }, 'r1', 20)).toBe(1)
  })

  it('"已做"只计带记录的行', () => {
    // 已做的是偶数行：r40 排第 21 个
    expect(focusPage(rows, tab, { status: '已做' }, 'r40', 20)).toBe(2)
    expect(focusPage(rows, tab, { status: '未做' }, 'r41', 20)).toBe(2)
  })
})
