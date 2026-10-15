// 验证码与限频（009 FR-002、FR-003、research R3）
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { checkRate, hashCode, issue, MAX_ATTEMPTS, newCode, normalizeEmail, verify } from '@/account/codes'

let payload: Payload
const E = 'e2e-codes@example.test'

const clean = async () => {
  await payload.delete({ collection: 'login-codes', where: { email: { like: 'e2e-codes' } } })
  await payload.delete({ collection: 'email-sends', where: { email: { like: 'e2e-codes' } } })
  await payload.delete({ collection: 'email-sends', where: { ip: { equals: '203.0.113.9' } } })
}
const fakeSend = (email: string, ip: string, ago = 0) =>
  payload.db.create({
    collection: 'email-sends',
    data: { email, ip, kind: 'code', via: 'primary', ok: true, createdAt: new Date(Date.now() - ago).toISOString() },
  })

describe('验证码', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })
  beforeEach(clean)
  afterAll(clean)

  it('6 位数字；哈希随邮箱变化；邮箱统一小写去空格', () => {
    expect(newCode()).toMatch(/^\d{6}$/)
    expect(hashCode(E, '123456')).toBe(hashCode(E, '123456'))
    expect(hashCode(E, '123456')).not.toBe(hashCode('e2e-other@example.test', '123456'))
    expect(normalizeEmail('  E2E-Codes@Example.TEST ')).toBe(E)
  })

  it('库里不存明文', async () => {
    const code = await issue(payload, E)
    const rows = await payload.find({ collection: 'login-codes', where: { email: { equals: E } } })
    expect(JSON.stringify(rows.docs)).not.toContain(code)
  })

  it('答对一次后不能再用', async () => {
    const code = await issue(payload, E)
    expect(await verify(payload, E, code)).toEqual({ ok: true })
    expect(await verify(payload, E, code)).toEqual({ ok: false, reason: 'expired' })
  })

  it('错 5 次作废，之后答对也不行', async () => {
    const code = await issue(payload, E)
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 1; i <= MAX_ATTEMPTS; i++) expect(await verify(payload, E, wrong)).toEqual({ ok: false, reason: 'wrong', left: MAX_ATTEMPTS - i })
    expect(await verify(payload, E, code)).toEqual({ ok: false, reason: 'expired' })
  })

  it('并发猜码也最多算 5 次', async () => {
    const code = await issue(payload, E)
    const wrong = code === '000000' ? '111111' : '000000'
    const results = await Promise.all(Array.from({ length: 20 }, () => verify(payload, E, wrong)))
    expect(results.filter((r) => !r.ok && r.reason === 'wrong')).toHaveLength(MAX_ATTEMPTS)
    expect(await verify(payload, E, code)).toEqual({ ok: false, reason: 'expired' })
  })

  it('新码发出后旧码作废', async () => {
    const old = await issue(payload, E)
    const fresh = await issue(payload, E)
    if (old !== fresh) expect((await verify(payload, E, old)).ok).toBe(false)
    expect(await verify(payload, E, fresh)).toEqual({ ok: true })
  })

  it('过期作废', async () => {
    const code = await issue(payload, E)
    await payload.update({
      collection: 'login-codes',
      where: { email: { equals: E } },
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
    })
    expect(await verify(payload, E, code)).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('限频', () => {
  beforeAll(async () => {
    payload ??= await getPayload({ config: await config })
  })
  beforeEach(clean)
  afterAll(clean)

  it('同邮箱 60 秒内不能再发', async () => {
    expect(await checkRate(payload, E, '198.51.100.1')).toBeNull()
    await fakeSend(E, '198.51.100.1', 10_000)
    expect(await checkRate(payload, E, '198.51.100.1')).toBeGreaterThan(40)
  })

  it('同邮箱 24 小时最多 10 封', async () => {
    for (let i = 0; i < 9; i++) await fakeSend(E, '198.51.100.1', 3600_000)
    expect(await checkRate(payload, E, '198.51.100.1')).toBeNull()
    await fakeSend(E, '198.51.100.1', 3600_000)
    expect(await checkRate(payload, E, '198.51.100.1')).not.toBeNull()
  })

  it('同网络地址 1 小时最多 20 封', async () => {
    for (let i = 0; i < 20; i++) await fakeSend(`e2e-codes-${i}@example.test`, '203.0.113.9', 120_000)
    expect(await checkRate(payload, 'e2e-codes-new@example.test', '203.0.113.9')).not.toBeNull()
    expect(await checkRate(payload, 'e2e-codes-new@example.test', '198.51.100.7')).toBeNull()
  })

  // 放在这个文件里而不是 security.int.spec.ts：同一文件内按顺序执行，200 条刷信记录不会干扰别的限频测试（010 A4）
  it('换着邮箱发，全站 1 小时满 200 封后拒绝', async () => {
    const at = new Date(Date.now() - 60_000).toISOString()
    await Promise.all(
      Array.from({ length: 200 }, (_, i) =>
        payload.db.create({
          collection: 'email-sends',
          data: { email: `e2e-codes-flood-${i}@example.test`, ip: `198.51.100.${i % 250}`, kind: 'code', via: 'primary', ok: true, createdAt: at },
        }),
      ),
    )
    expect(await checkRate(payload, 'e2e-codes-fresh@example.test', '203.0.113.77')).not.toBeNull()
    await payload.delete({ collection: 'email-sends', where: { email: { like: 'e2e-codes-flood-' } } })
    expect(await checkRate(payload, 'e2e-codes-fresh@example.test', '203.0.113.77')).toBeNull()
  })
})
