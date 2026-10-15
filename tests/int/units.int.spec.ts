import { describe, expect, it } from 'vitest'

import { validateUnit, type UnitData } from '@/exam/validate'

// 007 练习单元发布校验（data-model「发布校验」）。题号从 11 开始，单元不要求从 1 起
const reading = (): UnitData => ({
  module: 'reading',
  part: 1,
  title: 'Short Reading',
  sourceType: 'original',
  passage: [
    { label: 'A', sentences: [{ n: 0, text: 'Bees dance.' }, { n: 1, text: 'They share food.' }] },
    { label: 'B', sentences: [{ n: 2, text: 'Ants march.' }] },
  ],
  groups: [
    {
      type: 'tfng',
      questions: [
        { number: 11, answers: 'TRUE', evidence: '0' },
        { number: 12, answers: 'NOT GIVEN', evidence: '1-2' },
      ],
    },
    {
      type: 'multi_choice',
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: k })),
      questions: [{ number: 13, span: 2, answers: 'A\nC' }],
    },
  ],
})

const listening = (): UnitData => ({
  module: 'listening',
  part: 2,
  title: 'Short Talk',
  sourceType: 'repost',
  sourceSets: '某题集',
  audio: 1,
  transcript: [{ n: 0, text: 'Hello.' }],
  groups: [{ type: 'completion', maxWords: 1, questions: [{ number: 11, answers: 'hello' }] }],
})

describe('validateUnit', () => {
  it('合法的阅读、听力单元没有错误', () => {
    expect(validateUnit(reading())).toEqual([])
    expect(validateUnit(listening())).toEqual([])
  })

  it('听力缺音频、缺原文', () => {
    const errs = validateUnit({ ...listening(), audio: null, transcript: [] })
    expect(errs).toContain('听力缺少音频')
    expect(errs).toContain('听力缺少原文')
  })

  it('题号不连续、重复', () => {
    const d = reading()
    d.groups![0].questions![1].number = 15
    expect(validateUnit(d).join()).toContain('题号不连续')
    d.groups![0].questions![1].number = 11
    expect(validateUnit(d).join()).toContain('第 11 题重复')
  })

  it('多选占 span 个题号，答案数要等于 span', () => {
    const d = reading()
    d.groups![1].questions![0].answers = 'A'
    expect(validateUnit(d).join()).toContain('要选 2 项')
  })

  it('出处句号格式与范围', () => {
    const d = reading()
    d.groups![0].questions![0].evidence = 'x'
    expect(validateUnit(d).join()).toContain('格式应为')
    d.groups![0].questions![0].evidence = '2-3'
    expect(validateUnit(d).join()).toContain('不在原文里')
    // 编号不从 0 开始也按实际句号判断（转换时第一句可能是空的）
    const shifted = reading()
    shifted.passage = shifted.passage!.map((p) => ({ ...p, sentences: p.sentences!.map((x) => ({ ...x, n: (x.n as number) + 1 })) }))
    shifted.groups![0].questions![0].evidence = '3'
    shifted.groups![0].questions![1].evidence = '1-3'
    expect(validateUnit(shifted)).toEqual([])
  })

  it('有待确认的答案不能发布', () => {
    const d = reading()
    d.groups![0].questions![0].answerStatus = 'pending'
    expect(validateUnit(d)).toContain('还有 1 道题的答案待确认')
  })

  it('转载必须写来源题集', () => {
    expect(validateUnit({ ...listening(), sourceSets: '' })).toContain('转载内容必须填写来源题集 sourceSets')
  })

  it('信息匹配的答案必须是段落字母', () => {
    const d = reading()
    d.groups!.push({ type: 'matching_information', questions: [{ number: 15, answers: 'C' }] })
    expect(validateUnit(d).join()).toContain('不在选项 A / B 中')
  })
})
