// @vitest-environment node
// 额度流水（011 FR-024）：余额 = 流水之和、扣减不越界、并发不出负数、退回 / 发放只一次、流水不可改删、权限
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { balance, grant, grantInvite, refund, spend } from '@/account/credits'
import type { Member } from '@/payload-types'

let payload: Payload
const PREFIX = 'e2e-credits-'
let n = 0
const mk = () =>
  payload.create({ collection: 'members', overrideAccess: true, data: { email: `${PREFIX}${Date.now()}-${n++}@example.test`, password: 'x'.repeat(32) } })
const admin = async () => (await payload.find({ collection: 'users', limit: 1 })).docs[0]
const asMember = (m: Member) => ({ user: { ...m, collection: 'members' as const }, overrideAccess: false })
// ValidationError 的 message 是通用的英文，具体原因在 data.errors 里
const reasonOf = (p: Promise<unknown>) =>
  p.then(
    () => '',
    (e: { data?: { errors?: { message: string }[] }; message: string }) => e.data?.errors?.map((x) => x.message).join(';') ?? e.message,
  )
const cleanup = () => payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: PREFIX } } })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
})
afterAll(cleanup)

describe('余额与扣减', () => {
  it('余额等于流水之和', async () => {
    const m = await mk()
    expect(await balance(payload, m.id)).toBe(0)
    for (const amount of [5, -2, 7]) await grant(payload, { memberId: m.id, amount, reason: 'adjust', note: 't' })
    expect(await balance(payload, m.id)).toBe(10)
  })

  it('余额不足时扣减被拒，不写流水', async () => {
    const m = await mk()
    await grant(payload, { memberId: m.id, amount: 2, reason: 'adjust', note: 't' })
    expect(await spend(payload, { memberId: m.id, amount: 3 })).toBeNull()
    const { totalDocs } = await payload.count({ collection: 'credit-entries', where: { member: { equals: m.id } } })
    expect(totalDocs).toBe(1)
  })

  it('并发 10 次扣减、余额只够 1 次：恰好成功 1 次（SC-005）', async () => {
    const m = await mk()
    await grant(payload, { memberId: m.id, amount: 1, reason: 'adjust', note: 't' })
    const results = await Promise.all(Array.from({ length: 10 }, () => spend(payload, { memberId: m.id, amount: 1 })))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await balance(payload, m.id)).toBe(0)
  })

  it('同一条消耗只能退回一次', async () => {
    const m = await mk()
    await grant(payload, { memberId: m.id, amount: 3, reason: 'adjust', note: 't' })
    const id = await spend(payload, { memberId: m.id, amount: 2 })
    expect(id).toBeTruthy()
    expect(await refund(payload, id!)).toBeTruthy()
    expect(await refund(payload, id!)).toBeNull()
    expect(await balance(payload, m.id)).toBe(3)
  })

  it('相同 refKey 只发一次', async () => {
    const m = await mk()
    const key = `test:${m.id}`
    expect(await grant(payload, { memberId: m.id, amount: 1, reason: 'note', refKey: key })).toBeTruthy()
    expect(await grant(payload, { memberId: m.id, amount: 1, reason: 'note', refKey: key })).toBeNull()
    expect(await balance(payload, m.id)).toBe(1)
  })

  it('流水不能修改或删除（管理员也不行）', async () => {
    const m = await mk()
    const e = await grant(payload, { memberId: m.id, amount: 1, reason: 'adjust', note: 't' })
    const user = { ...(await admin()), collection: 'users' as const }
    await expect(payload.update({ collection: 'credit-entries', id: e!.id, data: { amount: 99 }, user, overrideAccess: false })).rejects.toThrow()
    await expect(payload.delete({ collection: 'credit-entries', id: e!.id, user, overrideAccess: false })).rejects.toThrow()
  })
})

