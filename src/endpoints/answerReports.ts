import type { Endpoint, Payload } from 'payload'

import { isAdmin } from '../access/authenticated'
import { getSettings } from '../account/credits'
import { getPracticeUnit } from '../content/practiceUnit'
import { parseUnitId, unitId } from '../exam/practice'
import { findQuestion } from '../review/explain'
import { answerKey } from '../review/explainKey'

// 答案纠错举报（031 contracts/api.md）。题目位置归一成整篇 / 整套（u12、t5-l）+ 题号：
// 不管从按题型、按 Part、整套还是模考进来，同一道题是同一个键（research R3）
const MAX = 200
const DAILY = 20
const KINDS = ['accept', 'wrong', 'other'] as const

const fail = (error: string, status: number) => Response.json({ error }, { status })
const memberOf = (user: { collection?: string; id?: unknown } | null | undefined) => (user?.collection === 'members' ? (user.id as number) : null)

/** 任意形式的 unitId → 整篇 / 整套的键；认不出返回 null */
export const unitKeyOf = (id: unknown) => {
  const p = typeof id === 'string' ? parseUnitId(id) : null
  if (!p) return null
  return p.kind === 'unit' ? unitId({ kind: 'unit', docId: p.docId }) : unitId({ kind: 'test', docId: p.docId, module: p.module })
}

const findIn = async (unitKey: string, number: number) => {
  const unit = await getPracticeUnit(unitKey)
  const found = unit ? findQuestion(unit, number) : null
  return unit && found ? { unit, ...found } : null
}

const post: Endpoint = {
  path: '/me/answer-reports',
  method: 'post',
  handler: async (req) => {
    const memberId = memberOf(req.user)
    if (!memberId) return fail('请先登录', 401)
    const { payload } = req
    const data = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
    const unitKey = unitKeyOf(data.unitId)
    const number = Number(data.number)
    const found = unitKey && Number.isInteger(number) ? await findIn(unitKey, number) : null
    if (!unitKey || !found) return fail('题目不存在', 404)
    const kind = KINDS.find((k) => k === data.kind)
    if (!kind) return fail('请选择举报类型', 400)

    const a = data.answer
    const given = Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : typeof a === 'string' ? a : ''
    const answer = (Array.isArray(given) ? given.join('、') : given).trim().slice(0, MAX)
    if (kind === 'accept' && !answer) return fail('没作答时不能选"我的答案也应该算对"', 400)
    const key = answerKey(Array.isArray(given) ? given.map((x) => x.slice(0, MAX)) : answer)
    const remark = typeof data.remark === 'string' ? data.remark.trim().slice(0, MAX) : ''

    // ponytail: 应用层查重有竞态（并发最多多出一条重复的审核中，站长按"重复举报"驳回）；真遇到再加部分唯一索引（research R5）
    const mine = { member: { equals: memberId } }
    const [dup, today] = await Promise.all([
      payload.count({
        collection: 'answer-reports',
        overrideAccess: true,
        where: {
          and: [
            mine,
            { unitKey: { equals: unitKey } },
            { number: { equals: number } },
            { or: [{ status: { in: ['pending', 'approved'] } }, { answerKey: { equals: key } }] },
          ],
        },
      }),
      payload.count({
        collection: 'answer-reports',
        overrideAccess: true,
        where: { and: [mine, { createdAt: { greater_than: new Date(Date.now() - 24 * 3600_000).toISOString() } }] },
      }),
    ])
    if (dup.totalDocs) return fail('这道题你已经举报过了', 409)
    if (today.totalDocs >= DAILY) return fail('今天举报次数已用完，明天再来', 429)

    const { group, q, unit } = found
    const sourceTag =
      unit.source === 'unit'
        ? ((await payload.findByID({ collection: 'units', id: unit.docId, depth: 0, overrideAccess: true }).catch(() => null))?.sourceTag ?? null)
        : null
    const { reportDefault } = await getSettings(payload)
    const doc = await payload.create({
      collection: 'answer-reports',
      overrideAccess: true,
      data: {
        member: memberId,
        unitKey,
        number,
        module: unit.module,
        sourceTag,
        kind,
        answer,
        answerKey: key,
        keySnapshot: q.answers,
        qType: group.type,
        maxWords: group.maxWords ?? null,
        numberAllowed: Boolean(group.numberAllowed),
        remark,
        status: 'pending',
        amount: reportDefault,
      },
    })
    return Response.json({ id: doc.id, status: doc.status }, { status: 201 })
  },
}

const get: Endpoint = {
  path: '/me/answer-reports',
  method: 'get',
  handler: async (req) => {
    const memberId = memberOf(req.user)
    if (!memberId) return fail('请先登录', 401)
    const unitKey = unitKeyOf(req.searchParams.get('unitKey'))
    if (!unitKey) return Response.json({ items: [] })
    const res = await req.payload.find({
      collection: 'answer-reports',
      overrideAccess: true,
      depth: 0,
      limit: 500,
      sort: '-createdAt',
      where: { member: { equals: memberId }, unitKey: { equals: unitKey } },
    })
    return Response.json({ items: res.docs.map((d) => ({ number: d.number, status: d.status, answerKey: d.answerKey })) })
  },
}

const editHref = (unitKey: string) => {
  const p = parseUnitId(unitKey)
  return p ? `/admin/collections/${p.kind === 'unit' ? 'units' : 'tests'}/${p.docId}` : null
}

export const reportContext = async (payload: Payload, id: number) => {
  const r = await payload.findByID({ collection: 'answer-reports', id, depth: 0, overrideAccess: true })
  const same = { unitKey: { equals: r.unitKey }, number: { equals: r.number } }
  const [found, others, dupApproved] = await Promise.all([
    findIn(r.unitKey, r.number),
    payload.count({ collection: 'answer-reports', overrideAccess: true, where: { ...same, id: { not_equals: id } } }),
    payload.count({
      collection: 'answer-reports',
      overrideAccess: true,
      where: { ...same, id: { not_equals: id }, answerKey: { equals: r.answerKey }, status: { equals: 'approved' } },
    }),
  ])
  return {
    missing: !found,
    currentAnswers: found ? found.q.answers : null,
    editHref: editHref(r.unitKey),
    practiceHref: `/practice/${r.unitKey}`,
    sameCount: others.totalDocs,
    sameHref: `/admin/collections/answer-reports?where[unitKey][equals]=${encodeURIComponent(r.unitKey)}&where[number][equals]=${r.number}`,
    duplicateApproved: dupApproved.totalDocs > 0,
  }
}

// 挂在集合上（/api/answer-reports/context），Payload 先匹配集合自定义接口，不会被当成 /:id
export const reportContextEndpoint: Endpoint = {
  path: '/context',
  method: 'get',
  handler: async (req) => {
    if (!isAdmin(req.user)) return fail('没有权限', 403)
    const id = Number(req.searchParams.get('id'))
    if (!Number.isInteger(id)) return fail('举报不存在', 404)
    const out = await reportContext(req.payload, id).catch(() => null)
    return out ? Response.json(out) : fail('举报不存在', 404)
  },
}

export const answerReportEndpoints = [post, get]
