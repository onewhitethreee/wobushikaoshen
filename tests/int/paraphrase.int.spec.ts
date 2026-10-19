import { describe, expect, it } from 'vitest'

import type { GroupView } from '@/exam/practice'
import { isParaphraseData, markPhrases, questionTexts, validatePairs } from '@/exam/paraphrase'

// 026 同义替换：题目文字、防编造验证、数据形状、前台标记（research R2、R5）
const group = (over: Partial<GroupView> = {}): GroupView => ({
  key: 'u1-g1',
  type: 'tfng',
  instructions: '',
  options: [],
  questions: [{ number: 6, span: 1, prompt: 'Pitcher plants increase in size after they have digested a lot of insects.', options: [], answers: 'TRUE' }],
  ...over,
})

describe('questionTexts', () => {
  it('题干', () => expect(questionTexts(group(), group().questions[0])).toContain('increase in size'))
  it('选择题带选项文字', () => {
    const g = group({ type: 'single_choice', questions: [{ number: 1, span: 1, prompt: 'Why did he leave?', options: [{ key: 'A', text: 'to earn more money' }], answers: 'A' }] })
    expect(questionTexts(g, g.questions[0])).toContain('earn more money')
  })
  it('填空题取正文里含 {{n}} 的那一行', () => {
    const g = group({ type: 'completion', content: 'Notes\n• He understood why the plant did not respond to {{1}}\n• other {{2}}', questions: [{ number: 1, span: 1, options: [], answers: 'raindrops' }] })
    const t = questionTexts(g, g.questions[0])
    expect(t).toContain('did not respond to')
    expect(t).not.toContain('other')
  })
})

describe('validatePairs', () => {
  const q = 'Pitcher plants increase in size after they have digested a lot of insects.'
  const ev = 'Carnivorous plants clearly benefit from eating animals; when scientists feed pitcher plants extra bugs, the plants get bigger.'
  it('两边都要在原文里找到，不分大小写；两边相同、空的丢掉；去重；最多 3 对', () => {
    const raw = [
      { q: 'increase in size', s: 'get bigger' },
      { q: 'A lot of insects', s: 'extra bugs' },
      { q: 'increase in size', s: 'grow larger' }, // s 是编造的
      { q: 'swell', s: 'get bigger' }, // q 是编造的
      { q: 'pitcher plants', s: 'pitcher plants' }, // 不是替换
      { q: 'Pitcher plants', s: 'feed pitcher plants extra' }, // 一边包含另一边，照抄
      { q: '', s: 'extra bugs' },
      { q: 'increase in size', s: 'get bigger' }, // 重复
      { q: 'insects', s: 'bugs' },
      { q: 'digested', s: 'eating' },
    ]
    expect(validatePairs(raw, q, ev)).toEqual([
      { q: 'increase in size', s: 'get bigger' },
      { q: 'A lot of insects', s: 'extra bugs' },
      { q: 'insects', s: 'bugs' },
    ])
  })
  it('不是数组 / 字段不对时返回空', () => {
    expect(validatePairs('x', q, ev)).toEqual([])
    expect(validatePairs([{ q: 1, s: 2 }], q, ev)).toEqual([])
  })
})

describe('isParaphraseData', () => {
  it('形状校验', () => {
    expect(isParaphraseData(null)).toBe(true)
    expect(isParaphraseData({ at: 1, model: 'm', items: { '6': [{ q: 'a', s: 'b' }] } })).toBe(true)
    expect(isParaphraseData({ at: 1, model: 'm', items: [] })).toBe(false)
    expect(isParaphraseData({ at: 1, model: 'm', items: { '6': [{ q: 'a' }] } })).toBe(false)
    expect(isParaphraseData({ at: 1, model: 'm', items: { '6': [{ q: 'a'.repeat(201), s: 'b' }] } })).toBe(false)
    expect(isParaphraseData({ at: 1, model: 'm', items: { x: [] } })).toBe(false)
  })
})

describe('markPhrases', () => {
  it('不分大小写、多处、重叠取先出现的', () => {
    expect(markPhrases('Extra bugs and more extra BUGS here', ['extra bugs'])).toEqual([
      { text: 'Extra bugs', mark: true },
      { text: ' and more ', mark: false },
      { text: 'extra BUGS', mark: true },
      { text: ' here', mark: false },
    ])
    expect(markPhrases('get bigger fast', ['get bigger', 'bigger fast'])).toEqual([
      { text: 'get bigger', mark: true },
      { text: ' fast', mark: false },
    ])
    expect(markPhrases('nothing', ['zzz'])).toEqual([{ text: 'nothing', mark: false }])
  })
})

describe('后台保存校验（Payload 字段 validate）', () => {
  it('格式不对的同义替换数据保存失败', async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@/payload.config')).default
    const payload = await getPayload({ config: await config })
    const { docs } = await payload.find({ collection: 'units', limit: 1, depth: 0 })
    if (!docs[0]) return
    await expect(payload.update({ collection: 'units', id: docs[0].id, data: { paraphrases: { items: [] } } })).rejects.toThrow(/同义替换|格式应为/)
  })
})
