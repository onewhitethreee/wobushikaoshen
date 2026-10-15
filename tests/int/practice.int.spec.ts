import { describe, expect, it } from 'vitest'

import { listeningDefaults } from '@/exam/bandScaleDefaults'
import { bandFor, parseUnitId, scoreUnit, unitId, type PracticeUnit } from '@/exam/practice'

describe('练习单位标识', () => {
  it('解析三种形式并能还原', () => {
    expect(parseUnitId('t12-l')).toEqual({ kind: 'test', docId: 12, module: 'l' })
    expect(parseUnitId('t12-r3')).toEqual({ kind: 'test', docId: 12, module: 'r', section: 3 })
    expect(parseUnitId('t12-l2-g1')).toEqual({ kind: 'test', docId: 12, module: 'l', section: 2, group: 1 })
    expect(parseUnitId('u7')).toEqual({ kind: 'unit', docId: 7 })
    expect(parseUnitId('u7-g2')).toEqual({ kind: 'unit', docId: 7, group: 2 })
    for (const s of ['t12-l', 't12-r3', 't12-l2-g1', 'u7', 'u7-g2']) expect(unitId(parseUnitId(s)!)).toBe(s)
  })

  it('格式不对返回 null', () => {
    for (const s of ['t0-l', 'x12-l', 't12-l2-g', 't12-q1', 't12-l0', 'latest-l1', 'u0', 'u7-g', 'u7-g0', 'u7-l1']) expect(parseUnitId(s)).toBeNull()
  })
})

const unit: PracticeUnit = {
  id: 't1-l1',
  docId: 1,
  source: 'test',
  version: 'v',
  module: 'listening',
  title: '',
  whole: false,
  sections: [
    {
      label: 'Part 1',
      groups: [
        {
          key: 't1-l1-g1',
          type: 'completion',
          instructions: '',
          maxWords: 2,
          options: [],
          questions: [
            { number: 1, span: 1, options: [], answers: '(the) river bank' },
            { number: 2, span: 1, options: [], answers: '15' },
          ],
        },
        {
          key: 't1-l1-g2',
          type: 'multi_choice',
          instructions: '',
          options: [],
          questions: [{ number: 3, span: 2, options: [], answers: 'B\nE' }],
        },
      ],
    },
  ],
}

describe('scoreUnit', () => {
  it('全对满分、全不答 0 分', () => {
    expect(scoreUnit(unit, { 1: 'River Bank', 2: 'fifteen', 3: ['E', 'B'] })).toMatchObject({ score: 4, total: 4 })
    expect(scoreUnit(unit, {})).toMatchObject({ score: 0, total: 4 })
  })

  it('多选只对 1 个得 1 分，每个题号一条记录', () => {
    const r = scoreUnit(unit, { 3: ['B', 'C'] })
    expect(r).toMatchObject({ score: 1, total: 4 })
    expect(r.items.filter((i) => i.groupKey === 't1-l1-g2').map((i) => [i.number, i.correct])).toEqual([
      [3, true],
      [4, false],
    ])
  })
})

describe('bandFor', () => {
  it('按听力换算表取 band', () => {
    expect([0, 15, 31, 40].map((s) => bandFor(s, listeningDefaults))).toEqual([0, 4.5, 7, 9])
    expect(bandFor(41, listeningDefaults)).toBeNull()
  })
})
