// 邮箱验证码（009 research R3）：10 分钟有效、只用一次、错 5 次作废；限频按发信记录计数
import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

export const CODE_TTL_MS = 10 * 60 * 1000
export const MAX_ATTEMPTS = 5
export const RESEND_MS = 60 * 1000
const PER_EMAIL_DAY = 10
const PER_IP_HOUR = 20
// 全站每小时上限：换着邮箱刷信时，单邮箱、单 IP 的限制都管不住（010 R6-F2）
const ALL_HOUR = 200

export const normalizeEmail = (s: unknown) => String(s ?? '').trim().toLowerCase()

export const isEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

// 取 x-forwarded-for 的最后一段：那是紧挨着本站的反向代理追加的真实来源；前面几段是客户端自己写的，可以伪造（010 R6-F1）。
// ponytail: 假定前面只有一层代理（nginx 用 $proxy_add_x_forwarded_for）；再套一层 CDN 时要改成倒数第二段
export const clientIp = (req: PayloadRequest) =>
  req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || req.headers.get('x-real-ip') || 'unknown'

export const hashCode = (email: string, code: string) =>
  createHmac('sha256', process.env.PAYLOAD_SECRET || '').update(`${email}:${code}`).digest('hex')

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

const since = (ms: number) => new Date(Date.now() - ms).toISOString()

const countSends = async (payload: Payload, field: 'email' | 'ip' | null, value: string, ms: number) =>
  (
    await payload.count({
      collection: 'email-sends',
      overrideAccess: true,
      where: {
        and: [...(field ? [{ [field]: { equals: value } }] : []), { kind: { equals: 'code' } }, { createdAt: { greater_than: since(ms) } }],
      },
    })
  ).totalDocs

/** 超限时返回需要等待的秒数，否则 null */
export const checkRate = async (payload: Payload, email: string, ip: string): Promise<number | null> => {
  const last = await payload.find({
    collection: 'email-sends',
    overrideAccess: true,
    where: { and: [{ email: { equals: email } }, { kind: { equals: 'code' } }] },
    sort: '-createdAt',
    limit: 1,
  })
  const lastAt = last.docs[0] ? new Date(last.docs[0].createdAt).getTime() : 0
  const wait = lastAt + RESEND_MS - Date.now()
  if (wait > 0) return Math.ceil(wait / 1000)
  if ((await countSends(payload, 'email', email, 24 * 3600_000)) >= PER_EMAIL_DAY) return 3600
  if (ip !== 'unknown' && (await countSends(payload, 'ip', ip, 3600_000)) >= PER_IP_HOUR) return 600
  if ((await countSends(payload, null, '', 3600_000)) >= ALL_HOUR) return 600
  return null
}

/** 作废同邮箱的旧码，存新码，顺手清理过期数据。返回验证码明文（只用于写进邮件） */
export const issue = async (payload: Payload, email: string) => {
  const now = new Date().toISOString()
  await payload.update({
    collection: 'login-codes',
    overrideAccess: true,
    where: { and: [{ email: { equals: email } }, { usedAt: { exists: false } }] },
    data: { usedAt: now },
  })
  const code = newCode()
  await payload.create({
    collection: 'login-codes',
    overrideAccess: true,
    data: { email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(), attempts: 0 },
  })
  await payload.delete({ collection: 'login-codes', overrideAccess: true, where: { createdAt: { less_than: since(24 * 3600_000) } } })
  await payload.delete({ collection: 'email-sends', overrideAccess: true, where: { createdAt: { less_than: since(30 * 24 * 3600_000) } } })
  return code
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'wrong'; left: number } | { ok: false; reason: 'expired' }

/**
 * 每次校验先用一条 SQL 原子地占用一次机会（attempts + 1），并发猜码也最多 5 次。
 * 答对时把这条码标为已用；第 5 次仍答错时作废
 */
export const verify = async (payload: Payload, email: string, code: string): Promise<VerifyResult> => {
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }
  const { rows } = await db.drizzle.execute(sql`
    UPDATE login_codes SET attempts = attempts + 1
    WHERE id = (
      SELECT id FROM login_codes
      WHERE email = ${email} AND used_at IS NULL AND expires_at > now() AND attempts < ${MAX_ATTEMPTS}
      ORDER BY created_at DESC LIMIT 1
    ) AND attempts < ${MAX_ATTEMPTS} AND used_at IS NULL
    RETURNING id, code_hash, attempts`)
  const row = rows[0]
  if (!row) return { ok: false, reason: 'expired' }

  const expected = Buffer.from(String(row.code_hash), 'hex')
  const given = Buffer.from(hashCode(email, code), 'hex')
  const right = expected.length === given.length && timingSafeEqual(expected, given)
  const attempts = Number(row.attempts)

  if (right || attempts >= MAX_ATTEMPTS) {
    const { rows: used } = await db.drizzle.execute(
      sql`UPDATE login_codes SET used_at = now() WHERE id = ${row.id} AND used_at IS NULL RETURNING id`,
    )
    // 两个请求同时答对时只算先到的那个
    if (right) return used.length ? { ok: true } : { ok: false, reason: 'expired' }
  }
  return { ok: false, reason: 'wrong', left: MAX_ATTEMPTS - attempts }
}
