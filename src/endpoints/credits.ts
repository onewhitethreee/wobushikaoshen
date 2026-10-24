import { sql } from '@payloadcms/db-postgres'
import type { Endpoint } from 'payload'

import { getSettings, purposeOf, redeem } from '../account/credits'
import { platformName } from '../account/notePlatform'
import { ensureInviteCode } from '../collections/Members'
import { rejectText } from '../collections/NoteSubmissions'
import { parseUnitId } from '../exam/practice'
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

    const settings = await getSettings(payload)
    // 笔记平台关闭时不返回以前的提交（032 contracts/api.md）
    const platform = platformName(settings)
    const [code, invited, subs, reports] = await Promise.all([
      ensureInviteCode(payload, memberId),
      payload.count({ collection: 'members', overrideAccess: true, where: { invitedBy: { equals: memberId } } }),
      platform
        ? payload.find({
            collection: 'note-submissions',
            overrideAccess: true,
            depth: 1,
            limit: 100,
            sort: '-createdAt',
            where: { member: { equals: memberId } },
          })
        : { docs: [] },
      payload.find({ collection: 'answer-reports', overrideAccess: true, depth: 0, limit: 100, sort: '-createdAt', where: { member: { equals: memberId } } }),
    ])
    // 031：举报的题目标题，按单元 / 套题各查一次
    const ids = { units: new Set<number>(), tests: new Set<number>() }
    for (const r of reports.docs) {
      const p = parseUnitId(r.unitKey)
      if (p) ids[p.kind === 'unit' ? 'units' : 'tests'].add(p.docId)
    }
    const titles = new Map<string, string>()
    for (const c of ['units', 'tests'] as const) {
      if (!ids[c].size) continue
      const res = await payload.find({ collection: c, overrideAccess: true, depth: 0, limit: ids[c].size, select: { title: true }, where: { id: { in: [...ids[c]] } } })
      for (const d of res.docs) titles.set(`${c}:${d.id}`, (d as { title?: string }).title ?? '')
    }
    const titleOf = (unitKey: string) => {
      const p = parseUnitId(unitKey)
      return (p && titles.get(`${p.kind === 'unit' ? 'units' : 'tests'}:${p.docId}`)) || unitKey
    }

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
      note: { platform },
      reports: reports.docs.map((r) => ({
        id: r.id,
        at: r.createdAt,
        unitKey: r.unitKey,
        number: r.number,
        title: titleOf(r.unitKey),
        href: `/practice/${r.unitKey}`,
        answer: r.answer ?? '',
        status: r.status,
        amount: r.status === 'approved' ? r.amount : undefined,
        reason: r.status === 'rejected' ? rejectText(r) : undefined,
      })),
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
