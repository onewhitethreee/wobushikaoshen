import { describe, expect, it } from 'vitest'

import { fillOf, levelOf } from '@/components/Journal/ScoreBadge'

// 005 FR-023：成绩图形三档色；弧长按 band / 9 或正确率
describe('成绩图形', () => {
  it('band 分三档', () => {
    expect([7, 6, 5].map((band) => levelOf({ band }))).toEqual(['good', 'mid', 'low'])
    expect(levelOf({ band: 5.5 })).toBe('mid')
  })

  it('正确率三档', () => {
    expect([0.8, 0.5, 0.4].map((ratio) => levelOf({ ratio }))).toEqual(['good', 'mid', 'low'])
  })

  it('弧长比例', () => {
    expect(fillOf({ band: 6.5 })).toBeCloseTo(6.5 / 9)
    expect(fillOf({ ratio: 0.8 })).toBe(0.8)
    expect(fillOf({ band: 10 })).toBe(1)
  })
})
