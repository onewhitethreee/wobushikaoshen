import type { Endpoint, Payload, PayloadRequest } from 'payload'

import { isAdmin } from '../access/authenticated'
import { clientIp } from '../account/codes'
import { EXAMPLE, FORMAT } from '../contentApi/format'
import { badKeyWait, bearer, hashKey, newKey, recordBadKey, verifyKey } from '../contentApi/key'
import { lastDays, quota } from '../contentApi/quota'
import { checkRequest, decodeFiles, MAX_BODY } from '../contentApi/request'
import { importPackage } from '../import/importPackage'
import { getServerSideURL } from '../utilities/getURL'
import { serialQueue } from '../utilities/serial'

// 029 内容接口（specs/029-content-api/contracts/api.md）：站长另一个 AI 用密钥上传 / 查询阅读单元；
// 后台三个接口只认管理员，用来生成 / 停用密钥和看统计。密钥只能调这里的接口，不是 Payload 账号

const SLUG = 'content-api-settings'
const fail = (status: number, errors: string[], extra: Record<string, unknown> = {}) => Response.json({ ok: false, errors, ...extra }, { status })

const settings = (payload: Payload) => payload.findGlobal({ slug: SLUG, overrideAccess: true, showHiddenFields: true })

/** 校验 Bearer 密钥；通过返回 null，否则返回要回给调用方的响应 */
const authorize = async (req: PayloadRequest): Promise<Response | null> => {
  const s = await settings(req.payload)
  if (!verifyKey(bearer(req.headers), s.keyHash)) {
    // 只拦错误的密钥：正确的密钥永远放行，别人在同一地址乱试（或代理没传真实地址、大家都算 unknown）挡不住调用方
    const ip = clientIp(req)
    const wait = badKeyWait(ip)
    if (wait) return fail(429, [`密钥错误次数太多，请 ${Math.ceil(wait / 60)} 分钟后再试`], { retryIn: wait })
    recordBadKey(ip)
    return fail(401, ['密钥无效或已停用'])
  }
  // 最近使用时间同一分钟只写一次；keyHash 没传，由字段钩子保留
  const last = s.lastUsedAt ? new Date(s.lastUsedAt).getTime() : 0
  if (Date.now() - last >= 60_000) {
    await req.payload.updateGlobal({ slug: SLUG, data: { lastUsedAt: new Date().toISOString() }, overrideAccess: true })
  }
  return null
}

type State = { sourceId: string; status: 'missing' } | {
  sourceId: string
  status: 'draft' | 'published'
  hasDraft: boolean
  id: number
  updatedAt: string
  adminUrl: string
  viaApi: boolean
}

/** 按 sourceId 查单元：已发布（主表）是否另有待复核的草稿版本（最新版本是草稿），research R4 */
const stateOf = async (payload: Payload, sourceId: string): Promise<State> => {
  const where = { sourceId: { equals: sourceId } }
  const latest = (await payload.find({ collection: 'units', where, draft: true, depth: 0, limit: 1, overrideAccess: true })).docs[0]
  if (!latest) return { sourceId, status: 'missing' }
  const published = (
    await payload.find({ collection: 'units', where: { and: [where, { _status: { equals: 'published' } }] }, depth: 0, limit: 1, overrideAccess: true })
  ).totalDocs > 0
  return {
    sourceId,
    status: published ? 'published' : 'draft',
    hasDraft: published && latest._status === 'draft',
    id: latest.id as number,
    updatedAt: latest.updatedAt,
    adminUrl: `${getServerSideURL()}/admin/collections/units/${latest.id}`,
    viaApi: latest.viaApi === true,
  }
}

const publicState = (s: State) => {
  if (s.status === 'missing' || !s.viaApi) return { sourceId: s.sourceId, status: 'missing' as const }
  const { viaApi: _, ...rest } = s
  return rest
}

// 上传串行执行：查重、数每日额度、写入之间不会被另一个请求插队，并发时不会超额
const serial = serialQueue()

