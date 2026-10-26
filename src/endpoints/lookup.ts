import type { Endpoint, PayloadRequest } from 'payload'

import { getPracticeUnit } from '../content/practiceUnit'
import { EXAM_NAME, isCet } from '../exam/cet'
import { parseUnitId, type Option } from '../exam/practice'
import type { QuestionType } from '../exam/scoring'

// 错题本、收藏列表的展示数据（009 contracts/api.md）：按 id 查标题、链接；题组还带题干和答案。
// 公开接口：返回的内容和练习页本来就下发给浏览器的一样，只查已发布的
const MAX_IDS = 20

export type LookupQuestion = { number: number; span: number; type: QuestionType; prompt?: string; answers: string; options: Option[] }
export type LookupItem =
  | { gone: true }
  | { gone: false; title: string; module: 'listening' | 'reading' | 'writing'; href: string; questions?: LookupQuestion[] }

const one = async (req: PayloadRequest, id: string): Promise<LookupItem> => {
  const w = /^w:(\d+)$/.exec(id)
  if (w) {
    const res = await req.payload.find({
      collection: 'writing-tasks',
      where: { and: [{ id: { equals: Number(w[1]) } }, { _status: { equals: 'published' } }] },
      depth: 0,
      limit: 1,
    })
    const t = res.docs[0]
    // 033：四 / 六级题在收藏、错题列表里标出考试
    const name = t && isCet(t.exam) ? `${EXAM_NAME[t.exam]} · ` : ''
    return t ? { gone: false, title: name + (t.titleZh ?? t.title), module: 'writing', href: `/writing/${t.id}` } : { gone: true }
  }
  const p = parseUnitId(id)
  const unit = p && (await getPracticeUnit(id))
  if (!unit) return { gone: true }
  return {
    gone: false,
    title: unit.title,
    module: unit.module,
    href: `/practice/${unit.id}`,
    questions: p.group
      ? unit.sections.flatMap((s) =>
          s.groups.flatMap((g) =>
            g.questions.map((q) => ({
              number: q.number,
              span: q.span,
              type: g.type,
              prompt: q.prompt,
              answers: q.answers,
              options: q.options.length ? q.options : g.options,
            })),
          ),
        )
      : undefined,
  }
}

export const lookupEndpoint: Endpoint = {
  path: '/practice/lookup',
  method: 'get',
  handler: async (req) => {
    const ids = [...new Set(String(req.searchParams.get('ids') ?? '').split(',').filter(Boolean))]
    if (ids.length > MAX_IDS || ids.some((i) => i.length > 64)) return Response.json({ error: `一次最多查 ${MAX_IDS} 个` }, { status: 400 })
    const items = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await one(req, id)] as const)))
    return Response.json({ items })
  },
}
