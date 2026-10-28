// pnpm stats:backfill：035 上线时用登录考生已同步的交卷记录回填题目作答统计（research R7）。
// 走实时提交同一个 recordAttempt；去重键与实时相同（账号 + 单元 + 交卷时间），可重复运行，不会重复计数。
// 有作答的记录按当前答案重新判分；没有作答的旧记录按当时的对错计入，不进"最常见错误答案"。
// 生产：docker compose run --rm migrate pnpm stats:backfill
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { groupNumbers, type Answers, type ScoreItem } from '../src/exam/practice'
import type { PracticeRecord } from '../src/practice/store'
import { recordAttempt, splitUnits, validAnswers, whoOf } from '../src/stats/record'

const payload = await getPayload({ config })
const count = { records: 0, withAnswers: 0, withoutAnswers: 0, recorded: 0, duplicate: 0, missing: 0, invalid: 0 }

let page = 1
for (;;) {
  const res = await payload.find({ collection: 'member-data', depth: 0, limit: 100, page, sort: 'id', overrideAccess: true })
  for (const row of res.docs) {
    const memberId = typeof row.member === 'object' ? row.member.id : row.member
    const who = whoOf(memberId, null)!
    const records = [...(((row.data as { records?: PracticeRecord[] } | null)?.records ?? []) as PracticeRecord[])].sort((a, b) => a.at - b.at)
    for (const r of records) {
      count.records++
      const has = Boolean(r.answers)
      if (has) count.withAnswers++
      else count.withoutAnswers++
      const parts = await splitUnits(r.unitId, r.answers ?? {})
      if (!parts) {
        count.missing++
        continue
      }
      for (const { unit, answers } of parts) {
        const nums = new Set(unit.sections.flatMap((s) => s.groups.flatMap(groupNumbers)))
        // 旧记录里可能有现在已经不在单元里的题号：只留还在的
        const kept: Answers = Object.fromEntries(Object.entries(answers).filter(([k]) => nums.has(Number(k))))
        const checked = has ? validAnswers(unit, kept) : {}
        if (!checked) {
          count.invalid++
          continue
        }
        const items: ScoreItem[] | undefined = has ? undefined : (r.items ?? []).filter((i) => nums.has(i.number))
        const ok = await recordAttempt(payload, { who, unit, answers: checked, at: r.at, source: 'backfill', items })
        if (ok) count.recorded++
        else count.duplicate++
      }
    }
  }
  if (!res.hasNextPage) break
  page++
}

console.log(
  `交卷记录 ${count.records} 条（有作答 ${count.withAnswers}、无作答 ${count.withoutAnswers}）；` +
    `记入 ${count.recorded} 个单元，已记过跳过 ${count.duplicate}，单元已不存在跳过 ${count.missing}，作答格式不对跳过 ${count.invalid}`,
)
process.exit(0)
