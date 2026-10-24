// @vitest-environment node
// 031 答案纠错举报：提交校验与查重、快照取自服务端、每日上限、审核只发一次、终态锁定、权限、同题审核中计数
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { balance } from '@/account/credits'
import { getPracticeUnit } from '@/content/practiceUnit'
import { answerReportEndpoints, reportContextEndpoint } from '@/endpoints/answerReports'
import type { Member, User } from '@/payload-types'

let payload: Payload
let admin: User
const PREFIX = 'e2e-areport-'
let n = 0
// 本机题库里随便一个已发布的单元，只读不改
let unitDoc = 0
let nums: number[] = []
let realAnswers = ''

const [postEp, getEp] = answerReportEndpoints
const mk = () =>
  payload.create({ collection: 'members', overrideAccess: true, data: { email: `${PREFIX}${Date.now()}-${n++}@example.test`, password: 'x'.repeat(32) } })
const call = async (ep: typeof postEp, user: unknown, body?: unknown, search = '') => {
  const req = {
    payload,
    user,
    headers: new Headers(),
    json: async () => body,
    searchParams: new URLSearchParams(search),
  } as unknown as PayloadRequest
  const res = (await ep.handler(req)) as Response
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const as = (m: Member) => ({ ...m, collection: 'members' })
const report = (m: Member, data: Record<string, unknown>) =>
  call(postEp, as(m), { unitId: `u${unitDoc}`, number: nums[0], kind: 'accept', answer: '13th of June', ...data })
const review = (id: number, data: Record<string, unknown>) =>
  payload.update({ collection: 'answer-reports', id, data, user: { ...admin, collection: 'users' }, overrideAccess: false })
const entries = async (m: Member) =>
  (await payload.find({ collection: 'credit-entries', overrideAccess: true, where: { member: { equals: m.id }, reason: { equals: 'report' } } })).docs
const cleanup = () => payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: PREFIX } } })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true })).docs[0]
  await cleanup()
  const units = await payload.find({ collection: 'units', where: { _status: { equals: 'published' } }, limit: 1, depth: 0, overrideAccess: true })
  unitDoc = units.docs[0].id
  const unit = (await getPracticeUnit(`u${unitDoc}`))!
  const qs = unit.sections.flatMap((s) => s.groups.flatMap((g) => g.questions))
  nums = qs.map((q) => q.number)
  realAnswers = qs[0].answers
})
afterAll(cleanup)

describe('提交', () => {
  it('未登录 401；题号不存在 404；类型不对 400；accept 空作答 400', async () => {
    expect((await call(postEp, null, { unitId: `u${unitDoc}`, number: nums[0], kind: 'accept', answer: 'x' })).status).toBe(401)
    const m = await mk()
    expect((await report(m, { number: 9999 })).status).toBe(404)
    expect((await report(m, { unitId: 'nonsense' })).status).toBe(404)
    expect((await report(m, { kind: 'hack' })).status).toBe(400)
    expect((await report(m, { answer: '  ' })).status).toBe(400)
    expect((await report(m, { kind: 'wrong', answer: '' })).status).toBe(201)
  })

  it('快照取自服务端；带 group 的 unitId 归一，同题再报 409', async () => {
    const m = await mk()
    const r = await report(m, { unitId: `u${unitDoc}-g1`, keySnapshot: 'FAKE', remark: '日期写法' })
    expect(r.status).toBe(201)
    const doc = await payload.findByID({ collection: 'answer-reports', id: r.body.id as number, overrideAccess: true })
    expect(doc.unitKey).toBe(`u${unitDoc}`)
    expect(doc.keySnapshot).toBe(realAnswers)
    expect(doc.answerKey).toBe('13th of june')
    expect(doc.amount).toBe((await payload.findGlobal({ slug: 'credit-settings', overrideAccess: true })).reportDefault)
    expect((await report(m, {})).status).toBe(409)
  })

  it('驳回后：同一作答 409，换作答 201', async () => {
    const m = await mk()
    const r = await report(m, {})
    await review(r.body.id as number, { status: 'rejected', rejectPreset: '判分正确' })
    expect((await report(m, { answer: '13TH of june' })).status).toBe(409)
    expect((await report(m, { answer: 'June 13th' })).status).toBe(201)
  })

  it('每人每天 20 条，第 21 条 429', async () => {
    const m = await mk()
    // 单元题数可能不到 20，前 20 条直接写库（上限按本人近 24 小时条数算，不分题）
    for (let i = 0; i < 20; i++)
      await payload.create({
        collection: 'answer-reports',
        overrideAccess: true,
        data: { member: m.id, unitKey: `u${unitDoc}`, number: 1000 + i, kind: 'other', status: 'rejected', rejectPreset: '其他', rejectReason: 't' },
      })
    expect((await report(m, {})).status).toBe(429)
  })

  it('GET 只返回本人在该单元的举报', async () => {
    const [a, b] = [await mk(), await mk()]
    await report(a, {})
    await report(b, {})
    const r = await call(getEp, as(a), undefined, `unitKey=u${unitDoc}-g1`)
    expect(r.body.items).toEqual([{ number: nums[0], status: 'pending', answerKey: '13th of june' }])
  })
})

