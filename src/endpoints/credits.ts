import { sql } from '@payloadcms/db-postgres'
import type { Endpoint } from 'payload'

import { getSettings, purposeOf, redeem } from '../account/credits'
import { ensureInviteCode } from '../collections/Members'
import { rejectText } from '../collections/NoteSubmissions'
import { formatCode } from '../collections/RedeemCodes'
import { getServerSideURL } from '../utilities/getURL'

// 我的额度（011 contracts/api.md）：余额、流水（每页 50 条，after = 这条之后的余额）、邀请信息、我的笔记提交
const PAGE = 50

type Tx = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> }

export const creditsEndpoint: Endpoint = {
  path: '/me/credits',
  method: 'get',
  handler: async (req) => {
    const user = req.user
    if (user?.collection !== 'members') return Response.json({ error: '请先登录' }, { status: 401 })
    const { payload } = req
    const db = (payload.db as unknown as { drizzle: Tx }).drizzle
    const memberId = user.id as number
    const page = Math.max(1, Math.floor(Number(req.searchParams.get('page')) || 1))

    const [{ rows: [totals] }, { rows }] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(amount), 0) AS balance, COUNT(*) AS n,
               COALESCE(SUM(amount) FILTER (WHERE reason = 'invite'), 0) AS earned,
               COUNT(*) FILTER (WHERE reason = 'invite') AS rewarded
        FROM credit_entries WHERE member_id = ${memberId}`),
      db.execute(sql`
        SELECT * FROM (
          SELECT id, created_at, reason, amount, note, ref_key,
                 SUM(amount) OVER (ORDER BY created_at, id) AS after
          FROM credit_entries WHERE member_id = ${memberId}
        ) t ORDER BY created_at DESC, id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`),
    ])

    const [code, settings, invited, subs] = await Promise.all([
      ensureInviteCode(payload, memberId),
      getSettings(payload),
      payload.count({ collection: 'members', overrideAccess: true, where: { invitedBy: { equals: memberId } } }),
      payload.find({
        collection: 'note-submissions',
        overrideAccess: true,
        depth: 1,
        limit: 100,
        sort: '-createdAt',
        where: { member: { equals: memberId } },
      }),
    ])

    return Response.json({
      balance: Number(totals.balance),
      totalPages: Math.max(1, Math.ceil(Number(totals.n) / PAGE)),
      entries: rows.map((r) => ({
        id: Number(r.id),
        at: new Date(r.created_at as string).toISOString(),
        reason: r.reason,
        amount: Number(r.amount),
        after: Number(r.after),
        use: purposeOf(r.ref_key as string | null),
        note: r.reason === 'adjust' || (r.reason === 'refund' && !purposeOf(r.ref_key as string | null)) ? (r.note ?? undefined) : undefined,
      })),
      invite: {
        code,
        link: `${getServerSideURL()}/i/${code}`,
        count: invited.totalDocs,
        earned: Number(totals.earned),
        cap: settings.inviterCap,
        capped: Number(totals.rewarded) >= settings.inviterCap,
      },
      submissions: subs.docs.map((s) => ({
        id: s.id,
        at: s.createdAt,
        url: s.url,
        screenshot: typeof s.screenshot === 'object' ? s.screenshot?.url : undefined,
        status: s.status,
        amount: s.status === 'approved' ? s.amount : undefined,
        reason: s.status === 'rejected' ? rejectText(s) : undefined,
      })),
    })
  },
}

const REDEEM_FAIL = {
  missing: ['兑换码不对', 404],
  expired: ['兑换码已过期', 410],
  used: ['你已经用过这个兑换码', 409],
  exhausted: ['兑换码已被领完', 409],
} as const

// 兑换码换额度
export const redeemEndpoint: Endpoint = {
  path: '/me/redeem',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    if (user?.collection !== 'members') return Response.json({ error: '请先登录' }, { status: 401 })
    const body = ((await req.json?.().catch(() => null)) ?? {}) as { code?: unknown }
    const code = formatCode(body.code)
    if (!code) return Response.json({ error: '请输入兑换码' }, { status: 400 })
    const r = await redeem(req.payload, { memberId: user.id as number, code })
    if (!r.ok) {
      const [error, status] = REDEEM_FAIL[r.reason]
      return Response.json({ error }, { status })
    }
    return Response.json({ ok: true, amount: r.amount })
  },
}
