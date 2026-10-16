import { randomBytes } from 'crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

import { grantInvite } from '../account/credits'
import { MailUnavailable, sendMail } from '../account/mail'
import { checkRate, clientIp, isEmail, issue, normalizeEmail, verify } from '../account/codes'
import { clearFailures, ipLimited, lockedFor, recordFailure, verifyHash } from '../account/password'

// 邮箱验证码登录（009 contracts/api.md）与密码登录（012 contracts/api.md）。登录成功后用 Payload 自带的令牌与 cookie，
// 之后 /api/members/me、/api/members/logout 都是现成的（009 research R1）

const json = async (req: PayloadRequest) => ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  Response.json({ error, ...extra }, { status })

export const maskEmail = (email: string) => {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

/** 两种登录共用（012 research R3）：记最近登录、加一个会话、签发带 sid 的令牌，返回 Set-Cookie 值。与 Payload 登录操作相同 */
const signIn = async (req: PayloadRequest, id: number): Promise<string> => {
  const { payload } = req
  const collectionConfig = payload.collections.members.config
  await payload.update({ collection: 'members', id, overrideAccess: true, data: { lastLoginAt: new Date().toISOString() } })
  const user = (await payload.db.findOne({ collection: 'members', req, where: { id: { equals: id } } })) as Record<string, unknown> & { id: number; email: string }
  const { sid } = await addSessionToUser({ collectionConfig, payload, req, user: user as never })
  const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, sid, user: { ...user, collection: 'members' } as never })
  const { token } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration: collectionConfig.auth.tokenExpiration })
  return generatePayloadCookie({ collectionAuthConfig: collectionConfig.auth, cookiePrefix: payload.config.cookiePrefix, token }) as string
}

const sendCode: Endpoint = {
  path: '/auth/code',
  method: 'post',
  handler: async (req) => {
    const email = normalizeEmail((await json(req)).email)
    if (!isEmail(email)) return fail('邮箱格式不对', 400)
    const ip = clientIp(req)
    const retryIn = await checkRate(req.payload, email, ip)
    if (retryIn) return fail('操作太频繁，请稍后再试', 429, { retryIn })

    const code = await issue(req.payload, email)
    try {
      await sendMail(req.payload, {
        to: email,
        ip,
        kind: 'code',
        subject: `我不是考神 登录验证码：${code}`,
        text: [
          `你的登录验证码是：${code}`,
          '',
          '10 分钟内有效，只能用一次。',
          '如果不是你本人操作，忽略这封邮件即可。',
          '',
          '—— 我不是考神',
        ].join('\n'),
      })
    } catch (err) {
      if (err instanceof MailUnavailable) return fail('验证码暂时发不出去，请稍后再试', 503)
      throw err
    }
    // 不论邮箱是否注册过，回复都一样
    return Response.json({ ok: true, resendIn: 60 })
  },
}

const INVITE_COOKIE = 'ybz_invite'
const readCookie = (req: PayloadRequest, name: string) =>
  req.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(name + '='))
    ?.slice(name.length + 1)

const verifyCode: Endpoint = {
  path: '/auth/verify',
  method: 'post',
  handler: async (req) => {
    const body = await json(req)
    const email = normalizeEmail(body.email)
    const code = String(body.code ?? '').trim()
    if (!isEmail(email)) return fail('邮箱格式不对', 400)
    if (!/^\d{6}$/.test(code)) return fail('请输入 6 位数字验证码', 400)

    const result = await verify(req.payload, email, code)
    if (!result.ok) {
      return result.reason === 'expired'
        ? fail('验证码已过期，请重新获取', 410)
        : fail(result.left ? '验证码不对' : '错误次数太多，请重新获取验证码', 401, { left: result.left })
    }

    const { payload } = req
    let created = false
    let found = await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: email } }, limit: 1 })
    if (!found.docs[0]) {
      // 随机密码没人知道；passwordSet 为 false，密码登录不认它（012）
      await payload.create({ collection: 'members', overrideAccess: true, data: { email, password: randomBytes(32).toString('hex') } })
      created = true
      found = await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: email } }, limit: 1 })
    }
    const id = found.docs[0].id
    const cookie = await signIn(req, id)

    // 邀请（011 research R5）：只有这次新建了账号才算；发放失败不影响登录
    const inviteCode = readCookie(req, INVITE_COOKIE)
    let invite: { amount: number; inviterRewarded: boolean } | null = null
    if (created && inviteCode) {
      try {
        invite = await grantInvite(payload, { inviteeId: id, code: decodeURIComponent(inviteCode) })
      } catch (err) {
        payload.logger.error({ err, msg: '邀请奖励发放失败' })
      }
    }

    const headers = new Headers({ 'Set-Cookie': cookie })
    if (inviteCode) headers.append('Set-Cookie', `${INVITE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`)
    return Response.json(
      { ok: true, email: maskEmail(email), created, ...(invite?.amount ? { invite } : {}) },
      { headers },
    )
  },
}

// 密码登录（012 contracts/api.md）：从不建号、不发邀请奖励。账号不存在、没设密码、密码错，提示和耗时都一样（FR-012）
const passwordLogin: Endpoint = {
  path: '/auth/password',
  method: 'post',
  handler: async (req) => {
    const ipWait = ipLimited(clientIp(req))
    if (ipWait) return fail('操作太频繁，请稍后再试', 429, { retryIn: ipWait })
    const body = await json(req)
    const email = normalizeEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    if (!isEmail(email)) return fail('邮箱格式不对', 400)
    if (!password) return fail('请输入密码', 400)
    const locked = lockedFor(email)
    if (locked) return fail('密码错误次数过多，请 15 分钟后再试，或用验证码登录', 423, { retryIn: locked })

    // db 层直接读，才能拿到隐藏字段 hash / salt；没设密码时传 null，用假哈希照样算一遍
    const doc = (await req.payload.db.findOne({ collection: 'members', req, where: { email: { equals: email } } })) as
      | (Record<string, unknown> & { id: number; passwordSet?: boolean | null })
      | null
    if (!(await verifyHash(password, doc?.passwordSet ? doc : null)) || !doc) {
      recordFailure(email)
      return fail('邮箱或密码不对', 401)
    }
    clearFailures(email)
    const cookie = await signIn(req, doc.id)
    return Response.json({ ok: true, email: maskEmail(email), created: false }, { headers: { 'Set-Cookie': cookie } })
  },
}

export const authEndpoints = [sendCode, verifyCode, passwordLogin]
