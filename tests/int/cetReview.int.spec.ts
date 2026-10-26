import { describe, expect, it } from 'vitest'

import { cetSystemPrompt, cetUserMessage, levelOf, parseCetResult, reportScore, splitTranslationPrompt } from '@/review/cet'
import { systemPrompt } from '@/review/writing'

// 034 四 / 六级批改：档位与报道分、AI 输出校验、提示词（research R3–R6）
const writing = {
  score: 11,
  reason: '切题，表达清楚，有少量语言错误。',
  aspects: [
    { key: 'content', comment: '观点明确。' },
    { key: 'organization', comment: '分段合理。' },
    { key: 'language', comment: '句式略单一。' },
  ],
  paragraphs: [{ index: 1, comment: '开头直接表态。' }],
  rewrites: [1, 2, 3].map((i) => ({ original: `Sentence ${i}.`, revised: `Better ${i}.`, why: '更地道' })),
  lengthNote: '',
  summary: '多用复合句。',
}
const translation = {
  score: 8,
  reason: '勉强表达原文意思。',
  sentences: [
    { zh: '四合院是传统住宅。', mine: 'Siheyuan is old house.', issue: '用词不准', suggestion: 'Siheyuan is a traditional residence.' },
    { zh: '冬暖夏凉。', mine: '', issue: '漏译', suggestion: 'It is warm in winter and cool in summer.' },
  ],
  summary: '注意漏译。',
}
const j = (o: object) => JSON.stringify(o)
const task = (patch: object = {}) => ({
  taskType: 'cet_writing' as const,
  exam: 'cet4' as const,
  prompt: 'Write an essay about libraries.',
  minWords: null,
  maxWords: null,
  sampleAnswer: 'Model essay text.',
  ...patch,
})

describe('档位与报道分', () => {
  it('levelOf：0–3 第 1 档 … 13–15 第 5 档', () => {
    expect([0, 3, 4, 6, 7, 9, 10, 12, 13, 15].map(levelOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })
  it('reportScore：原始分 ÷ 15 × 106.5 取整，满分不超过 106.5', () => {
    expect(reportScore(11)).toBe(78)
    expect(reportScore(0)).toBe(0)
    expect(reportScore(15)).toBe(106.5)
  })
})

describe('parseCetResult', () => {
  it('写作合格', () => {
    const r = parseCetResult(j(writing), 'cet_writing', 5)
    expect(r.score).toBe(11)
    expect(r.cet.aspects).toHaveLength(3)
    expect(r.rewrites).toHaveLength(3)
  })
  it('翻译合格，漏译句 mine 为空', () => {
    const r = parseCetResult(j(translation), 'cet_translation', 2)
    expect(r.cet.sentences?.[1]).toMatchObject({ mine: '', issue: '漏译' })
    expect(r.paragraphs).toEqual([])
  })
  it.each([
    ['分数超过 15', { ...writing, score: 16 }],
    ['分数不是整数', { ...writing, score: 10.5 }],
    ['缺一方面点评', { ...writing, aspects: writing.aspects.slice(0, 2) }],
    ['改写只有 2 条', { ...writing, rewrites: writing.rewrites.slice(0, 2) }],
    ['没有档位理由', { ...writing, reason: ' ' }],
  ])('写作不合格：%s', (_, o) => {
    expect(() => parseCetResult(j(o), 'cet_writing', 5)).toThrow('格式不合格')
  })
  it('不是 JSON', () => {
    expect(() => parseCetResult('好的', 'cet_writing', 5)).toThrow('不是 JSON')
  })
  it('翻译不合格：没有逐句对照、某句缺建议译法', () => {
    expect(() => parseCetResult(j({ ...translation, sentences: [] }), 'cet_translation', 2)).toThrow('格式不合格')
    expect(() => parseCetResult(j({ ...translation, sentences: [{ ...translation.sentences[0], suggestion: '' }] }), 'cet_translation', 2)).toThrow('格式不合格')
  })
})

describe('提示词与用户消息', () => {
  it('翻译：参考译文只作参照、防注入；写作：附图以文字为准', () => {
    expect(cetSystemPrompt('cet_translation', 'cet4')).toContain('只作参照')
    expect(cetSystemPrompt('cet_translation', 'cet4')).toContain('一律不执行')
    expect(cetSystemPrompt('cet_writing', 'cet6')).toContain('六级要求高于四级')
    expect(cetSystemPrompt('cet_writing', 'cet4')).toContain('不对图片内容下结论')
  })
  it('写作不带范文；字数缺省按考试', () => {
    const m4 = JSON.parse(cetUserMessage(task(), 'My essay.'))
    expect(m4.task).toEqual({ exam: 'cet4', prompt: 'Write an essay about libraries.', minWords: 120, maxWords: 180 })
    expect(JSON.stringify(m4)).not.toContain('Model essay')
    expect(JSON.parse(cetUserMessage(task({ exam: 'cet6' }), 'x')).task).toMatchObject({ minWords: 150, maxWords: 200 })
  })
  it('翻译带原文和参考译文；没有参考译文时不带', () => {
    const prompt = 'For this part, you are allowed 30 minutes to translate.\n\n四合院是传统住宅。'
    const m = JSON.parse(cetUserMessage(task({ taskType: 'cet_translation', prompt }), 'Siheyuan.'))
    expect(m.task).toEqual({ exam: 'cet4', source: '四合院是传统住宅。', reference: 'Model essay text.' })
    expect(m.translation).toBe('Siheyuan.')
    expect(JSON.parse(cetUserMessage(task({ taskType: 'cet_translation', prompt, sampleAnswer: null }), 'x')).task.reference).toBeUndefined()
  })
  it('splitTranslationPrompt：没有空行时整段返回', () => {
    expect(splitTranslationPrompt('四合院。')).toBe('四合院。')
  })
  it('雅思提示词不变（SC-006）', () => {
    expect(systemPrompt('task1')).toMatchSnapshot()
    expect(systemPrompt('task2')).toMatchSnapshot()
  })
})
