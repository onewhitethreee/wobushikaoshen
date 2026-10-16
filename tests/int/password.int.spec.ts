// @vitest-environment node
// 密码登录（012 FR-025）：规则、旧账号登录不了、三种失败提示一致、暂停不影响验证码登录、改密码踢掉其他会话、哈希不下发、内存有上限
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { issue } from '@/account/codes'
import {
  checkPassword,
  failures,
  IP_PER_HOUR,
  ipHits,
  ipLimited,
  MAX_ENTRIES,
  MAX_FAILURES,
  recordFailure,
  verifyHash,
} from '@/account/password'
import { authEndpoints } from '@/endpoints/auth'
import { passwordEndpoint } from '@/endpoints/password'
import type { Member } from '@/payload-types'

let payload: Payload
const PREFIX = 'e2e-password-'
let n = 0
const newEmail = () => `${PREFIX}${Date.now()}-${n++}@example.test`
const OLD_RANDOM = 'r'.repeat(64)
const mk = (email = newEmail()) =>
  payload.create({
    collection: 'members',
    overrideAccess: true,
    data: { email, password: OLD_RANDOM },
  })
const cleanup = async () => {
  await payload.delete({
    collection: 'members',
    overrideAccess: true,
    where: { email: { like: PREFIX } },
  })
  await payload.delete({
    collection: 'login-codes',
    overrideAccess: true,
    where: { email: { like: PREFIX } },
  })
}

const endpoint = (path: string) => authEndpoints.find((e) => e.path === path)!
let ipSeq = 0
const req = (body: unknown, extra: Partial<Record<string, unknown>> = {}) =>
  ({
    payload,
    headers: new Headers({ 'x-forwarded-for': `10.0.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}` }),
    json: async () => body,
    ...extra,
  }) as unknown as PayloadRequest
const login = (email: string, password: string, r = req({ email, password })) =>
  endpoint('/auth/password').handler(r) as Promise<Response>
const errorOf = async (res: Response) => ((await res.json()) as { error?: string }).error

/** 用 cookie 换回当前用户（与 /api/members/me 走同一套 JWT 策略） */
const whoIs = async (cookie: string) => {
  const token = cookie.split(';')[0]
  // 配了 csrf 白名单时，没有 Origin 的请求要带 Sec-Fetch-Site 才认 cookie（浏览器会自动带）
  const { user } = await payload.auth({
    headers: new Headers({ cookie: token, 'sec-fetch-site': 'same-origin' }),
  })
  return user
}
const cookieOf = (res: Response) => res.headers.get('set-cookie') ?? ''
const memberFrom = async (cookie: string) =>
  (await whoIs(cookie)) as unknown as Member & { collection: 'members'; _sid?: string }

const setPassword = async (cookie: string, password: string, confirm = password) =>
  passwordEndpoint.handler(
    req({ password, confirm }, { user: await memberFrom(cookie) }),
  ) as Promise<Response>

/** 走真实的验证码登录拿 cookie（新账号或已有账号都行） */
const codeLogin = async (email: string) => {
  const code = await issue(payload, email)
  const res = (await endpoint('/auth/verify').handler(req({ email, code }))) as Response
  expect(res.status).toBe(200)
  return cookieOf(res)
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
})
afterAll(cleanup)
beforeEach(() => {
  failures.clear()
  ipHits.clear()
})

describe('密码规则', () => {
  const email = 'abcdefgh@qq.com'
  it.each([
    ['1234567', '密码至少 8 个字符'],
    ['x'.repeat(65), '密码最多 64 个字符'],
    ['ABCDEFGH', '密码不能和邮箱相同'],
    ['abcdefgh@qq.com', '密码不能和邮箱相同'],
  ])('%s → %s', (p, msg) => expect(checkPassword(p, p, email)).toBe(msg))

  it('8 个中文字符算 8 个字符；两次不一致要提示', () => {
    expect(checkPassword('一二三四五六七八', '一二三四五六七八', email)).toBeNull()
    expect(checkPassword('good-pass-1', 'good-pass-2', email)).toBe('两次输入的密码不一样')
  })
})

