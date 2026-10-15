// pnpm backfill:summary：给已有练习单元补算栏目用的题组摘要 units.summary（fix-column-summary）。
// 新导入 / 后台保存时由 Units 的 beforeChange 钩子自动算，只有在加字段之前导入的单元需要跑一次。
// 直接写主表、不经钩子：不产生几百条版本记录，也不重新校验已发布的内容。可重复运行。
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { unitSummary } from '../src/exam/groupStats'

const payload = await getPayload({ config })
const { docs } = await payload.find({
  collection: 'units',
  depth: 0,
  pagination: false,
  select: { groups: { type: true, questions: { number: true, span: true } } },
})
for (const u of docs) await payload.db.updateOne({ collection: 'units', id: u.id, data: { summary: unitSummary(u.groups) } })
console.log(`已补算 ${docs.length} 个练习单元的题组摘要`)
process.exit(0)
