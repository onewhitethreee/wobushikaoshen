import { describe, expect, it } from 'vitest'

import type { GroupView, PracticeUnit, Section } from '@/exam/practice'
import { buildPrint, sourceOf } from '@/practice/print'

// 018 错题打印：分块、摘录、题组只留错题（research R4、R5）
const q = (number: number, evidence?: string, span = 1) => ({ number, span, prompt: `Q${number}`, options: [], answers: `ans${number}`, explanation: `exp${number}`, evidence })
const group = (key: string, questions: GroupView['questions'], type: GroupView['type'] = 'tfng'): GroupView => ({ key, type, instructions: `ins ${key}`, options: [], questions })
const s = (n: number) => ({ n, text: `S${n}.` })

const reading = (id: string, groups: GroupView[]): PracticeUnit => ({
  id,
  docId: 1,
  source: 'unit',
  version: '1',
  module: 'reading',
  title: `R ${id}`,
  whole: false,
  sections: [
    {
      label: 'Passage 1',
      passage: {
        title: 't',
        paragraphs: [
          { label: 'A', text: '', sentences: [s(1), s(2), s(3)] },
          { label: 'B', text: '', sentences: [s(4), s(5)] },
          { label: 'C', text: '', sentences: [s(6), s(7)] },
        ],
      },
      groups,
    },
  ],
})

const listening = (id: string, groups: GroupView[], transcript: Section['transcript'] = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, text: `L${i + 1}`, speaker: i % 2 ? 'B' : 'A' }))): PracticeUnit => ({
  id,
  docId: 2,
  source: 'unit',
  version: '1',
  module: 'listening',
  title: `L ${id}`,
  whole: false,
  sections: [{ label: 'Part 1', transcript, groups }],
})

const loader = (units: PracticeUnit[]) => async (source: string) => units.find((u) => u.id === source) ?? null

describe('sourceOf', () => {
  it('去掉题组后缀', () => {
    expect(sourceOf('u12-g2')).toBe('u12')
    expect(sourceOf('t3-r1-g2')).toBe('t3-r1')
    expect(sourceOf('bad')).toBeNull()
  })
})

describe('buildPrint 阅读', () => {
  const unit = reading('u1', [group('u1-g1', [q(1, '2'), q(2, '5'), q(3, '2')]), group('u1-g2', [q(4, '4-6'), q(5)])])

  it('出处所在整段，出处句 mark；同段只出一次；按原文顺序', async () => {
    const { blocks } = await buildPrint(
      [
        { groupKey: 'u1-g1', number: 3 },
        { groupKey: 'u1-g1', number: 1 },
      ],
      loader([unit]),
    )
    const ex = blocks[0].excerpt
    expect(ex?.kind).toBe('paragraphs')
    if (ex?.kind !== 'paragraphs') return
    expect(ex.paragraphs.map((p) => p.label)).toEqual(['A'])
    expect(ex.paragraphs[0].sentences.map((x) => x.mark)).toEqual([false, true, false])
  })

  it('跨段的出处两段都给，段落按原文顺序', async () => {
    const { blocks } = await buildPrint([{ groupKey: 'u1-g2', number: 4 }, { groupKey: 'u1-g1', number: 1 }], loader([unit]))
    const ex = blocks[0].excerpt
    if (ex?.kind !== 'paragraphs') throw new Error('kind')
    expect(ex.paragraphs.map((p) => p.label)).toEqual(['A', 'B', 'C'])
    expect(ex.paragraphs[2].sentences.map((x) => x.mark)).toEqual([true, false])
  })

  it('题组只留错题，按首题号排序；没有出处的题照常返回', async () => {
    const { blocks } = await buildPrint(
      [
        { groupKey: 'u1-g2', number: 5 },
        { groupKey: 'u1-g1', number: 2 },
      ],
      loader([unit]),
    )
    expect(blocks[0].groups.map((g) => [g.groupKey, g.questions.map((x) => x.number)])).toEqual([
      ['u1-g1', [2]],
      ['u1-g2', [5]],
    ])
    expect(blocks[0].groups[0].questions[0]).toMatchObject({ answers: 'ans2', explanation: 'exp2' })
  })

  it('没有出处、出处不在原文里 → excerpt 为 null', async () => {
    const u = reading('u9', [group('u9-g1', [q(1), q(2, '99')])])
    const { blocks } = await buildPrint([{ groupKey: 'u9-g1', number: 1 }, { groupKey: 'u9-g1', number: 2 }], loader([u]))
    expect(blocks[0].excerpt).toBeNull()
    expect(blocks[0].groups[0].questions).toHaveLength(2)
  })
})

describe('buildPrint 听力', () => {
  it('出处 ±1 句带说话人，相邻合并、不相邻分开，首尾不越界', async () => {
    const u = listening('u2', [group('u2-g1', [q(1, '5'), q(2, '7'), q(3, '1'), q(4, '10')])])
    const one = await buildPrint([{ groupKey: 'u2-g1', number: 1 }], loader([u]))
    const ex = one.blocks[0].excerpt
    if (ex?.kind !== 'lines') throw new Error('kind')
    expect(ex.runs.map((r) => r.map((l) => l.n))).toEqual([[4, 5, 6]])
    expect(ex.runs[0].map((l) => l.mark)).toEqual([false, true, false])
    expect(ex.runs[0][0].speaker).toBe('B')

    const merged = await buildPrint([1, 2, 3, 4].map((number) => ({ groupKey: 'u2-g1', number })), loader([u]))
    const ex2 = merged.blocks[0].excerpt
    if (ex2?.kind !== 'lines') throw new Error('kind')
    expect(ex2.runs.map((r) => r.map((l) => l.n))).toEqual([[1, 2], [4, 5, 6, 7, 8, 9, 10]])
  })

  it('原文是整段文字（套题）→ 不印原文', async () => {
    const u = listening('t1-l1', [group('t1-l1-g1', [q(1, '5')])], 'plain transcript')
    const { blocks } = await buildPrint([{ groupKey: 't1-l1-g1', number: 1 }], loader([u]))
    expect(blocks[0].excerpt).toBeNull()
  })
})

describe('buildPrint 分块与计数', () => {
  const r = reading('u1', [group('u1-g1', [q(1), q(2)]), group('u1-g2', [q(21, undefined, 2)], 'multi_choice')])
  const l = listening('u2', [group('u2-g1', [q(1)])])

  it('多选题按首题号只出一项；重复只算一次；来源按首次出现排序', async () => {
    const { blocks, skipped } = await buildPrint(
      [
        { groupKey: 'u2-g1', number: 1 },
        { groupKey: 'u1-g2', number: 22 },
        { groupKey: 'u1-g2', number: 21 },
        { groupKey: 'u2-g1', number: 1 },
      ],
      loader([r, l]),
    )
    expect(skipped).toBe(0)
    expect(blocks.map((b) => b.source)).toEqual(['u2', 'u1'])
    expect(blocks[1].groups[0].questions.map((x) => [x.number, x.span])).toEqual([[21, 2]])
  })

  it('来源下架、题号找不到、key 不合法 → 计入 skipped', async () => {
    const { blocks, skipped } = await buildPrint(
      [
        { groupKey: 'u404-g1', number: 1 },
        { groupKey: 'u404-g1', number: 2 },
        { groupKey: 'u1-g1', number: 99 },
        { groupKey: 'nope', number: 1 },
        { groupKey: 'u1-g1', number: 1 },
      ],
      loader([r]),
    )
    expect(skipped).toBe(4)
    expect(blocks).toHaveLength(1)
  })
})
