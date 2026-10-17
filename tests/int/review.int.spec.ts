// @vitest-environment node
// 015 写作批改与错题讲解（FR-050）：扣费、退回、防重复扣、频率限制
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { balance, grant, refund } from '@/account/credits'
import { charge } from '@/review/charge'
import { essayHash, expireStale, overall, parseResult } from '@/review/writing'
import { cacheKey, evidenceText, isWrong } from '@/review/explain'
import type { GroupView, Section } from '@/exam/practice'

let payload: Payload
const PREFIX = 'e2e-review-'
let n = 0
const mk = async (credits = 0) => {
  const m = await payload.create({
    collection: 'members',
    overrideAccess: true,
    data: { email: `${PREFIX}${Date.now()}-${n++}@example.test`, password: 'x'.repeat(32) },
  })
  if (credits) await grant(payload, { memberId: m.id, amount: credits, reason: 'adjust', note: 't' })
  return m
}
const entries = async (memberId: number) =>
  (await payload.find({ collection: 'credit-entries', overrideAccess: true, where: { member: { equals: memberId } }, sort: 'id', limit: 100 })).docs
const sum = async (memberId: number) => (await entries(memberId)).reduce((s, e) => s + e.amount, 0)
const cleanup = () => payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: PREFIX } } })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
})
afterAll(cleanup)

describe('charge / refund', () => {
  it('余额 0：balance，不写流水', async () => {
    const m = await mk()
    const r = await charge(payload, { memberId: m.id, prefix: `t:${m.id}:a` })
    expect(r).toMatchObject({ ok: false, reason: 'balance' })
    expect(await entries(m.id)).toHaveLength(0)
  })

  it('同一前缀并发两次：只扣一次，另一次 duplicate', async () => {
    const m = await mk(2)
    const rs = await Promise.all([1, 2].map(() => charge(payload, { memberId: m.id, prefix: `t:${m.id}:b` })))
    expect(rs.filter((r) => r.ok)).toHaveLength(1)
    expect(rs.filter((r) => !r.ok && r.reason === 'duplicate')).toHaveLength(1)
    expect(await balance(payload, m.id)).toBe(1)
    expect(await sum(m.id)).toBe(1)
  })

  it('退回只一次，refKey = refund:<扣费 refKey>；退回后同一前缀可再扣（n = 1）', async () => {
    const m = await mk(2)
    const prefix = `t:${m.id}:c`
    const r = await charge(payload, { memberId: m.id, prefix })
    if (!r.ok) throw new Error('扣费失败')
    expect(r.refKey).toBe(`${prefix}:0`)
    expect((await refund(payload, r.id))?.refKey).toBe(`refund:${prefix}:0`)
    expect(await refund(payload, r.id)).toBeNull()
    const again = await charge(payload, { memberId: m.id, prefix })
    expect(again).toMatchObject({ ok: true, refKey: `${prefix}:1` })
    expect(await balance(payload, m.id)).toBe(1)
    expect(await sum(m.id)).toBe(1)
  })

  it('60 秒内第 6 次成功扣费前被限频，不写流水', async () => {
    const m = await mk(10)
    for (let i = 0; i < 5; i++) expect((await charge(payload, { memberId: m.id, prefix: `t:${m.id}:r${i}` })).ok).toBe(true)
    expect(await charge(payload, { memberId: m.id, prefix: `t:${m.id}:r5` })).toMatchObject({ ok: false, reason: 'rate' })
    expect(await balance(payload, m.id)).toBe(5)
    expect(await sum(m.id)).toBe(5)
  })
})

describe('写作批改：总分、输出校验、作文指纹', () => {
  it('总分按官方规则取整', () => {
    expect(overall([6, 6, 6, 6.5])).toBe(6) // 6.125
    expect(overall([6, 6, 6.5, 6.5])).toBe(6.5) // 6.25
    expect(overall([6.5, 6.5, 7, 7])).toBe(7) // 6.75
    expect(overall([9, 9, 9, 9])).toBe(9)
  })

  const good = (keys = ['TR', 'CC', 'LR', 'GRA'], band: unknown = 6.5) => ({
    criteria: keys.map((key) => ({ key, band, reason: '理由' })),
    paragraphs: [{ index: 1, comment: '建议' }],
    rewrites: [1, 2, 3].map((i) => ({ original: `a${i}`, revised: `b${i}`, why: 'c' })),
    lengthNote: '',
  })
  const parse = (v: unknown, type: 'task1' | 'task2' = 'task2', sentences = 10) => () => parseResult(JSON.stringify(v), type, sentences)

  it('接受合格输出', () => {
    expect(parse(good())().criteria.map((c) => c.band)).toEqual([6.5, 6.5, 6.5, 6.5])
    expect(parse(good(['TA', 'CC', 'LR', 'GRA']), 'task1')().criteria[0].key).toBe('TA')
  })

  it('拒绝缺项、越界、key 与 Task 不符、改写不足、非 JSON', () => {
    expect(parse(good(['TR', 'CC', 'LR']))).toThrow('缺少 GRA')
    for (const band of [9.5, -1, 6.3, '6']) expect(parse(good(undefined, band))).toThrow('分数')
    expect(parse(good(), 'task1')).toThrow('缺少 TA')
    expect(parse({ ...good(), rewrites: good().rewrites.slice(0, 2) })).toThrow('改写')
    expect(parse({ ...good(), paragraphs: [] })).toThrow('逐段')
    expect(() => parseResult('not json', 'task2', 10)).toThrow('不是 JSON')
  })

  it('作文不足 3 句时改写至少 1 条即可', () => {
    expect(parse({ ...good(), rewrites: good().rewrites.slice(0, 1) }, 'task2', 2)().rewrites).toHaveLength(1)
  })

  it('作文指纹对首尾空白、换行符不敏感', () => {
    expect(essayHash('  a b\r\nc  ')).toBe(essayHash('a b\nc'))
    expect(essayHash('a b\nc')).not.toBe(essayHash('a  b\nc'))
  })
})

