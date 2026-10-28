// 035：给某个单元补 n 个"首次作答"（每次一个新的假设备号），e2e 和手动验证用。
// 用完调 clearStats 清掉这个单元的统计
import { sql } from '@payloadcms/db-postgres'
import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'

import { getPracticeUnit } from '../../src/content/practiceUnit'
import type { Answers } from '../../src/exam/practice'
import { drizzle, recordAttempt, whoOf } from '../../src/stats/record'

export const seedFirstAttempts = async (payload: Payload, unitId: string, n: number, answersFor: (i: number) => Answers = () => ({})) => {
  const unit = await getPracticeUnit(unitId)
  if (!unit) throw new Error(`单元 ${unitId} 不存在`)
  for (let i = 0; i < n; i++)
    await recordAttempt(payload, { who: whoOf(null, randomUUID())!, unit, answers: answersFor(i), at: Date.now() - i, source: 'live' })
}

export const clearStats = async (payload: Payload, unitKey: string) => {
  const db = drizzle(payload)
  await db.execute(sql`DELETE FROM stat_attempts WHERE unit_key = ${unitKey}`)
  await db.execute(sql`DELETE FROM answer_tallies WHERE unit_key = ${unitKey}`)
  await db.execute(sql`DELETE FROM question_keys WHERE unit_key = ${unitKey}`)
}