describe('后台人工调整与权限（US1）', () => {
  const adjust = async (memberId: number, amount: number, note: string) =>
    payload.create({
      collection: 'credit-entries',
      user: { ...(await admin()), collection: 'users' as const },
      overrideAccess: false,
      data: { member: memberId, amount, note, reason: 'note', refKey: 'should-be-cleared' },
    })

  it('人工调整：强制 adjust、必填备注、非 0、不能使余额为负', async () => {
    const m = await mk()
    const e = await adjust(m.id, 5, ' 测试 ')
    expect(e.reason).toBe('adjust')
    expect(e.refKey).toBeFalsy()
    expect(e.note).toBe('测试')
    expect(await reasonOf(adjust(m.id, 1, '  '))).toMatch(/备注/)
    expect(await reasonOf(adjust(m.id, 0, 'x'))).toMatch(/非 0/)
    expect(await reasonOf(adjust(m.id, -6, 'x'))).toMatch(/当前余额 5/)
    await adjust(m.id, -2, '纠错')
    expect(await balance(payload, m.id)).toBe(3)
  })

  it('考生只读得到自己的流水，不能写流水', async () => {
    const a = await mk()
    const b = await mk()
    await grant(payload, { memberId: a.id, amount: 1, reason: 'adjust', note: 't' })
    await grant(payload, { memberId: b.id, amount: 1, reason: 'adjust', note: 't' })
    const res = await payload.find({ collection: 'credit-entries', ...asMember(a), where: { member: { exists: true } } })
    expect(res.docs.length).toBe(1)
    expect(res.docs.every((d) => (typeof d.member === 'object' ? d.member.id : d.member) === a.id)).toBe(true)
    await expect(
      payload.create({ collection: 'credit-entries', ...asMember(a), data: { member: a.id, amount: 100, reason: 'adjust', note: 'x' } }),
    ).rejects.toThrow()
  })
})

describe('邀请（US2）', () => {
  const settings = () => payload.findGlobal({ slug: 'credit-settings' })
  const setSettings = (data: Record<string, number>) => payload.updateGlobal({ slug: 'credit-settings', data })

  it('有效码：双方各得奖励，记下邀请人；同一被邀请人只发一次', async () => {
    const s = await settings()
    const inviter = await mk()
    const invitee = await mk()
    const r = await grantInvite(payload, { inviteeId: invitee.id, code: inviter.inviteCode! })
    expect(r).toEqual({ amount: s.inviteeReward, inviterRewarded: true })
    expect(await balance(payload, invitee.id)).toBe(s.inviteeReward)
    expect(await balance(payload, inviter.id)).toBe(s.inviterReward)
    const me = await payload.findByID({ collection: 'members', id: invitee.id, depth: 0 })
    expect(me.invitedBy).toBe(inviter.id)
    expect(await grantInvite(payload, { inviteeId: invitee.id, code: inviter.inviteCode! })).toBeNull()
    expect(await balance(payload, inviter.id)).toBe(s.inviterReward)
  })

  it('无效码、自己邀请自己：不发放', async () => {
    const m = await mk()
    expect(await grantInvite(payload, { inviteeId: m.id, code: 'NOPE0000' })).toBeNull()
    expect(await grantInvite(payload, { inviteeId: m.id, code: m.inviteCode! })).toBeNull()
    expect(await balance(payload, m.id)).toBe(0)
  })

  it('邀请人达到上限后不再得，被邀请人照常得', async () => {
    const old = await settings()
    await setSettings({ inviterCap: 1, inviterReward: 3, inviteeReward: 5 })
    try {
      const inviter = await mk()
      const [b, c] = [await mk(), await mk()]
      expect((await grantInvite(payload, { inviteeId: b.id, code: inviter.inviteCode! }))?.inviterRewarded).toBe(true)
      expect(await grantInvite(payload, { inviteeId: c.id, code: inviter.inviteCode! })).toEqual({ amount: 5, inviterRewarded: false })
      expect(await balance(payload, inviter.id)).toBe(3)
      expect(await balance(payload, c.id)).toBe(5)
    } finally {
      await setSettings({ inviterCap: old.inviterCap, inviterReward: old.inviterReward, inviteeReward: old.inviteeReward })
    }
  })
})

