// 开源前的攻击测试（010 contracts/attack-matrix.md）。验证码爆破、限频与全站上限见 codes.int.spec.ts，越权见 access.int.spec.ts
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { clientIp } from '@/account/codes'
import { memberDataEndpoint } from '@/endpoints/memberData'
import type { Member } from '@/payload-types'

let payload: Payload
let member: Member

const clean = async () => {
  await payload.delete({ collection: 'email-sends', where: { email: { like: 'e2e-sec-' } } })
  await payload.delete({ collection: 'members', where: { email: { like: 'e2e-sec-' } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await clean()
  member = await payload.create({ collection: 'members', data: { email: 'e2e-sec-a@example.test', password: 'x'.repeat(32) } })
})
afterAll(() => clean())

describe('IP 解析（A3）', () => {
  const ipOf = (h: Record<string, string>) => clientIp({ headers: new Headers(h) } as unknown as PayloadRequest)

  it('取代理追加的最后一段，客户端自己写的前几段不算', () => {
    expect(ipOf({ 'x-forwarded-for': '1.1.1.1, 9.9.9.9' })).toBe('9.9.9.9')
    expect(ipOf({ 'x-forwarded-for': '9.9.9.9' })).toBe('9.9.9.9')
  })

  it('没有 x-forwarded-for 时用 x-real-ip', () => {
    expect(ipOf({ 'x-real-ip': '8.8.8.8' })).toBe('8.8.8.8')
    expect(ipOf({})).toBe('unknown')
  })
})

describe('/api/me/data（A11、A14）', () => {
  const call = (body: string, headers: Record<string, string> = {}) =>
    memberDataEndpoint.handler({
      user: { ...member, collection: 'members' },
      payload,
      headers: new Headers(headers),
      text: async () => body,
    } as unknown as PayloadRequest) as Promise<Response>

  // 草稿单条限 2 万字，但条数不限，用很多条凑大小
  const drafts = (prefix: string, n: number) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}-${i}`, { text: 'x'.repeat(19_000), at: 1 }]))

  it('没有 content-length 头（分块传输）也不能超过 2 MB', async () => {
    const big = JSON.stringify({ baseRev: -1, data: { drafts: drafts('e2e-big', 120) } })
    expect((await call(big)).status).toBe(413)
  })

  it('每次都不超 2 MB、反复推也不能把一个账号的数据撑到无限大（F5）', async () => {
    const statuses: number[] = []
    for (let k = 0; k < 6; k++) statuses.push((await call(JSON.stringify({ baseRev: -1, data: { drafts: drafts(`e2e-grow${k}`, 90) } }))).status)
    expect(statuses).toContain(413)
  })

  it('不是 JSON 返回 400', async () => {
    expect((await call('{oops')).status).toBe(400)
  })

  it('SQL 片段按原文存取，不被执行', async () => {
    const key = "e2e'; DROP TABLE member_data;--"
    const res = await call(JSON.stringify({ baseRev: -1, data: { drafts: { [key]: { text: "x' OR '1'='1", at: 5 } } } }))
    expect(res.status).toBe(200)
    const back = (await (await call(JSON.stringify({ baseRev: -1, data: {} }))).json()) as { data: { drafts: Record<string, { text: string }> } }
    expect(back.data.drafts[key]?.text).toBe("x' OR '1'='1")
  })
})

describe('查询参数注入（A11）', () => {
  it('奇怪的运算符不会让考生看到别人', async () => {
    for (const where of [{ email: { not_equals: null } }, { or: [{ id: { exists: true } }] }, { email: { like: "%' OR 1=1 --" } }]) {
      const res = await payload
        .find({ collection: 'members', where: where as never, user: { ...member, collection: 'members' }, overrideAccess: false })
        .catch(() => ({ docs: [] as Member[] }))
      expect(res.docs.every((d) => d.id === member.id)).toBe(true)
    }
  })
})

describe('密码相关操作（A15）', () => {
  it('考生不能走忘记密码 / 重置密码', async () => {
    await expect(payload.forgotPassword({ collection: 'members', data: { email: member.email }, disableEmail: true })).rejects.toThrow()
    await expect(payload.resetPassword({ collection: 'members', data: { token: 'x', password: 'y'.repeat(32) }, overrideAccess: true })).rejects.toThrow()
  })
})

describe('生产密钥守卫（A18）', () => {
  const good = 'k'.repeat(40)
  const env = (o: Record<string, string | undefined>) => ({ NODE_ENV: 'production', PAYLOAD_SECRET: good, CRON_SECRET: good, PREVIEW_SECRET: good, ...o })

  it('生产环境空值、示例值、太短都拒绝启动', async () => {
    const { checkSecrets } = await import('@/utilities/checkSecrets')
    expect(() => checkSecrets(env({}))).not.toThrow()
    expect(() => checkSecrets(env({ PAYLOAD_SECRET: undefined }))).toThrow(/PAYLOAD_SECRET/)
    expect(() => checkSecrets(env({ PAYLOAD_SECRET: 'YOUR_SECRET_HERE' }))).toThrow(/PAYLOAD_SECRET/)
    expect(() => checkSecrets(env({ CRON_SECRET: 'YOUR_CRON_SECRET_HERE' + 'x'.repeat(20) }))).toThrow(/CRON_SECRET/)
    expect(() => checkSecrets(env({ PREVIEW_SECRET: 'k'.repeat(31) }))).toThrow(/PREVIEW_SECRET/)
  })

  it('开发环境不检查', async () => {
    const { checkSecrets } = await import('@/utilities/checkSecrets')
    expect(() => checkSecrets({ NODE_ENV: 'development', PAYLOAD_SECRET: 'short' })).not.toThrow()
  })
})
