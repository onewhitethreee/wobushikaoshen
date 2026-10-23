// 发信（009 research R4）：每次从后台「邮件设置」读配置，主用失败自动改用备用。
// 只发事务邮件（验证码、测试），不提供群发（宪章原则 V）
import nodemailer from 'nodemailer'
import type { Payload } from 'payload'

import type { MailSetting } from '@/payload-types'

type Which = 'primary' | 'backup'
type Smtp = NonNullable<MailSetting['primary']>
// logId：限频时已占好的发信记录（codes.ts 的 reserveSend），发完改写它，不另建
export type Mail = { to: string; subject: string; text: string; kind: 'code' | 'test'; ip?: string; logId?: number }

export class MailUnavailable extends Error {}

// 只留错误码和第一行，避免把服务器回显的内容整段存下来
const reason = (err: unknown) => {
  const e = err as { code?: string; message?: string }
  return `${e.code ? e.code + ' ' : ''}${String(e.message ?? err).split('\n')[0]}`.slice(0, 300)
}

const send = async (cfg: Smtp, mail: Mail) => {
  if (!cfg.host || !cfg.fromAddress) throw new Error('配置不完整：缺服务器或发件人地址')
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port ?? 465,
    secure: cfg.secure === 'ssl',
    requireTLS: cfg.secure === 'starttls',
    ignoreTLS: cfg.secure === 'none',
    auth: cfg.user ? { user: cfg.user, pass: cfg.password ?? '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  await transport.sendMail({
    from: { name: cfg.fromName || '我不是考神', address: cfg.fromAddress },
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  })
}

const settings = (payload: Payload) =>
  payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true }) as Promise<MailSetting>

const recordFailure = (payload: Payload, which: Which, error: string) =>
  payload
    .updateGlobal({ slug: 'mail-settings', overrideAccess: true, data: { [which]: { lastError: error, lastErrorAt: new Date().toISOString() } } })
    .catch((e) => payload.logger.error({ err: e }, '记录发信失败原因时出错'))

const log = (payload: Payload, mail: Mail, via: Which | 'none', error?: string) => {
  const data = { email: mail.to, ip: mail.ip, kind: mail.kind, via, ok: via !== 'none', error }
  return mail.logId
    ? payload.update({ collection: 'email-sends', id: mail.logId, overrideAccess: true, data })
    : payload.create({ collection: 'email-sends', overrideAccess: true, data })
}

/** 依次试已启用的主用、备用；都失败抛 MailUnavailable。返回实际发出的那一套 */
export const sendMail = async (payload: Payload, mail: Mail): Promise<Which> => {
  const s = await settings(payload)
  let last = '主用和备用都未启用'
  for (const which of ['primary', 'backup'] as const) {
    const cfg = s[which]
    if (!cfg?.enabled) continue
    try {
      await send(cfg, mail)
      await log(payload, mail, which)
      return which
    } catch (err) {
      last = reason(err)
      payload.logger.warn(`发信失败（${which}）：${last}`)
      await recordFailure(payload, which, last)
    }
  }
  await log(payload, mail, 'none', last)
  throw new MailUnavailable(last)
}

/** 后台"发送测试邮件"：只用指定的一套，不切换（启用与否都试） */
export const sendTest = async (payload: Payload, which: Which, to: string, ip?: string) => {
  const s = await settings(payload)
  const mail: Mail = {
    to,
    kind: 'test',
    ip,
    subject: '我不是考神 发信测试',
    text: `这是一封测试邮件，说明「邮件设置」里的${which === 'primary' ? '主用' : '备用'}配置可以正常发信。`,
  }
  try {
    await send(s[which] ?? {}, mail)
    await log(payload, mail, which)
  } catch (err) {
    const r = reason(err)
    await recordFailure(payload, which, r)
    await log(payload, mail, 'none', r)
    throw new MailUnavailable(r)
  }
}