const upload: Endpoint = {
  path: '/content-api/units',
  method: 'post',
  handler: async (req) => {
    const denied = await authorize(req)
    if (denied) return denied
    const tooBig = () => fail(413, ['请求体超过 20 MB，请减少配图或分批上传'])
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return tooBig()
    const text = (await req.text?.()) ?? ''
    if (Buffer.byteLength(text) > MAX_BODY) return tooBig()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch (e) {
      return fail(400, [`请求体不是合法的 JSON：${(e as Error).message}`])
    }

    const { errors, publish, items, files: rawFiles } = checkRequest(body)
    const decoded = decodeFiles(rawFiles)
    errors.push(...decoded.errors)
    if (errors.length) return fail(400, errors)

    const { payload } = req
    return serial(async () => {
      // 只能新建或更新接口单元：撞上题库里的单元就拒绝，不改它（FR-007）
      const before = await Promise.all(items.map((it) => stateOf(payload, String(it.sourceId ?? ''))))
      const taken = before
        .map((s, i) => (s.status !== 'missing' && !s.viaApi ? `第 ${i + 1} 项（${s.sourceId}）：sourceId 已被题库其他内容占用，请换一个` : ''))
        .filter(Boolean)
      if (taken.length) return fail(400, taken)

      const creating = before.filter((s) => s.status === 'missing').length
      const q = await quota(payload)
      if (creating && q.limit === 0) return fail(429, ['内容接口已暂停接收新内容'], { quota: q })
      if (creating && q.used + creating > q.limit)
        return fail(429, [`今天还能新建 ${q.remaining} 个，本次要新建 ${creating} 个；北京时间 0 点重置`], { quota: q })

      const r = await importPackage(
        req,
        JSON.stringify({ kind: 'unit', publish, data: items }),
        async (p) => decoded.files.get(p) ?? null,
        { reuseMedia: false },
      )
      if (!r.body.ok) return fail(r.status, r.body.errors)

      const created = await Promise.all(
        before.map(async (b) => {
          const s = publicState(await stateOf(payload, b.sourceId))
          return { ...s, updated: b.status !== 'missing' }
        }),
      )
      return Response.json({ ok: true, created, quota: await quota(payload) }, { status: 201 })
    })
  },
}

const query: Endpoint = {
  path: '/content-api/units',
  method: 'get',
  handler: async (req) => {
    const denied = await authorize(req)
    if (denied) return denied
    const raw = new URL(req.url ?? '', 'http://x').searchParams.get('sourceId') ?? ''
    const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))]
    if (!ids.length) return fail(400, ['请用 ?sourceId=a,b 指定要查询的 sourceId'])
    if (ids.length > 50) return fail(400, [`一次最多查询 50 个，本次 ${ids.length} 个`])
    const items = await Promise.all(ids.map(async (id) => publicState(await stateOf(req.payload, id))))
    return Response.json({ ok: true, items, quota: await quota(req.payload) })
  },
}

const format: Endpoint = {
  path: '/content-api/format',
  method: 'get',
  handler: async (req) => {
    const denied = await authorize(req)
    if (denied) return denied
    return Response.json({ ok: true, doc: FORMAT, example: EXAMPLE, quota: await quota(req.payload) })
  },
}

// —— 后台（只认管理员登录）——

const adminOnly = (req: PayloadRequest) => (isAdmin(req.user) ? null : fail(401, ['请先登录后台']))

const adminStatus: Endpoint = {
  path: '/content-api/admin',
  method: 'get',
  handler: async (req) => {
    const denied = adminOnly(req)
    if (denied) return denied
    const s = await settings(req.payload)
    return Response.json({
      ok: true,
      hasKey: Boolean(s.keyHash),
      keyLast4: s.keyHash ? s.keyLast4 : null,
      keyCreatedAt: s.keyHash ? s.keyCreatedAt : null,
      lastUsedAt: s.keyHash ? s.lastUsedAt : null,
      quota: await quota(req.payload),
      days: await lastDays(req.payload, 7),
    })
  },
}

const adminKey = (method: 'post' | 'delete'): Endpoint => ({
  path: '/content-api/admin/key',
  method,
  handler: async (req) => {
    const denied = adminOnly(req)
    if (denied) return denied
    if (method === 'delete') {
      await req.payload.updateGlobal({ slug: SLUG, data: { keyHash: '', keyLast4: '', keyCreatedAt: null, lastUsedAt: null }, overrideAccess: true })
      return Response.json({ ok: true })
    }
    // 生成新密钥：旧的同时失效；明文只在这次返回
    const key = newKey()
    const keyCreatedAt = new Date().toISOString()
    await req.payload.updateGlobal({
      slug: SLUG,
      data: { keyHash: hashKey(key), keyLast4: key.slice(-4), keyCreatedAt, lastUsedAt: null },
      overrideAccess: true,
    })
    return Response.json({ ok: true, key, keyLast4: key.slice(-4), keyCreatedAt })
  },
})

export const contentApiEndpoints: Endpoint[] = [upload, query, format, adminStatus, adminKey('post'), adminKey('delete')]
