import type { Endpoint, PayloadRequest } from 'payload'

import { balance, refund } from '../account/credits'
import { loadAi } from '../ai/chat'
import { countWords } from '../exam/scoring'
import type { WritingReview, WritingTask } from '../payload-types'
import { CET_LIMITS, isCetTask } from '../review/cet'
import { charge } from '../review/charge'
import { essayHash, expireStale, LIMITS, MAX_CHARS, normalizeEssay, runReview } from '../review/writing'

// 写作批改（015 contracts/api.md）：只认考生登录；记录只能经这里读写
const fail = (error: string, status: number, extra: object = {}) => Response.json({ error, ...extra }, { status })
const memberOf = (req: PayloadRequest) => (req.user?.collection === 'members' ? (req.user.id as number) : null)

// 本人同题同作文、未失败的那条（FR-024、FR-005）
const existing = async (req: PayloadRequest, memberId: number, taskId: number, hash: string) =>
  (
    await req.payload.find({
      collection: 'writing-reviews',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      sort: '-createdAt',
      where: { member: { equals: memberId }, task: { equals: taskId }, essayHash: { equals: hash }, status: { in: ['pending', 'done'] } },
    })
  ).docs[0]

const submit: Endpoint = {
  path: '/me/writing-reviews',
  method: 'post',
  handler: async (req) => {
    const memberId = memberOf(req)
    if (!memberId) return fail('请先登录', 401)
    const data = ((await req.json?.()) ?? {}) as { taskId?: unknown; essay?: unknown }
    const taskId = Number(data.taskId)
    const essay = typeof data.essay === 'string' ? normalizeEssay(data.essay) : ''
    const { payload } = req

    const task = Number.isInteger(taskId)
      ? ((
          await payload.find({ collection: 'writing-tasks', overrideAccess: true, depth: 0, limit: 1, where: { id: { equals: taskId }, _status: { equals: 'published' } } })
        ).docs[0] as WritingTask | undefined)
      : undefined
    if (!task) return fail('题目不存在', 404)
    // 034：四 / 六级写作、翻译也能批改，字数上下限另算
    const cet = isCetTask(task.taskType)
    if (!cet && task.taskType !== 'task1' && task.taskType !== 'task2') return fail('not_reviewable', 409)
    if (task.taskType === 'task1' && !task.chartData?.trim()) return fail('not_reviewable', 409)
    if (essay.length > MAX_CHARS) return fail('too_long', 400, { max: MAX_CHARS })
    const words = countWords(essay)
    const { min, max } = isCetTask(task.taskType) ? CET_LIMITS[task.taskType] : LIMITS[task.taskType as 'task1' | 'task2']
    if (words < min || words > max) return fail('words', 400, { min, max, words })
    if (!(await loadAi(payload))) return fail('ai_unavailable', 503)

    const hash = essayHash(essay)
    const prev = await existing(req, memberId, task.id, hash)
    if (prev) return Response.json({ id: prev.id, status: prev.status, reused: true })

    const c = await charge(payload, { memberId, prefix: `review:${memberId}:${task.id}:${hash}`, note: '写作批改' })
    if (!c.ok) {
      if (c.reason === 'rate') return fail('rate', 429)
      if (c.reason === 'balance') return fail('balance', 402, { balance: await balance(payload, memberId) })
      // duplicate：同一篇同时到达的另一个请求已经扣了，等它把记录建好再返回
      for (let i = 0; i < 20; i++) {
        const other = await existing(req, memberId, task.id, hash)
        if (other) return Response.json({ id: other.id, status: other.status, reused: true })
        await new Promise((r) => setTimeout(r, 100))
      }
      return fail('busy', 409)
    }

    let review: WritingReview
    try {
      review = await payload.create({
        collection: 'writing-reviews',
        overrideAccess: true,
        data: { member: memberId, task: task.id, essay, essayHash: hash, words, status: 'pending', spendEntry: c.id },
      })
    } catch (e) {
      await refund(payload, c.id)
      throw e
    }
    void runReview(payload, review.id)
    return Response.json({ id: review.id, status: 'pending', balance: await balance(payload, memberId) }, { status: 202 })
  },
}

export const reviewView = (r: WritingReview) => {
  if (r.status === 'failed') return { id: r.id, status: r.status, refunded: true }
  const t = r.task as WritingTask | null
  return {
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    task: t
      ? { id: t.id, title: t.title, taskType: t.taskType, exam: t.exam, minWords: t.minWords, removed: t._status !== 'published' }
      : { id: null, title: '', taskType: null, exam: null, minWords: null, removed: true },
    essay: r.essay,
    words: r.words,
    overall: r.overall,
    criteria: r.criteria,
    paragraphs: r.paragraphs,
    rewrites: r.rewrites,
    lengthNote: r.lengthNote ?? '',
    // 034 四 / 六级：原始分和结果主体；雅思为 null
    score: r.score ?? null,
    cet: r.cet ?? null,
  }
}

// 本人的批改列表（只 done 和 pending，FR-021），?task= 限定一道题，每页 20
const list: Endpoint = {
  path: '/me/writing-reviews',
  method: 'get',
  handler: async (req) => {
    const memberId = memberOf(req)
    if (!memberId) return fail('请先登录', 401)
    await expireStale(req.payload, { memberId })
    const taskId = Number(req.searchParams.get('task'))
    const res = await req.payload.find({
      collection: 'writing-reviews',
      overrideAccess: true,
      depth: 1,
      limit: 20,
      page: Math.max(1, Math.floor(Number(req.searchParams.get('page')) || 1)),
      sort: '-createdAt',
      where: {
        member: { equals: memberId },
        status: { in: ['pending', 'done'] },
        ...(Number.isInteger(taskId) && taskId > 0 ? { task: { equals: taskId } } : {}),
      },
    })
    return Response.json({
      docs: res.docs.map((r) => {
        const t = r.task as WritingTask | null
        return {
          id: r.id,
          taskId: t?.id ?? null,
          taskTitle: t?.title ?? '',
          taskType: t?.taskType ?? null,
          exam: t?.exam ?? null,
          status: r.status,
          overall: r.overall,
          score: r.score ?? null,
          createdAt: r.createdAt,
        }
      }),
      totalPages: res.totalPages,
    })
  },
}

const detail: Endpoint = {
  path: '/me/writing-reviews/:id',
  method: 'get',
  handler: async (req) => {
    const memberId = memberOf(req)
    if (!memberId) return fail('请先登录', 401)
    const id = Number(req.routeParams?.id)
    if (!Number.isInteger(id)) return fail('没有这条批改', 404)
    await expireStale(req.payload, { memberId })
    const r = (
      await req.payload.find({
        collection: 'writing-reviews',
        overrideAccess: true,
        depth: 1,
        limit: 1,
        where: { id: { equals: id }, member: { equals: memberId } },
      })
    ).docs[0]
    if (!r) return fail('没有这条批改', 404)
    return Response.json(reviewView(r))
  },
}

export const writingReviewEndpoints = [submit, list, detail]
