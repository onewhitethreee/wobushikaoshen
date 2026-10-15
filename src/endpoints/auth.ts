import { randomBytes } from 'crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

import { MailUnavailable, sendMail } from '../account/mail'
import { checkRate, clientIp, isEmail, issue, normalizeEmail, verify } from '../account/codes'

// 邮箱验证码登录（009 contracts/api.md）。登录成功后用 Payload 自带的令牌与 cookie，
// 之后 /api/members/me、/api/members/logout 都是现成的（research R1）

const json = async (req: PayloadRequest) => ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  Response.json({ error, ...extra }, { status })

export const maskEmail = (email: string) => {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

const sendCode: Endpoint = {
  path: '/auth/code',
  method: 'post',
  handler: async (req) => {
    const email = normalizeEmail((await json(req)).email)
    if (!isEmail(email)) return fail('邮箱格式不对', 400)
    const ip = clientIp(req)
    const retryIn = await checkRate(req.payload, email, ip)
    if (retryIn) return fail('请求太频繁，请稍后再试', 429, { retryIn })

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
      if (err instanceof MailUnavailable) return fail('邮件暂时发不出去，请稍后再试，不影响做题', 503)
      throw err
    }
    // 不论邮箱是否注册过，回复都一样
    return Response.json({ ok: true, resendIn: 60 })
  },
}

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
        : fail(result.left ? '验证码不对' : '验证码不对，已作废，请重新获取', 401, { left: result.left })
    }

    const { payload } = req
    const collectionConfig = payload.collections.members.config
    let created = false
    let found = await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: email } }, limit: 1 })
    if (!found.docs[0]) {
      // 随机密码没人知道，密码登录也已关闭（Members.ts）
      await payload.create({ collection: 'members', overrideAccess: true, data: { email, password: randomBytes(32).toString('hex') } })
      created = true
      found = await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: email } }, limit: 1 })
    }
    const id = found.docs[0].id
    await payload.update({ collection: 'members', id, overrideAccess: true, data: { lastLoginAt: new Date().toISOString() } })

    // 与 Payload 登录操作相同：加一个会话，再签发带 sid 的令牌
    const user = (await payload.db.findOne({ collection: 'members', req, where: { id: { equals: id } } })) as Record<string, unknown> & { id: number }
    const { sid } = await addSessionToUser({ collectionConfig, payload, req, user: user as never })
    const fieldsToSign = getFieldsToSign({ collectionConfig, email, sid, user: { ...user, collection: 'members' } as never })
    const { token } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration: collectionConfig.auth.tokenExpiration })
    const cookie = generatePayloadCookie({ collectionAuthConfig: collectionConfig.auth, cookiePrefix: payload.config.cookiePrefix, token })

    return Response.json({ ok: true, email: maskEmail(email), created }, { headers: { 'Set-Cookie': cookie as string } })
  },
}

export const authEndpoints = [sendCode, verifyCode]
