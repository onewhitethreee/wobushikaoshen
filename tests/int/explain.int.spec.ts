import { describe, expect, it } from 'vitest'

import { explainOrder } from '@/components/Practice/explain'
import type { GroupView, PracticeUnit } from '@/exam/practice'

const q = (number: number, span = 1) => ({ number, span, options: [], answers: 'A' })
const group = (key: string, type: GroupView['type'], questions: GroupView['questions'], content?: string): GroupView => ({
  key,
  type,
  instructions: '',
  content,
  options: [],
  questions,
})

const unit: PracticeUnit = {
  id: 'u1',
  docId: 1,
  source: 'unit',
  version: 'v',
  module: 'listening',
  title: '',
  whole: true,
  sections: [
    { label: 'Part 1', groups: [group('g1', 'completion', [q(1), q(2), q(3)], 'a {{1}} b {{2}}\nc {{3}}')] },
    { label: 'Part 2', groups: [group('g2', 'multi_choice', [q(4, 2)]), group('g3', 'single_choice', [q(6), q(7)])] },
  ],
}

describe('explainOrder', () => {
  it('按分部 → 题组 → 题目排序，多选只出一项，整体填空每空一项', () => {
    expect(explainOrder(unit)).toEqual([
      { section: 0, anchor: 1 },
      { section: 0, anchor: 2 },
      { section: 0, anchor: 3 },
      { section: 1, anchor: 4 },
      { section: 1, anchor: 6 },
      { section: 1, anchor: 7 },
    ])
  })
})

describe('explain 作答限长', () => {
  it('超长作答在扣费、查题之前就拒绝', async () => {
    const { explain, ANSWER_MAX } = await import('@/review/explain')
    const r = await explain({} as never, 1, { unitId: 'x', number: 1, answer: 'a'.repeat(ANSWER_MAX + 1) })
    expect(r).toEqual({ status: 400, json: { error: 'answer_too_long' } })
  })
})
