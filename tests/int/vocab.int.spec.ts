// @vitest-environment node
// 单词本与复习（013 FR-021、FR-025–FR-027、FR-030–FR-035、FR-054）：合并、同步校验与权限、加词结果、每日队列、FSRS 结果稳定
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isSyncData, mergeData } from '@/account/sync'
import { memberDataEndpoint } from '@/endpoints/memberData'
import { mergeWord } from '@/vocab/merge'
import { buildQueue, dayStart, GRADES, rate, requeue, status } from '@/vocab/schedule'
import { addWord, load, VOCAB_KEY, type StoredCard, type WordItem } from '@/vocab/store'

const src = (text: string, at: number) => ({ text, href: '/practice/u1#p0-s1', title: 'T', at })
const word = (over: Partial<WordItem> = {}): WordItem => ({ at: 1, on: true, added: 1, meaning: 'm', src: [src('a', 1)], ...over })
const card = (over: Partial<StoredCard> = {}): StoredCard => ({
  due: 0, stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2, ...over,
})

describe('合并', () => {
  it('满足交换律', () => {
    const a = word({ at: 5, src: [src('a', 1), src('b', 4)], card: card({ last_review: 10 }), first: 3 })
    const b = word({ at: 7, src: [src('c', 6)], card: card({ last_review: 8 }), first: 2 })
    expect(mergeWord(a, b)).toEqual(mergeWord(b, a))
  })

  it('原句取并集去重、最多 5 条留最新；卡片取最近复习的；first 取较早的', () => {
    const a = word({ at: 5, src: [1, 2, 3].map((i) => src(`s${i}`, i)), card: card({ last_review: 100, reps: 9 }), first: 50 })
    const b = word({ at: 9, src: [3, 4, 5, 6].map((i) => src(`s${i}`, i)), card: card({ last_review: 80 }), first: 40 })
    const m = mergeWord(a, b)
    expect(m.src!.map((s) => s.text)).toEqual(['s2', 's3', 's4', 's5', 's6'])
    expect(m.card!.reps).toBe(9)
    expect(m.first).toBe(40)
    expect(m.at).toBe(9)
  })

  it('删除标记：较新时胜出，较旧时被条目覆盖', () => {
    expect(mergeWord(word({ at: 5 }), { at: 6, on: false }).on).toBe(false)
    expect(mergeWord(word({ at: 7 }), { at: 6, on: false }).on).toBe(true)
  })

  it('mergeData 带上单词本和设置', () => {
    const m = mergeData({ words: { a: word() }, vocab: { at: 1, newPerDay: 5, accent: 'gb' } }, { vocab: { at: 2, newPerDay: 9, accent: 'us' } })
    expect(Object.keys(m.words!)).toEqual(['a'])
    expect(m.vocab).toEqual({ at: 2, newPerDay: 9, accent: 'us' })
  })
})

describe('同步校验', () => {
  it('合格的通过', () => expect(isSyncData({ words: { a: word({ card: card() }) }, vocab: { at: 1, newPerDay: 20, accent: 'gb' } })).toBe(true))
  it.each([
    ['5001 个词', { words: Object.fromEntries(Array.from({ length: 5001 }, (_, i) => [`w${i}`, word()])) }],
    ['6 条原句', { words: { a: word({ src: [1, 2, 3, 4, 5, 6].map((i) => src(`s${i}`, i)) }) } }],
    ['原句超长', { words: { a: word({ src: [src('x'.repeat(301), 1)] }) } }],
    ['卡片里有 NaN', { words: { a: word({ card: card({ stability: NaN }) }) } }],
    ['键超长', { words: { ['x'.repeat(65)]: word() } }],
    ['新词数越界', { vocab: { at: 1, newPerDay: 101, accent: 'gb' } }],
  ])('拒收：%s', (_, d) => expect(isSyncData(d)).toBe(false))
})

