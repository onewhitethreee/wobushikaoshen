import { sql } from '@payloadcms/db-postgres'
import type { Endpoint, PayloadRequest } from 'payload'

import { emptyData, isSyncData, mergeData, type SyncData } from '../account/sync'

// 同步（009 research R6、contracts/api.md）：一个接口既推又拉。
// 客户端带上次同步到的 rev 和这之后的改动；服务端合并后返回新 rev，客户端的 rev 已过时则一并返回完整数据
// 013 起含单词本（最多 5000 个词，按平均 2 条原句约 4 MB），上限从 2 MB / 5 MB 调大
const MAX_BODY = 4 * 1024 * 1024
// 合并后的总大小上限：草稿条数不限，反复推送会让一个账号的数据无限增长（010 R6-F5）。
// 记录上限 500 条约 1 MB（009 plan），留足余量
const MAX_STORED = 12 * 1024 * 1024

const isEmpty = (d: Partial<SyncData>) =>
  !d.records?.length && !d.vocab && !d.plan && [d.progress, d.drafts, d.favorites, d.dismissed, d.words, d.dictation, d.mocks].every((o) => !o || !Object.keys(o).length)

export const memberDataEndpoint: Endpoint = {
  path: '/me/data',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const user = req.user
    if (user?.collection !== 'members') return Response.json({ error: '请先登录' }, { status: 401 })
    const tooBig = () => Response.json({ error: '数据太大' }, { status: 413 })
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return tooBig()
    // 分块传输时没有 content-length，按实际读到的字节数再判断一次（010 R6-F4）
    const text = (await req.text?.().catch(() => '')) ?? ''
    if (Buffer.byteLength(text) > MAX_BODY) return tooBig()

    let body: { baseRev?: unknown; data?: unknown } | null = null
    try {
      body = JSON.parse(text)
    } catch {}
    if (!body || typeof body.baseRev !== 'number' || !isSyncData(body.data)) {
      return Response.json({ error: '数据格式不对' }, { status: 400 })
    }
    const { baseRev, data } = body
    const { payload } = req
    type Tx = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> }
    const db = payload.db as unknown as { drizzle: Tx & { transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> } }
    const memberId = user.id as number

    // 锁住这个考生的那一行再合并写入：同一账号几台设备同时推送也按顺序来，一条都不丢
    const result = await db.drizzle.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO member_data (member_id, rev, data) VALUES (${memberId}, 0, '{}'::jsonb)
        ON CONFLICT (member_id) DO NOTHING`)
      const { rows } = await tx.execute(sql`SELECT id, rev, data FROM member_data WHERE member_id = ${memberId} FOR UPDATE`)
      const old = Number(rows[0].rev)
      const merged = mergeData((rows[0].data as Partial<SyncData> | null) ?? emptyData(), data)
      if (isEmpty(data)) return { old, rev: old, merged }
      const json = JSON.stringify(merged)
      if (Buffer.byteLength(json) > MAX_STORED) return null
      await tx.execute(sql`
        UPDATE member_data SET data = ${json}::jsonb, rev = rev + 1, updated_at = now()
        WHERE id = ${rows[0].id}`)
      return { old, rev: old + 1, merged }
    })
    if (!result) return tooBig()
    return Response.json(baseRev === result.old ? { rev: result.rev } : { rev: result.rev, data: result.merged })
  },
}
