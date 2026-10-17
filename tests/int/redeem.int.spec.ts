// @vitest-environment node
// 016 注册赠送与兑换码（FR-017）：注册赠送只发一次、兑换各种结果、并发次数不超、余额 = 流水之和、考生碰不到兑换码
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { balance, grantSignup, redeem } from '@/account/credits'
import { formatCode } from '@/collections/RedeemCodes'
import type { CreditSetting, Member } from '@/payload-types'

let payload: Payload
let original: CreditSetting
const PREFIX = 'e2e-redeem-'
let n = 0
const mk = () =>
  payload.create({ collection: 'members', overrideAccess: true, data: { email: `${PREFIX}${Date.now()}-${n++}@example.test`, password: 'x'.repeat(32) } })
const mkCode = (data: { amount: number; maxUses?: number; expiresAt?: string }) =>
  payload.create({ collection: 'redeem-codes', overrideAccess: true, data: { ...data, note: PREFIX } as never })
const asMember = (m: Member) => ({ user: { ...m, collection: 'members' as const }, overrideAccess: false })
const setSignup = (signupReward: number) => payload.updateGlobal({ slug: 'credit-settings', overrideAccess: true, data: { signupReward } })
const entries = async (memberId: number) =>
  (await payload.find({ collection: 'credit-entries', overrideAccess: true, limit: 100, where: { member: { equals: memberId } } })).docs
const cleanup = async () => {
  await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: PREFIX } } })
  await payload.delete({ collection: 'redeem-codes', overrideAccess: true, where: { note: { equals: PREFIX } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  original = await payload.findGlobal({ slug: 'credit-settings', overrideAccess: true })
  await cleanup()
})
afterAll(async () => {
  await setSignup(original.signupReward)
  await cleanup()
})

describe('注册赠送', () => {
  it('发放一次，重复调用不再发', async () => {
    await setSignup(10)
    const m = await mk()
    expect(await grantSignup(payload, m.id)).toBe(10)
    expect(await grantSignup(payload, m.id)).toBe(0)
    expect((await entries(m.id)).map((e) => e.reason)).toEqual(['signup'])
    expect(await balance(payload, m.id)).toBe(10)
  })

  it('设置为 0 时不写流水', async () => {
    await setSignup(0)
    const m = await mk()
    expect(await grantSignup(payload, m.id)).toBe(0)
    expect(await entries(m.id)).toHaveLength(0)
  })
})

describe('兑换码管理', () => {
  it('码由系统生成，传入的值和后续修改都不生效', async () => {
    const c = await payload.create({ collection: 'redeem-codes', overrideAccess: true, data: { code: 'ABC', amount: 1, note: PREFIX } as never })
    expect(c.code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}(-[A-HJ-KM-NP-Z2-9]{4}){3}$/)
    const admin = (await payload.find({ collection: 'users', limit: 1 })).docs[0]
    const u = await payload.update({
      collection: 'redeem-codes',
      id: c.id,
      data: { code: 'XXXX-XXXX-XXXX-XXXX', amount: 2 },
      user: { ...admin, collection: 'users' as const },
      overrideAccess: false,
    })
    expect(u.code).toBe(c.code)
    expect(u.amount).toBe(2)
  })

  it('输入规范化', () => {
    expect(formatCode(' abcd efgh-ijkm npqr ')).toBe('ABCD-EFGH-IJKM-NPQR')
    expect(formatCode('')).toBe('')
  })

  it('考生不能读、建、改兑换码', async () => {
    const m = await mk()
    const c = await mkCode({ amount: 1 })
    await expect(payload.find({ collection: 'redeem-codes', ...asMember(m) })).rejects.toThrow()
    await expect(payload.create({ collection: 'redeem-codes', data: { amount: 1 } as never, ...asMember(m) })).rejects.toThrow()
    await expect(payload.update({ collection: 'redeem-codes', id: c.id, data: { amount: 99 }, ...asMember(m) })).rejects.toThrow()
  })
})

describe('兑换', () => {
  it('成功、重复、领完、过期、不存在', async () => {
    const [a, b] = [await mk(), await mk()]
    const c = await mkCode({ amount: 5, maxUses: 1 })
    expect(await redeem(payload, { memberId: a.id, code: c.code })).toEqual({ ok: true, amount: 5 })
    expect((await entries(a.id))[0]).toMatchObject({ reason: 'redeem', amount: 5 })
    expect(await redeem(payload, { memberId: a.id, code: c.code })).toEqual({ ok: false, reason: 'used' })
    expect(await redeem(payload, { memberId: b.id, code: c.code })).toEqual({ ok: false, reason: 'exhausted' })

    const expired = await mkCode({ amount: 5, expiresAt: new Date().toISOString() })
    expect(await redeem(payload, { memberId: b.id, code: expired.code })).toEqual({ ok: false, reason: 'expired' })
    expect(await redeem(payload, { memberId: b.id, code: 'AAAA-AAAA-AAAA-AAAA' })).toEqual({ ok: false, reason: 'missing' })
    expect(await balance(payload, b.id)).toBe(0)

    const read = await payload.findByID({ collection: 'redeem-codes', id: c.id, overrideAccess: true })
    expect(read.used).toBe(1)
  })

  it('次数为 1 的码被 10 人并发兑换，恰好成功 1 次（SC-004）', async () => {
    const members = await Promise.all(Array.from({ length: 10 }, mk))
    const c = await mkCode({ amount: 3, maxUses: 1 })
    const results = await Promise.all(members.map((m) => redeem(payload, { memberId: m.id, code: c.code })))
    expect(results.filter((r) => r.ok)).toHaveLength(1)
  })

  it('同一考生并发 5 次只成功 1 次；余额 = 流水之和（SC-005）', async () => {
    const m = await mk()
    const c = await mkCode({ amount: 4, maxUses: 10 })
    const results = await Promise.all(Array.from({ length: 5 }, () => redeem(payload, { memberId: m.id, code: c.code })))
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    const sum = (await entries(m.id)).reduce((s, e) => s + e.amount, 0)
    expect(await balance(payload, m.id)).toBe(sum)
    expect(sum).toBe(4)
  })
})
