import type { Endpoint, PayloadRequest } from 'payload'

import { clientIp } from '../account/codes'
import { getPracticeUnit } from '../content/practiceUnit'
import { allow } from '../stats/limit'
import { unitPublic, type UnitPublic } from '../stats/read'
import { recordAttempt, splitUnits, validAnswers, whoOf } from '../stats/record'

// 035 题目作答统计（contracts/api.md）。登录、未登录都能交；服务端自己判分，客户端传的 items / score 一律不读（FR-004a）
const MAX_BODY = 32 * 1024
const DAY = 24 * 3600 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (error: string, status: number) => Response.json({ error }, { status })
const done = () => new Response(null, { status: 204 })

const post: Endpoint = {
  path: '/stats/attempts',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return fail('数据太大', 413)
    const text = (await req.text?.().catch(() => '')) ?? ''
    if (Buffer.byteLength(text) > MAX_BODY) return fail('数据太大', 413)
    let body: Record<string, unknown> | null = null
    try {
      body = JSON.parse(text)
    } catch {}
    if (!body || typeof body !== 'object') return fail('数据格式不对', 400)
    const { unitId, at, answers, device, units } = body
    if (typeof unitId !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) return fail('数据格式不对', 400)
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return fail('数据格式不对', 400)
    const memberId = req.user?.collection === 'members' ? (req.user.id as number) : null
    const who = whoOf(memberId, typeof device === 'string' && UUID.test(device) ? device : null)
    if (!who) return fail('数据格式不对', 400)
    const ids = Array.isArray(units) && units.every((x) => Number.isInteger(x)) ? (units as number[]) : undefined

    // 先粗查题号，再按模考拆单元，每个单元单独校验
    const parts = await splitUnits(unitId, answers as Record<number, string | string[]>, ids)
    if (!parts) return fail('题目不存在', 404)
    const checked = parts.map((p) => ({ unit: p.unit, answers: validAnswers(p.unit, p.answers) }))
    if (checked.some((p) => !p.answers)) return fail('题号或作答对不上', 400)
    // 模考拆完后，原始作答里每个题号都要落到某个单元里，否则说明有对不上的题号
    const kept = parts.reduce((n, p) => n + Object.keys(p.answers).length, 0)
    if (kept !== Object.keys(answers).length) return fail('题号或作答对不上', 400)

    // 限频丢弃也回 204，不让刷数据的人知道记没记上（contracts/api.md）
    if (!allow(clientIp(req), who, unitId)) return done()
    const time = Math.abs(at - Date.now()) > DAY ? Date.now() : at
    for (const p of checked) await recordAttempt(req.payload, { who, unit: p.unit, answers: p.answers!, at, time, source: 'live' })
    return done()
  },
}

// 前台单元统计：公开；门槛和"不返回作答文本"在 unitPublic 里执行。内存缓存 5 分钟（FR-013、research R9）
// ponytail: 缓存不设上限，键是单元 id，数量有限
const CACHE_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; data: UnitPublic }>()

const get: Endpoint = {
  path: '/stats/unit',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const id = req.searchParams.get('id') ?? ''
    const hit = cache.get(id)
    if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.data)
    const unit = await getPracticeUnit(id)
    if (!unit) return fail('题目不存在', 404)
    const numbers = unit.sections.flatMap((s) => s.groups.flatMap((g) => g.questions.map((q) => q.number)))
    const data = await unitPublic(req.payload, unit.id, numbers)
    cache.set(id, { at: Date.now(), data })
    return Response.json(data)
  },
}

export const statsEndpoints: Endpoint[] = [post, get]