describe('写作批改：超时扫描', () => {
  it('pending 超过 3 分钟 → failed + 一条退回；再扫不重复退', async () => {
    const m = await mk(1)
    const task = (await payload.find({ collection: 'writing-tasks', overrideAccess: true, limit: 1, where: { taskType: { equals: 'task2' } } })).docs[0]
    const c = await charge(payload, { memberId: m.id, prefix: `review:${m.id}:${task.id}:stale` })
    if (!c.ok) throw new Error('扣费失败')
    const r = await payload.create({
      collection: 'writing-reviews',
      overrideAccess: true,
      data: { member: m.id, task: task.id, essay: 'x', essayHash: 'stale', words: 1, status: 'pending', spendEntry: c.id },
    })
    const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle
    await db.execute(sql`UPDATE writing_reviews SET created_at = now() - interval '4 minutes' WHERE id = ${r.id}`)
    expect(await expireStale(payload, { memberId: m.id })).toBe(1)
    expect(await expireStale(payload, { memberId: m.id })).toBe(0)
    const after = await payload.findByID({ collection: 'writing-reviews', id: r.id, overrideAccess: true, depth: 0 })
    expect(after.status).toBe('failed')
    expect(after.refundEntry).toBeTruthy()
    expect(await balance(payload, m.id)).toBe(1)
    expect(await sum(m.id)).toBe(1)
    await payload.delete({ collection: 'writing-reviews', id: r.id, overrideAccess: true })
  })
})

describe('错题讲解：缓存键、判错、出处句', () => {
  const single = { key: 'u1-g1', type: 'single_choice', instructions: '', options: [], questions: [{ number: 3, span: 1, options: [], answers: 'B' }] } as GroupView
  const multi = { key: 'u1-g2', type: 'multi_choice', instructions: '', options: [], questions: [{ number: 5, span: 2, options: [], answers: 'A\nC' }] } as GroupView
  const blank = { key: 'u1-g3', type: 'completion', instructions: '', maxWords: 3, options: [], questions: [{ number: 7, span: 1, options: [], answers: '(the) river bank' }] } as GroupView

  it('缓存键对大小写、多余空格、多选顺序不敏感；版本不同就不同', () => {
    expect(cacheKey('u1-g3', 7, 'v1', '  River   Side ')).toBe(cacheKey('u1-g3', 7, 'v1', 'river side'))
    expect(cacheKey('u1-g2', 5, 'v1', ['D', 'a'])).toBe(cacheKey('u1-g2', 5, 'v1', ['A', 'd']))
    expect(cacheKey('u1-g2', 5, 'v1', ['A', 'D'])).toBe('u1-g2#5|v1|a,d')
    expect(cacheKey('u1-g1', 3, 'v1', '')).toBe('u1-g1#3|v1|∅')
    expect(cacheKey('u1-g1', 3, 'v1', [])).toBe('u1-g1#3|v1|∅')
    expect(cacheKey('u1-g1', 3, 'v1', 'A')).not.toBe(cacheKey('u1-g1', 3, 'v2', 'A'))
  })

  it('答对的不算错，未作答和部分正确算错', () => {
    expect(isWrong(single, single.questions[0], 'b')).toBe(false)
    expect(isWrong(single, single.questions[0], 'A')).toBe(true)
    expect(isWrong(single, single.questions[0], '')).toBe(true)
    expect(isWrong(multi, multi.questions[0], ['C', 'A'])).toBe(false)
    expect(isWrong(multi, multi.questions[0], ['A', 'B'])).toBe(true)
    expect(isWrong(blank, blank.questions[0], 'the river bank')).toBe(false)
    expect(isWrong(blank, blank.questions[0], 'riverside')).toBe(true)
  })

  it('出处句取句号范围和所在段落，没有句号给整篇', () => {
    const section = {
      label: 'Passage 1',
      groups: [],
      passage: {
        title: 't',
        paragraphs: [
          { label: 'A', text: 'One. Two.', sentences: [{ n: 1, text: 'One.' }, { n: 2, text: 'Two.' }] },
          { label: 'B', text: 'Three.', sentences: [{ n: 3, text: 'Three.' }] },
        ],
      },
    } as Section
    expect(evidenceText(section, { number: 1, span: 1, options: [], answers: '', evidence: '2-3' })).toEqual({ evidence: 'Two. Three.', context: 'One. Two.\n\nThree.' })
    expect(evidenceText(section, { number: 1, span: 1, options: [], answers: '' })).toEqual({ evidence: '', context: 'A One. Two.\n\nB Three.' })
  })
})
