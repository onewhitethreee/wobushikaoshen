import type { Endpoint } from 'payload'

import { getPracticeUnit } from '../content/practiceUnit'
import { buildPrint, MAX_PRINT, sourceOf, type PrintRequestItem } from '../practice/print'

// 错题打印（018 contracts/api.md）：公开接口，只读已发布内容；返回的不超过练习页本来就下发的题目、答案和解析
const MAX_BODY = 16 * 1024

const bad = (error: string) => Response.json({ error }, { status: 400 })

export const printEndpoint: Endpoint = {
  path: '/practice/print',
  method: 'post',
  handler: async (req) => {
    const raw = (await req.text?.().catch(() => '')) ?? ''
    if (!raw || raw.length > MAX_BODY) return bad('请求格式不对')
    let items: unknown
    try {
      items = (JSON.parse(raw) as { items?: unknown }).items
    } catch {
      return bad('请求格式不对')
    }
    if (!Array.isArray(items) || !items.length || items.length > MAX_PRINT) return bad(`一次最多打印 ${MAX_PRINT} 道`)
    const ok = items.every(
      (x): x is PrintRequestItem =>
        typeof x?.groupKey === 'string' && x.groupKey.length <= 64 && sourceOf(x.groupKey) !== null && Number.isInteger(x.number) && x.number > 0,
    )
    if (!ok) return bad('请求格式不对')
    const list = (items as PrintRequestItem[]).map(({ groupKey, number }) => ({ groupKey, number }))
    return Response.json(await buildPrint(list, getPracticeUnit))
  },
}
