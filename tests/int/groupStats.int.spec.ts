import { describe, expect, it } from 'vitest'

import { unitSummary } from '@/exam/groupStats'

describe('unitSummary', () => {
  it('题数按 span 计，题号范围含多选的最后一题', () => {
    expect(
      unitSummary([
        { type: 'completion', questions: [{ number: 1 }, { number: 2 }, { number: 3 }] },
        { type: 'multi_choice', questions: [{ number: 4, span: 2 }] },
        { type: 'single_choice', questions: [{ number: 6 }] },
        { type: 'tfng', questions: [] },
      ]),
    ).toEqual([
      { type: 'completion', count: 3, range: '1–3' },
      { type: 'multi_choice', count: 2, range: '4–5' },
      { type: 'single_choice', count: 1, range: '6' },
      { type: 'tfng', count: 0, range: '' },
    ])
  })

  it('没有题组返回空数组', () => {
    expect(unitSummary(undefined)).toEqual([])
  })
})
