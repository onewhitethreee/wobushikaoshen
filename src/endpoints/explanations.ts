import type { Endpoint } from 'payload'

import { explain, unlockedIn } from '../review/explain'

// 错题讲解（015 contracts/api.md）：只认考生登录
const memberOf = (user: { collection?: string; id?: unknown } | null | undefined) => (user?.collection === 'members' ? (user.id as number) : null)
const guest = () => Response.json({ error: '请先登录' }, { status: 401 })

const post: Endpoint = {
  path: '/me/explanations',
  method: 'post',
  handler: async (req) => {
    const memberId = memberOf(req.user)
    if (!memberId) return guest()
    const data = ((await req.json?.()) ?? {}) as { unitId?: unknown; number?: unknown; answer?: unknown }
    const number = Number(data.number)
    const a = data.answer
    const answer = Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : typeof a === 'string' ? a : ''
    if (typeof data.unitId !== 'string' || !Number.isInteger(number)) return Response.json({ error: '题目不存在' }, { status: 404 })
    const { status, json } = await explain(req.payload, memberId, { unitId: data.unitId, number, answer })
    return Response.json(json, { status })
  },
}

const get: Endpoint = {
  path: '/me/explanations',
  method: 'get',
  handler: async (req) => {
    const memberId = memberOf(req.user)
    if (!memberId) return guest()
    const unitId = req.searchParams.get('unitId') ?? ''
    return Response.json({ items: unitId ? await unlockedIn(req.payload, memberId, unitId) : [] })
  },
}

export const explanationEndpoints = [post, get]
