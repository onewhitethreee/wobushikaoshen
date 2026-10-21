// pnpm mock:compose [--dry-run]
// 028 组卷（research R9）：用还没进过任何模考卷的已发布单元组出草稿卷，编号接着已有的往后排；已有卷子不动
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { composePapers, SLOTS, type ComposeUnit } from '../src/exam/mock'
import type { MockPaper, Unit } from '../src/payload-types'

const dry = process.argv.includes('--dry-run')
const payload = await getPayload({ config })

const units = (
  await payload.find({
    collection: 'units',
    where: { _status: { equals: 'published' } },
    select: { module: true, part: true, sourceSets: true, groups: true },
    depth: 0,
    pagination: false,
  })
).docs as Unit[]

const papers = (await payload.find({ collection: 'mock-papers', depth: 0, pagination: false, draft: true })).docs as MockPaper[]
const used = new Set(papers.flatMap((p) => SLOTS.map((s) => p[s.key] as number)))
const startNo = Math.max(0, ...papers.map((p) => p.no)) + 1

const all: ComposeUnit[] = units.map((u) => ({
  id: u.id,
  module: u.module,
  part: u.part,
  sourceSets: u.sourceSets,
  numbers: (u.groups ?? []).flatMap((g) => (g.questions ?? []).flatMap((q) => Array.from({ length: Math.max(q.span ?? 1, 1) }, (_, i) => q.number + i))),
}))

const { papers: out, skipped, sameSet } = composePapers(all, used, startNo)
console.log(`已发布单元 ${units.length} 个，已进卷 ${used.size} 个；可组 ${out.length} 张（阅读同题集 ${sameSet} 张）`)
if (skipped.length) console.log(`题号不合规、跳过的单元：${skipped.join(', ')}`)

if (!dry && out.length) {
  for (const p of out) await payload.create({ collection: 'mock-papers', draft: true, data: { ...p, _status: 'draft' } })
  console.log(`已建草稿：模考 ${out[0].no}–${out[out.length - 1].no}`)
}
process.exit(0)
