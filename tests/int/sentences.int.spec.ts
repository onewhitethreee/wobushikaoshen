import { describe, expect, it } from 'vitest'

import { currentIndex, nextStart, prevStart, timedLines } from '@/components/Practice/sentences'

// 开场静音 0–2 秒；第 1、2 句之间停顿 6–7 秒
const lines = timedLines([
  { n: 2, text: 'c', start: 10, end: 14 },
  { n: 0, text: 'a', start: 2, end: 6 },
  { n: 1, text: 'b', start: 7, end: 9.5 },
])

describe('听力按句控制', () => {
  it('按 start 排序；字符串原文没有句子', () => {
    expect(lines.map((l) => l.n)).toEqual([0, 1, 2])
    expect(timedLines('整段原文')).toEqual([])
    expect(timedLines(undefined)).toEqual([])
  })

  it('当前句：开场前 -1，停顿期间保持上一句，末句之后仍是末句', () => {
    expect(currentIndex(lines, 1)).toBe(-1)
    expect(currentIndex(lines, 2)).toBe(0)
    expect(currentIndex(lines, 6.5)).toBe(0)
    expect(currentIndex(lines, 7)).toBe(1)
    expect(currentIndex(lines, 99)).toBe(2)
  })

  it('上一句：已播超过 1.5 秒先回句首，否则回上一句；第一句与开场前回到 0', () => {
    expect(prevStart(lines, 9)).toBe(7)
    expect(prevStart(lines, 8)).toBe(2)
    expect(prevStart(lines, 2.5)).toBe(0)
    expect(prevStart(lines, 1)).toBe(0)
  })

  it('下一句：末句返回 null，开场前到第一句', () => {
    expect(nextStart(lines, 1)).toBe(2)
    expect(nextStart(lines, 3)).toBe(7)
    expect(nextStart(lines, 11)).toBeNull()
  })
})
