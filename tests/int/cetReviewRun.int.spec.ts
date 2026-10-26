// @vitest-environment node
// 034 T012：四 / 六级批改走 015 同一条流水线——成功写原始分与结果，不合格算失败并退回（需要本地数据库；AI 调用换成假的）
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { balance, grant } from '@/account/credits'
import config from '@/payload.config'
import { charge } from '@/review/charge'
import { runReview } from '@/review/writing'

const reply = vi.hoisted(() => ({ content: '' }))
vi.mock('@/ai/chat', () => ({
  loadAi: async () => ({ baseUrl: 'http://ai.test', apiKey: 'k', model: 'fake' }),
  chat: async () => ({ content: reply.content, usage: { prompt: 1, completion: 1, ms: 1, model: 'fake' } }),
}))

const PREFIX = 'e2e-cetrun-'
const good = {
  score: 8,
  reason: '勉强表达原文意思。',
  sentences: [{ zh: '四合院是传统住宅。', mine: 'Siheyuan is old house.', issue: '用词不准', suggestion: 'Siheyuan is a traditional residence.' }],
  summary: '注意用词。',
}

let payload: Payload
let taskId: number
let memberId: number

const submit = async (essay: string) => {
  const c = await charge(payload, { memberId, prefix: `review:${memberId}:${taskId}:${essay.length}`, note: '写作批改' })
  if (!c.ok) throw new Error(c.reason)
  const r = await payload.create({
    collection: 'writing-reviews',
    overrideAccess: true,
    data: { member: memberId, task: taskId, essay, essayHash: `h${essay.length}`, words: 4, status: 'pending', spendEntry: c.id },
  })
  await runReview(payload, r.id)
  return payload.findByID({ collection: 'writing-reviews', id: r.id, overrideAccess: true, depth: 0 })
}

const cleanup = async () => {
  // 批改记录引用考生和题目，先删
  const ms = (await payload.find({ collection: 'members', overrideAccess: true, where: { email: { like: PREFIX } }, limit: 50, depth: 0 })).docs.map((m) => m.id)
  if (ms.length) await payload.delete({ collection: 'writing-reviews', overrideAccess: true, where: { member: { in: ms } } })
  await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: PREFIX } } })
  await payload.delete({ collection: 'writing-tasks', overrideAccess: true, where: { sourceId: { like: PREFIX } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
  const t = await payload.create({
    collection: 'writing-tasks',
    overrideAccess: true,
    data: {
      taskType: 'cet_translation',
      exam: 'cet4',
      paper: '2099-01-1',
      title: '测试翻译',
      prompt: 'For this part, translate.\n\n四合院是传统住宅。',
      sampleAnswer: 'Siheyuan is a traditional residence.',
      sourceType: 'original',
      sourceId: `${PREFIX}t`,
      _status: 'published',
    },
  })
  taskId = t.id
  const m = await payload.create({ collection: 'members', overrideAccess: true, data: { email: `${PREFIX}${Date.now()}@example.test`, password: 'x'.repeat(32) } })
  memberId = m.id
  await grant(payload, { memberId, amount: 2, reason: 'adjust', note: 't' })
})
afterAll(cleanup)

describe('四 / 六级批改执行', () => {
  it('合格：done，存原始分和逐句对照，overall 为空，扣 1', async () => {
    reply.content = JSON.stringify(good)
    const r = await submit('Siheyuan is old house.')
    expect(r.status).toBe('done')
    expect(r.score).toBe(8)
    expect((r.cet as { sentences: unknown[] }).sentences).toHaveLength(1)
    expect(r.overall ?? null).toBeNull()
    expect(await balance(payload, memberId)).toBe(1)
  })

  it('不合格：failed，有退回流水，余额回到原值', async () => {
    reply.content = JSON.stringify({ ...good, score: 99 })
    const r = await submit('Another try at it.')
    expect(r.status).toBe('failed')
    expect(r.refundEntry).toBeTruthy()
    expect(await balance(payload, memberId)).toBe(1)
  })
})