describe('设置密码', () => {
  it('设置后 passwordSet 为 true，新密码能比对上、旧随机密码不行；本人读回的数据不含 hash / salt', async () => {
    const email = newEmail()
    const cookie = await codeLogin(email)
    const res = await setPassword(cookie, 'new-pass-123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, firstTime: true })

    const raw = (await payload.db.findOne({
      collection: 'members',
      where: { email: { equals: email } },
    })) as Record<string, unknown>
    expect(raw.passwordSet).toBe(true)
    expect(await verifyHash('new-pass-123', raw)).toBe(true)
    expect(await verifyHash(OLD_RANDOM, raw)).toBe(false)

    const me = await memberFrom(cookie)
    const self = await payload.findByID({
      collection: 'members',
      id: me.id,
      overrideAccess: false,
      user: me,
    })
    expect(self).not.toHaveProperty('hash')
    expect(self).not.toHaveProperty('salt')
    expect(me).not.toHaveProperty('hash')
  })

  it('未登录、规则不符都被拒', async () => {
    expect(
      (
        (await passwordEndpoint.handler(
          req({ password: 'good-pass-1', confirm: 'good-pass-1' }),
        )) as Response
      ).status,
    ).toBe(401)
    const cookie = await codeLogin(newEmail())
    const res = await setPassword(cookie, 'short')
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('密码至少 8 个字符')
  })
})

describe('密码登录', () => {
  it('不存在、没设密码、密码错：提示完全相同（SC-004），且不建号', async () => {
    const legacy = await mk() // 009 式的旧账号：随机密码、passwordSet = false
    const email = newEmail()
    await setPassword(await codeLogin(email), 'right-pass-1')
    const stranger = newEmail()

    const results = await Promise.all([
      login(stranger, 'whatever-1'),
      login(legacy.email, OLD_RANDOM), // 就算知道那串随机密码也登录不了
      login(email, 'wrong-pass-1'),
    ])
    expect(results.map((r) => r.status)).toEqual([401, 401, 401])
    const messages = await Promise.all(results.map(errorOf))
    expect(new Set(messages)).toEqual(new Set(['邮箱或密码不对']))
    // 只看这个邮箱：别的测试文件会并行建删账号，总数不可靠
    const where = { email: { equals: stranger } }
    expect((await payload.count({ collection: 'members', overrideAccess: true, where })).totalDocs).toBe(0)
  })

  it('密码正确：登录成功、带 cookie、是同一个账号；邮箱大小写和空格不影响', async () => {
    const email = newEmail()
    await setPassword(await codeLogin(email), 'right-pass-1')
    const res = await login(` ${email.toUpperCase()} `, 'right-pass-1')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, created: false })
    expect((await whoIs(cookieOf(res)))?.email).toBe(email)
  })

  it(`连错 ${MAX_FAILURES} 次后暂停，正确密码也不行；验证码登录不受影响；设置密码后解除`, async () => {
    const email = newEmail()
    await setPassword(await codeLogin(email), 'right-pass-1')
    for (let i = 0; i < MAX_FAILURES; i++)
      expect((await login(email, 'wrong-pass-1')).status).toBe(401)
    const locked = await login(email, 'right-pass-1')
    expect(locked.status).toBe(423)

    const cookie = await codeLogin(email)
    expect((await whoIs(cookie))?.email).toBe(email)

    await setPassword(cookie, 'right-pass-2')
    expect((await login(email, 'right-pass-2')).status).toBe(200)
  })

  it(`同一网络地址第 ${IP_PER_HOUR + 1} 次被限频`, async () => {
    const r = () => req({ email: newEmail(), password: 'x' })
    const fixed = (x: PayloadRequest) => {
      ;(x as unknown as { headers: Headers }).headers = new Headers({
        'x-forwarded-for': '10.9.9.9',
      })
      return x
    }
    for (let i = 0; i < IP_PER_HOUR; i++) expect(ipLimited('10.9.9.9')).toBeNull()
    const res = await login('a@b.cc', 'x', fixed(r()))
    expect(res.status).toBe(429)
  })

  it('内存计数有上限：塞超过 MAX_ENTRIES 条后不会继续增长', () => {
    for (let i = 0; i <= MAX_ENTRIES + 5; i++) {
      recordFailure(`flood-${i}@x.cc`)
      ipLimited(`11.${i >> 16}.${(i >> 8) & 255}.${i & 255}`)
    }
    expect(failures.size).toBeLessThanOrEqual(MAX_ENTRIES)
    expect(ipHits.size).toBeLessThanOrEqual(MAX_ENTRIES)
  })
})

describe('修改密码（US3）', () => {
  it('只留当前会话：另一台设备的登录失效，当前设备仍在线（SC-006）', async () => {
    const email = newEmail()
    await setPassword(await codeLogin(email), 'first-pass-1')
    const a = cookieOf(await login(email, 'first-pass-1'))
    const b = cookieOf(await login(email, 'first-pass-1'))
    expect((await whoIs(b))?.email).toBe(email)

    const res = await setPassword(a, 'second-pass-1')
    expect(await res.json()).toEqual({ ok: true, firstTime: false })
    expect((await whoIs(a))?.email).toBe(email)
    expect(await whoIs(b)).toBeNull()
    expect((await login(email, 'first-pass-1')).status).toBe(401)
    expect((await login(email, 'second-pass-1')).status).toBe(200)
  })
})
