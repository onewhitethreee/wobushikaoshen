import type { Payload } from 'payload'

// 029 每日上限（research R5）：按北京时间（UTC+8，无夏令时）自然日，数当天由接口新建的单元。
// 不另建计数表：viaApi + createdAt 就是计数来源

const DAY = 24 * 60 * 60 * 1000
const CN = 8 * 60 * 60 * 1000

/** 北京时间当天 0 点 */
export const dayStart = (now: Date) => new Date(Math.floor((now.getTime() + CN) / DAY) * DAY - CN)

/** 北京日期 YYYY-MM-DD */
export const cnDate = (d: Date) => new Date(d.getTime() + CN).toISOString().slice(0, 10)

export type Quota = { limit: number; used: number; remaining: number; resetAt: string }

const countSince = async (payload: Payload, from: Date, to?: Date) =>
  (
    await payload.count({
      collection: 'units',
      overrideAccess: true,
      where: {
        and: [
          { viaApi: { equals: true } },
          { createdAt: { greater_than_equal: from.toISOString() } },
          ...(to ? [{ createdAt: { less_than: to.toISOString() } }] : []),
        ],
      },
    })
  ).totalDocs

export const quota = async (payload: Payload, now = new Date()): Promise<Quota> => {
  const s = await payload.findGlobal({ slug: 'content-api-settings', overrideAccess: true })
  const limit = s.dailyLimit ?? 20
  const start = dayStart(now)
  const used = await countSince(payload, start)
  return { limit, used, remaining: Math.max(0, limit - used), resetAt: new Date(start.getTime() + DAY).toISOString() }
}

/** 最近 n 天（含今天）每天新建数，旧的在前 */
export const lastDays = async (payload: Payload, n: number, now = new Date()) => {
  const today = dayStart(now).getTime()
  return Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const from = new Date(today - (n - 1 - i) * DAY)
      return { date: cnDate(from), count: await countSince(payload, from, new Date(from.getTime() + DAY)) }
    }),
  )
}