describe('小红书笔记审核（US3）', () => {
  let png: Buffer
  beforeAll(async () => {
    const sharp = (await import('sharp')).default
    png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#888' } }).png().toBuffer()
  })
  const submit = async (m: Member) => {
    const shot = await payload.create({
      collection: 'note-screenshots',
      overrideAccess: true,
      data: { member: m.id },
      file: { data: png, mimetype: 'image/png', name: `e2e-${m.id}-${n++}.png`, size: png.length },
    })
    return payload.create({
      collection: 'note-submissions',
      overrideAccess: true,
      data: { member: m.id, url: 'https://xhslink.com/a/x', noteKey: `test:${m.id}:${n++}`, screenshot: shot.id, amount: 10, status: 'pending' },
    })
  }
  const review = async (id: number, data: Record<string, unknown>) =>
    payload.update({ collection: 'note-submissions', id, data, user: { ...(await admin()), collection: 'users' as const }, overrideAccess: false })

  it('通过时按填写的额度发放，再保存也不重复发；结论定了不能改', async () => {
    const m = await mk()
    const s = await submit(m)
    expect(s.status).toBe('pending')
    const done = await review(s.id, { status: 'approved', amount: 15 })
    expect(done.reviewedAt).toBeTruthy()
    expect(await balance(payload, m.id)).toBe(15)
    await review(s.id, { remark: 'x' }).catch(() => {})
    expect(await balance(payload, m.id)).toBe(15)
    expect(await reasonOf(review(s.id, { status: 'rejected', rejectPreset: '其他', rejectReason: 'x' }))).toMatch(/不能再修改/)
    expect(await reasonOf(review(s.id, { amount: 99 }))).toMatch(/不能再修改/)
    expect(await balance(payload, m.id)).toBe(15)
  })

  it('通过时额度必须是正整数；驳回必须有理由', async () => {
    const m = await mk()
    const s = await submit(m)
    expect(await reasonOf(review(s.id, { status: 'approved', amount: 0 }))).toMatch(/正整数/)
    expect(await reasonOf(review(s.id, { status: 'rejected' }))).toMatch(/驳回理由/)
    expect(await reasonOf(review(s.id, { status: 'rejected', rejectPreset: '其他', rejectReason: ' ' }))).toMatch(/填写理由/)
    const r = await review(s.id, { status: 'rejected', rejectPreset: '截图和链接对不上' })
    expect(r.status).toBe('rejected')
    expect(await balance(payload, m.id)).toBe(0)
  })

  it('考生只看得到自己的提交和截图，不能自己建提交、不能审核', async () => {
    const a = await mk()
    const b = await mk()
    const s = await submit(a)
    const shotId = typeof s.screenshot === 'object' ? s.screenshot.id : s.screenshot
    expect((await payload.find({ collection: 'note-submissions', ...asMember(b), where: { id: { equals: s.id } } })).docs).toHaveLength(0)
    expect((await payload.find({ collection: 'note-screenshots', ...asMember(b), where: { id: { equals: shotId } } })).docs).toHaveLength(0)
    await expect(payload.find({ collection: 'note-screenshots', overrideAccess: false, where: { id: { equals: shotId } } })).rejects.toThrow()
    expect((await payload.find({ collection: 'note-screenshots', ...asMember(a), where: { id: { equals: shotId } } })).docs).toHaveLength(1)
    await expect(payload.update({ collection: 'note-submissions', id: s.id, data: { status: 'approved' }, ...asMember(a) })).rejects.toThrow()
    await expect(
      payload.create({ collection: 'note-submissions', ...asMember(a), data: { member: a.id, url: 'u', screenshot: shotId, amount: 99, status: 'pending' } }),
    ).rejects.toThrow()
  })

  it('截图存在 private/ 下，不在 public/ 里', () => {
    const dir = String(payload.collections['note-screenshots'].config.upload.staticDir).replaceAll('\\', '/')
    expect(dir).toMatch(/\/private\/note-screenshots$/)
    expect(dir).not.toMatch(/\/public\//)
  })
})

describe('设置与删除考生（US4）', () => {
  it('考生读不到、改不了额度设置', async () => {
    const m = await mk()
    await expect(payload.findGlobal({ slug: 'credit-settings', ...asMember(m) })).rejects.toThrow()
    await expect(payload.updateGlobal({ slug: 'credit-settings', data: { inviteeReward: 99 }, ...asMember(m) })).rejects.toThrow()
  })

  it('后台考生详情带余额；考生自己读不到 balance 计算结果', async () => {
    const m = await mk()
    await grant(payload, { memberId: m.id, amount: 4, reason: 'adjust', note: 't' })
    const user = { ...(await admin()), collection: 'users' as const }
    expect((await payload.findByID({ collection: 'members', id: m.id, user, overrideAccess: false })).balance).toBe(4)
    expect((await payload.findByID({ collection: 'members', id: m.id, ...asMember(m) })).balance).toBeFalsy()
  })

  it('删除考生：他的流水和提交一起删，邀请人的流水还在', async () => {
    const inviter = await mk()
    const invitee = await mk()
    await grantInvite(payload, { inviteeId: invitee.id, code: inviter.inviteCode! })
    const before = await balance(payload, inviter.id)
    await payload.delete({ collection: 'members', id: invitee.id, overrideAccess: true })
    expect((await payload.count({ collection: 'credit-entries', where: { member: { equals: invitee.id } } })).totalDocs).toBe(0)
    expect(await balance(payload, inviter.id)).toBe(before)
    const left = await payload.find({ collection: 'credit-entries', depth: 0, where: { member: { equals: inviter.id } } })
    expect(left.docs.every((d) => d.relatedMember == null)).toBe(true)
  })
})