describe('审核', () => {
  it('通过只发一次：重复保存、并发保存都只得一条流水；余额 = 流水之和', async () => {
    const m = await mk()
    const r = await report(m, {})
    const id = r.body.id as number
    await Promise.allSettled([review(id, { status: 'approved', amount: 3 }), review(id, { status: 'approved', amount: 3 })])
    await review(id, { status: 'approved', amount: 3 }).catch(() => null)
    expect(await entries(m)).toHaveLength(1)
    expect(await balance(payload, m.id)).toBe(3)
  })

  it('终态后不能改；通过要正整数；驳回要理由', async () => {
    const m = await mk()
    const id = (await report(m, {})).body.id as number
    await expect(review(id, { status: 'approved', amount: 0 })).rejects.toThrow()
    await expect(review(id, { status: 'rejected' })).rejects.toThrow()
    await expect(review(id, { status: 'rejected', rejectPreset: '其他' })).rejects.toThrow()
    await review(id, { status: 'rejected', rejectPreset: '超出字数限制' })
    await expect(review(id, { status: 'approved', amount: 3 })).rejects.toThrow()
    expect(await entries(m)).toHaveLength(0)
  })

  it('考生只能读到自己的', async () => {
    const [a, b] = [await mk(), await mk()]
    await report(a, {})
    await report(b, {})
    const seen = await payload.find({ collection: 'answer-reports', user: as(a), overrideAccess: false })
    expect(seen.docs.every((d) => (typeof d.member === 'object' ? d.member.id : d.member) === a.id)).toBe(true)
    expect(seen.totalDocs).toBe(1)
  })

  it('context：管理员可用、考生 403；同作答已通过提示；同题审核中计数', async () => {
    const [a, b, c] = [await mk(), await mk(), await mk()]
    // 用另一道题，免得和前面的用例混在一起
    const number = nums[nums.length - 1]
    const ra = (await report(a, { number })).body.id as number
    const rb = (await report(b, { number })).body.id as number
    const rc = (await report(c, { number, answer: 'other answer' })).body.id as number
    const ctxOf = (id: number, user: unknown) => call(reportContextEndpoint as typeof postEp, user, undefined, `id=${id}`)

    expect((await ctxOf(ra, as(a))).status).toBe(403)
    const before = (await payload.findByID({ collection: 'answer-reports', id: rb, overrideAccess: true })).pendingOnSame
    await review(ra, { status: 'approved', amount: 3 })
    const after = (await payload.findByID({ collection: 'answer-reports', id: rb, overrideAccess: true })).pendingOnSame
    expect(after).toBe((before as number) - 1)

    const cb = await ctxOf(rb, { ...admin, collection: 'users' })
    expect(cb.status).toBe(200)
    expect(cb.body).toMatchObject({ missing: false, currentAnswers: expect.any(String), editHref: `/admin/collections/units/${unitDoc}`, duplicateApproved: true })
    expect(cb.body.sameCount).toBeGreaterThanOrEqual(2)
    expect((await ctxOf(rc, { ...admin, collection: 'users' })).body.duplicateApproved).toBe(false)
  })

  it('删除考生时连同举报一起删', async () => {
    const m = await mk()
    await report(m, {})
    await payload.delete({ collection: 'members', id: m.id, overrideAccess: true })
    expect((await payload.count({ collection: 'answer-reports', overrideAccess: true, where: { member: { equals: m.id } } })).totalDocs).toBe(0)
  })
})
