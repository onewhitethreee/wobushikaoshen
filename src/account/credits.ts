import { sql } from '@payloadcms/db-postgres'
import { ValidationError, type Payload, type PayloadRequest } from 'payload'

import type { CreditEntry } from '@/payload-types'

// 额度记账（011 research R1–R3、R5）。余额永远是流水之和（宪章 II），不存余额字段。
// 扣减、邀请人上限这类"先算再写"的操作，在事务里先锁住考生那一行，同一考生的请求按顺序执行，余额不会变负

type Reason = CreditEntry['reason']
type Tx = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> }

const drizzle = (payload: Payload) =>
  (payload.db as unknown as { drizzle: Tx & { transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> } }).drizzle

// 由本文件发起的写入带这个标记；没有标记的新建流水一律当作后台人工调整校验（CreditEntries 的 beforeValidate）
export const INTERNAL = 'creditsInternal'

export const getSettings = (payload: Payload) =>
  payload.findGlobal({ slug: 'credit-settings', overrideAccess: true })

const sumOf = async (db: Tx, memberId: number) => {
  const { rows } = await db.execute(sql`SELECT COALESCE(SUM(amount), 0) AS b FROM credit_entries WHERE member_id = ${memberId}`)
  return Number(rows[0].b)
}

export const balance = (payload: Payload, memberId: number) => sumOf(drizzle(payload), memberId)

// 锁内直接插入；refKey 冲突时不插入、返回 null（不让整个事务失败）
const insert = async (
  db: Tx,
  e: { memberId: number; amount: number; reason: Reason; refKey?: string | null; relatedMember?: number | null; note?: string | null },
) => {
  const { rows } = await db.execute(sql`
    INSERT INTO credit_entries (member_id, amount, reason, ref_key, related_member_id, note, updated_at, created_at)
    VALUES (${e.memberId}, ${e.amount}, ${e.reason}::enum_credit_entries_reason, ${e.refKey ?? null},
            ${e.relatedMember ?? null}, ${e.note ?? null}, now(), now())
    ON CONFLICT (ref_key) DO NOTHING
    RETURNING id`)
  return rows[0] ? Number(rows[0].id) : null
}

const lockMember = (db: Tx, memberId: number) => db.execute(sql`SELECT id FROM members WHERE id = ${memberId} FOR UPDATE`)

export type GrantArgs = {
  memberId: number
  amount: number
  reason: Reason
  refKey?: string
  relatedMember?: number
  note?: string
  req?: PayloadRequest
}

// 发放一条流水。传了 req 就在调用方的事务里写（审核通过时和状态一起提交或回滚）；refKey 重复时返回 null
export const grant = async (payload: Payload, { memberId, amount, reason, refKey, relatedMember, note, req }: GrantArgs) => {
  try {
    return await payload.create({
      collection: 'credit-entries',
      overrideAccess: true,
      req,
      context: { [INTERNAL]: true },
      data: { member: memberId, amount, reason, refKey, relatedMember, note },
    })
  } catch (err) {
    if (err instanceof ValidationError && err.data.errors.some((e) => e.path === 'refKey')) return null
    throw err
  }
}

// 扣费 / 退回的用途（015 data-model 额度流水）：按 refKey 前缀区分
export const USES = { review: '写作批改', explain: '错题讲解' } as const
export const purposeOf = (refKey: string | null | undefined) => {
  const m = /^(?:refund:)?(review|explain):/.exec(refKey ?? '')
  return m ? (m[1] as keyof typeof USES) : undefined
}

export type SpendResult = { ok: true; id: number } | { ok: false; reason: 'balance' | 'duplicate' }

// 扣减：余额不足或 refKey 已用过都不写流水（宪章 I：先扣再调用 AI）。refKey 冲突 = 同一次请求重复到达（015 research R3）
export const spend = async (
  payload: Payload,
  { memberId, amount, refKey, note }: { memberId: number; amount: number; refKey?: string; note?: string },
): Promise<SpendResult> => {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('扣减数必须是正整数')
  return drizzle(payload).transaction(async (tx) => {
    await lockMember(tx, memberId)
    if ((await sumOf(tx, memberId)) < amount) return { ok: false, reason: 'balance' }
    const id = await insert(tx, { memberId, amount: -amount, reason: 'spend', refKey, note })
    return id ? { ok: true, id } : { ok: false, reason: 'duplicate' }
  })
}

// 退回某条消耗：同一条最多退一次（refKey = refund:<扣费 refKey>，扣费没有 refKey 时用 refund:<id>）
export const refund = async (payload: Payload, spendEntryId: number) => {
  const e = await payload.findByID({ collection: 'credit-entries', id: spendEntryId, overrideAccess: true, depth: 0 })
  if (e.reason !== 'spend') throw new Error('只能退回消耗流水')
  return grant(payload, {
    memberId: e.member as number,
    amount: -e.amount,
    reason: 'refund',
    refKey: `refund:${e.refKey ?? e.id}`,
    note: '退回',
  })
}

// 邀请奖励（research R5）：只在新建账号时调用。被邀请人一定得；邀请人得奖次数达到上限后不再得
export const grantInvite = async (payload: Payload, { inviteeId, code }: { inviteeId: number; code: string }) => {
  const found = await payload.find({
    collection: 'members',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { inviteCode: { equals: code.toUpperCase() } },
  })
  const inviter = found.docs[0]
  if (!inviter || inviter.id === inviteeId) return null
  const s = await getSettings(payload)

  return drizzle(payload).transaction(async (tx) => {
    // 已经有邀请人的账号不再改（FR-010）
    const set = await tx.execute(sql`UPDATE members SET invited_by_id = ${inviter.id} WHERE id = ${inviteeId} AND invited_by_id IS NULL RETURNING id`)
    if (!set.rows[0]) return null
    let amount = 0
    if (s.inviteeReward > 0) {
      const id = await insert(tx, { memberId: inviteeId, amount: s.inviteeReward, reason: 'invitee', refKey: `invitee:${inviteeId}`, relatedMember: inviter.id })
      if (id) amount = s.inviteeReward
    }
    await lockMember(tx, inviter.id)
    const { rows } = await tx.execute(sql`SELECT COUNT(*) AS n FROM credit_entries WHERE member_id = ${inviter.id} AND reason = 'invite'`)
    let inviterRewarded = false
    if (s.inviterReward > 0 && Number(rows[0].n) < s.inviterCap) {
      inviterRewarded = Boolean(
        await insert(tx, { memberId: inviter.id, amount: s.inviterReward, reason: 'invite', refKey: `inviter:${inviteeId}`, relatedMember: inviteeId }),
      )
    }
    return { amount, inviterRewarded }
  })
}
