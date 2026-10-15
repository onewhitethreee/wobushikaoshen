import { describe, expect, it } from 'vitest'

import { listeningDefaults, readingDefaults } from '@/exam/bandScaleDefaults'
import { validateBandScale, validateTest, validateWritingTask, type TestData } from '@/exam/validate'

// 最小合法套题：听力 4 Part、阅读 3 篇，各 40 题（每部分一个填空题组，题号连续）
const group = (from: number, to: number) => ({
  type: 'completion' as const,
  instructions: 'Write ONE WORD ONLY.',
  maxWords: 1,
  questions: Array.from({ length: to - from + 1 }, (_, i) => ({ number: from + i, answers: 'word' })),
})

const valid = (): TestData => ({
  listening: {
    parts: [
      [1, 10],
      [11, 20],
      [21, 30],
      [31, 40],
    ].map(([a, b]) => ({ audio: 1, transcript: 'text', groups: [group(a, b)] })),
  },
  reading: {
    passages: [
      [1, 13],
      [14, 26],
      [27, 40],
    ].map(([a, b]) => ({
      title: 'Passage',
      paragraphs: [
        { label: 'A', text: 'para A' },
        { label: 'B', text: 'para B' },
      ],
      groups: [group(a, b)],
    })),
  },
})

const lq = (d: TestData, part: number) => d.listening!.parts![part].groups![0].questions!

describe('validateTest', () => {
  it('合法套题没有错误', () => {
    expect(validateTest(valid())).toEqual([])
  })

  it('缺题号', () => {
    const d = valid()
    lq(d, 1).splice(1, 1) // 去掉第 12 题
    expect(validateTest(d).join('\n')).toMatch(/12/)
  })

  it('题号重复', () => {
    const d = valid()
    lq(d, 1)[1].number = 11
    const msg = validateTest(d).join('\n')
    expect(msg).toMatch(/11 题重复/)
    expect(msg).toMatch(/缺少第 12 题/)
  })

  it('缺标准答案，错误带位置', () => {
    const d = valid()
    d.reading!.passages![1].groups![0].questions![3].answers = ''
    expect(validateTest(d)).toContain('阅读 Passage 2 / 第 1 个题组 / 第 17 题：缺少标准答案')
  })

  it('多选题答案数和 span 不符', () => {
    const d = valid()
    d.listening!.parts![3].groups = [
      group(31, 38),
      {
        type: 'multi_choice',
        options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: key })),
        questions: [{ number: 39, span: 2, answers: 'A' }],
      },
    ]
    expect(validateTest(d).join('\n')).toMatch(/要选 2 项/)
  })

  it('单选答案不在选项里', () => {
    const d = valid()
    d.listening!.parts![0].groups = [
      group(1, 9),
      {
        type: 'single_choice',
        questions: [{ number: 10, options: ['A', 'B', 'C'].map((key) => ({ key, text: key })), answers: 'D' }],
      },
    ]
    expect(validateTest(d).join('\n')).toMatch(/答案「D」不在选项/)
  })

  it('听力只有 3 个 Part', () => {
    const d = valid()
    d.listening!.parts!.pop()
    expect(validateTest(d).join('\n')).toMatch(/需要 4 个 Part/)
  })

  it('只有听力、阅读为空时不校验阅读', () => {
    const d = valid()
    d.reading = { passages: [] }
    expect(validateTest(d)).toEqual([])
  })

  it('可接受答案超过字数限制', () => {
    const d = valid()
    lq(d, 0)[0].answers = '(the) river bank'
    expect(validateTest(d).join('\n')).toMatch(/超过 1 个词/)
  })

  it('写作只选了一道', () => {
    const d = valid()
    d.writing = { task1: 1, task2: null }
    expect(validateTest(d).join('\n')).toMatch(/Task 1 和 Task 2/)
  })

  it('口语缺 Part 2', () => {
    const d = valid()
    d.speaking = { part1: [1], part2: null, part3: [2] }
    expect(validateTest(d).join('\n')).toMatch(/Part 2/)
  })
})

describe('validateBandScale', () => {
  it('默认表完整', () => {
    expect(validateBandScale(listeningDefaults, '听力')).toEqual([])
    expect(validateBandScale(readingDefaults, '阅读')).toEqual([])
  })

  it('缺 31 分', () => {
    const rows = listeningDefaults.map((r) => (r.min === 30 ? { ...r, max: 30 } : r))
    expect(validateBandScale(rows, '听力')).toContain('听力：原始分 31 没有对应的 band')
  })

  it('区间重叠', () => {
    const rows = [...listeningDefaults, { min: 20, max: 21, band: 5.5 }]
    expect(validateBandScale(rows, '听力').join('\n')).toMatch(/落在多个区间/)
  })

  it('band 不是 0.5 的倍数', () => {
    const rows = listeningDefaults.map((r) => (r.min === 39 ? { ...r, band: 8.7 } : r))
    expect(validateBandScale(rows, '听力').join('\n')).toMatch(/0.5 的倍数/)
  })
})

describe('validateWritingTask', () => {
  const task = { taskType: 'task2', title: 'Cities', prompt: 'Discuss.', sourceType: 'original' }
  it('转载的写作题必须填来源题集（宪章 III）', () => {
    expect(validateWritingTask(task)).toEqual([])
    expect(validateWritingTask({ ...task, sourceType: 'repost' }).join()).toContain('sourceSets')
    expect(validateWritingTask({ ...task, sourceType: 'repost', sourceSets: '写作' })).toEqual([])
  })
})
