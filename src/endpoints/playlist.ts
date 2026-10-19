import type { Endpoint, PayloadRequest, Where } from 'payload'

import { getPracticeUnit } from '../content/practiceUnit'
import { parseUnitId, type TranscriptLine } from '../exam/practice'

// 听力连播列表（022 contracts/api.md、research R2）：公开、只读已发布内容，每次最多 10 项
const PAGE = 10

export type RadioItem = { id: string; title: string; part: number; tag: string; audioUrl: string; lines: TranscriptLine[] | null }

const fail = (error: string, status: number) => Response.json({ error }, { status })

const item = async (id: string, part: number, tag: string): Promise<RadioItem | null> => {
  const u = await getPracticeUnit(id)
  const s = u?.module === 'listening' ? u.sections[0] : undefined
  if (!u || !s?.audioUrl) return null
  return { id, title: u.title.replace(/ · (听力 )?Part \d+$/, ''), part, tag, audioUrl: s.audioUrl, lines: Array.isArray(s.transcript) ? s.transcript : null }
}

const unitList = async (req: PayloadRequest, docId: number | null, inclusive: boolean): Promise<RadioItem[] | null> => {
  const { payload } = req
  const base: Where[] = [{ module: { equals: 'listening' } }, { _status: { equals: 'published' } }]
  let where: Where = { and: base }
  if (docId !== null) {
    const res = await payload.find({ collection: 'units', where: { and: [...base, { id: { equals: docId } }] }, depth: 0, limit: 1 })
    const from = res.docs[0]
    if (!from) return null
    const tag: Where = from.sourceTag ? { sourceTag: { equals: from.sourceTag } } : { sourceTag: { exists: false } }
    where = {
      and: [
        ...base,
        tag,
        { or: [{ part: { greater_than: from.part } }, { and: [{ part: { equals: from.part } }, { id: { [inclusive ? 'greater_than_equal' : 'greater_than']: from.id } }] }] },
      ],
    }
  }
  const res = await payload.find({ collection: 'units', where, sort: docId === null ? ['sourceTag', 'part', 'id'] : ['part', 'id'], depth: 0, limit: PAGE })
  const docs = docId === null ? res.docs.slice(0, 1) : res.docs
  // 没有参数时只确定第一项，再按"从它开始"取一整批
  if (docId === null) return docs[0] ? unitList(req, docs[0].id, true) : []
  const items = await Promise.all(docs.map((d) => item(`u${d.id}`, d.part, d.sourceTag ?? '')))
  return items.filter((x): x is RadioItem => x !== null)
}

export const playlistEndpoint: Endpoint = {
  path: '/listening/playlist',
  method: 'get',
  handler: async (req) => {
    const start = req.searchParams.get('start')
    const after = req.searchParams.get('after')
    if (start && after) return fail('参数不对', 400)
    const raw = start ?? after
    if (!raw) return Response.json({ items: (await unitList(req, null, true)) ?? [] })

    const p = parseUnitId(raw)
    if (!p) return fail('参数不对', 400)
    if (p.kind === 'unit') {
      const items = await unitList(req, p.docId, Boolean(start))
      return items === null ? fail('没找到', 404) : Response.json({ items })
    }
    // 套题：本套从当前 Part 到 Part 4
    if (p.module !== 'l' || !p.section) return fail('参数不对', 400)
    const first = start ? p.section : p.section + 1
    const ids = Array.from({ length: Math.max(0, 5 - first) }, (_, i) => first + i)
    const items = (await Promise.all(ids.map((n) => item(`t${p.docId}-l${n}`, n, '')))).filter((x): x is RadioItem => x !== null)
    if (start && (!items.length || items[0].part !== p.section)) return fail('没找到', 404)
    return Response.json({ items })
  },
}
