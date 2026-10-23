import type { Payload } from 'payload'

import { spend, type SpendResult } from '@/account/credits'

// AI 功能扣费（015 research R3、R12）。refKey = `${prefix}:${n}`，n = 这个前缀已经退回过的次数：
// 同时到达的重复请求算出同一个 n，唯一约束只放进一条；失败退回后 n 加 1，同一篇作文可以再交。
// 退回用 credits.ts 的 refund（refKey = refund:<扣费 refKey>）

const WINDOW = 60_000
const MAX_PER_WINDOW = 5
// 每人每 24 小时最多扣几次（退回的也算）：失败就退回，只靠每分钟限频的话一点额度一天能调 7000 多次 AI
export const DAILY_MAX = 100
// ponytail: 计数在进程内存里，重启清零；单进程部署（宪章 V）够用，多进程时改查流水表
const recent = new Map<number, number[]>()

export const rateLimited = (memberId: number, now = Date.now()) => {
  const hits = (recent.get(memberId) ?? []).filter((t) => now - t < WINDOW)
  recent.set(memberId, hits)
  return hits.length >= MAX_PER_WINDOW
}

export type ChargeResult = (Exclude<SpendResult, { reason: 'daily' }> | { ok: false; reason: 'rate' }) & { refKey: string }

export const charge = async (
  payload: Payload,
  { memberId, prefix, note }: { memberId: number; prefix: string; note?: string },
): Promise<ChargeResult> => {
  const { totalDocs: n } = await payload.count({
    collection: 'credit-entries',
    overrideAccess: true,
    where: { refKey: { like: `refund:${prefix}:` } },
  })
  const refKey = `${prefix}:${n}`
  if (rateLimited(memberId)) return { ok: false, reason: 'rate', refKey }
  // 先占位再 await：原来扣费成功后才记，并发请求都能通过上面的检查
  const hits = recent.get(memberId)!
  const t = Date.now()
  hits.push(t)
  const r = await spend(payload, { memberId, amount: 1, refKey, note, dailyMax: DAILY_MAX })
  // 只记成功扣费：连点产生的 duplicate、余额不足都不算，免得把自己锁住
  if (!r.ok) hits.splice(hits.indexOf(t), 1)
  if (!r.ok && r.reason === 'daily') return { ok: false, reason: 'rate', refKey }
  return { ...r, refKey } as ChargeResult
}