describe('加入单词本（本机）', () => {
  const store = new Map<string, string>()
  let failWith: string | null = null
  beforeEach(() => {
    store.clear()
    failWith = null
    ;(globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failWith && k === VOCAB_KEY) throw new DOMException('full', failWith)
        store.set(k, v)
      },
      removeItem: (k: string) => store.delete(k),
    }
  })
  const entry = { word: 'mitigate', meanings: ['vt. 缓和'] }

  it('加入、追加原句、重复原句', () => {
    expect(addWord(entry, src('one', 1))).toBe('added')
    expect(addWord(entry, src('two', 2))).toBe('appended')
    expect(addWord(entry, src('two', 3))).toBe('exists')
    expect(load().words.mitigate.src!.map((s) => s.text)).toEqual(['one', 'two'])
  })

  it('配额已满时返回 quota，单词本不变（FR-027）', () => {
    addWord(entry, src('one', 1))
    failWith = 'QuotaExceededError'
    expect(addWord({ word: 'other', meanings: ['x'] }, src('x', 2))).toBe('quota')
    failWith = null
    expect(Object.keys(load().words)).toEqual(['mitigate'])
  })

  it('存储不可用时返回 unavailable', () => {
    ;(globalThis as Record<string, unknown>).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {},
    }
    expect(addWord(entry, src('one', 1))).toBe('unavailable')
  })
})

describe('每日队列与调度', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 16, h, m).getTime()

  it('一天从凌晨 4 点算起', () => {
    expect(dayStart(at(3, 59))).toBe(new Date(2026, 9, 15, 4).getTime())
    expect(dayStart(at(4))).toBe(at(4))
  })

  it('新词名额扣掉今天已学的；到期复习不设上限', () => {
    const now = at(12)
    const words: Record<string, WordItem> = {
      learned: word({ first: at(9), card: card({ due: at(30 + 12) }) }),
      n1: word({ added: 1 }),
      n2: word({ added: 2 }),
      n3: word({ added: 3 }),
      ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`d${i}`, word({ first: 1, card: card({ due: at(8) }) })])),
    }
    const q = buildQueue(words, { at: 0, newPerDay: 2, accent: 'gb' }, now)
    expect(q.fresh).toEqual(['n1'])
    expect(q.due).toHaveLength(30)
  })

  it('固定输入结果稳定（不加随机扰动）', () => {
    const run = () => {
      let w = word()
      let t = at(10)
      for (const g of [2, 2, 0]) {
        w = rate(w, GRADES[g], t)
        t = w.card!.due
      }
      return w.card
    }
    expect(run()).toEqual(run())
    expect(run()).toMatchSnapshot()
  })

  it('"忘了"之后本次再出现，"很熟"之后不再出现；first 只记第一次', () => {
    const t = at(10)
    const again = rate(word(), GRADES[0], t)
    expect(requeue(again, t)).toBe(true)
    expect(again.first).toBe(t)
    const easy = rate(again, GRADES[3], t + 60_000)
    expect(requeue(easy, t + 60_000)).toBe(false)
    expect(easy.first).toBe(t)
  })

  it('复习间隔 21 天算学习中，22 天算已掌握', () => {
    expect(status(word())).toBe('new')
    expect(status(word({ card: card({ scheduled_days: 21 }) }))).toBe('learning')
    expect(status(word({ card: card({ scheduled_days: 22 }) }))).toBe('mastered')
  })
})

describe('权限：只能读写自己的单词本（FR-026）', () => {
  let payload: Payload
  const emails = [`e2e-vocab-a-${Date.now()}@example.test`, `e2e-vocab-b-${Date.now()}@example.test`]
  const members: object[] = []
  const push = (m: object, data: unknown) =>
    memberDataEndpoint.handler({
      user: { ...m, collection: 'members' },
      payload,
      headers: new Headers(),
      text: async () => JSON.stringify({ baseRev: -1, data }),
    } as unknown as PayloadRequest) as Promise<Response>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    for (const email of emails) members.push(await payload.create({ collection: 'members', overrideAccess: true, data: { email, password: 'x'.repeat(40) } }))
  })
  afterAll(() => payload.delete({ collection: 'members', overrideAccess: true, where: { email: { in: emails } } }))

  it('A 推上去的词，B 拉不到', async () => {
    expect((await push(members[0], { words: { secretword: word() } })).status).toBe(200)
    const res = (await (await push(members[1], {})).json()) as { data?: { words?: Record<string, unknown> } }
    expect(res.data?.words ?? {}).not.toHaveProperty('secretword')
  })
})
