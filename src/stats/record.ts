// 035 题目作答统计：记入一次交卷（research R1–R4）。实时提交（endpoints/stats.ts）和回填（scripts/backfill-stats.ts）共用，口径只写一份
import { sql } from '@payloadcms/db-postgres'
import { createHmac } from 'node:crypto'
import type { Payload } from 'payload'

import { getMockPaper, getRandomPaper } from '@/content/mockPaper'
import { getPracticeUnit } from '@/content/practiceUnit'
import { unitKeyOf } from '@/endpoints/answerReports'
import { groupNumbers, scoreUnit, type Answers, type PracticeUnit, type ScoreItem } from '@/exam/practice'
import { answerLines, normalize } from '@/exam/scoring'
import { RANDOM_NO } from '@/practice/mockAttempt'

export const MAX_ANSWER = 60

type Tx = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> }
export const drizzle = (payload: Payload) =>
  (payload.db as unknown as { drizzle: Tx & { transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> } }).drizzle

const hmac = (s: string) => createHmac('sha256', process.env.PAYLOAD_SECRET || '').update(s).digest('hex')

/** 登录看账号，未登录看本机设备号；只存哈希，只用来判断首次作答（FR-003） */
export const whoOf = (memberId: number | null, device: string | null) =>
  memberId ? hmac(`m:${memberId}`) : device ? hmac(`d:${device}`) : null

export const attemptKeyOf = (who: string, unitId: string, at: number) => hmac(`${who}|${unitId}|${at}`)

/** 去掉题组：u12-g2 → u12，t5-l1-g2 → t5-l1。首次作答按它判断（research R3） */
export const firstKeyOf = (unitId: string) => unitId.replace(/-g\d+$/, '')

const questionsOf = (unit: PracticeUnit) => unit.sections.flatMap((s) => s.groups.flatMap((g) => g.questions.map((q) => ({ g, q }))))

/** 题号都在单元里、多选是字符串数组、其余是字符串；单个作答截 60 字。不合格返回 null（FR-004a） */
export const validAnswers = (unit: PracticeUnit, answers: unknown): Answers | null => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null
  const byNumber = new Map(questionsOf(unit).map((x) => [x.q.number, x]))
  const out: Answers = {}
  for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
    const found = byNumber.get(Number(k))
    if (!found) return null
    if (found.g.type === 'multi_choice') {
      if (!Array.isArray(v) || v.length > 10 || !v.every((x) => typeof x === 'string')) return null
      out[found.q.number] = v.map((x) => x.slice(0, MAX_ANSWER))
    } else {
      if (typeof v !== 'string') return null
      out[found.q.number] = v.slice(0, MAX_ANSWER)
    }
  }
  return out
}

const MOCK_RE = /^m(\d+)-([lr])$/

/** 模考 m{no}-l|r 拆回来源单元，按题号分作答（research R4）；其余原样。单元 / 卷子取不到返回 null */
export const splitUnits = async (unitId: string, answers: Answers, units?: number[]) => {
  const m = MOCK_RE.exec(unitId)
  if (!m) {
    const unit = await getPracticeUnit(unitId)
    return unit ? [{ unit, answers }] : null
  }
  const no = Number(m[1])
  const paper = no === RANDOM_NO ? await getRandomPaper(units ?? []) : await getMockPaper(no)
  if (!paper) return null
  const mod = m[2] === 'l' ? 'listening' : 'reading'
  const parts: { unit: PracticeUnit; answers: Answers }[] = []
  for (const id of paper.units) {
    const unit = await getPracticeUnit(`u${id}`)
    if (!unit) return null
    if (unit.module !== mod) continue
    const nums = new Set(unit.sections.flatMap((s) => s.groups.flatMap(groupNumbers)))
    parts.push({ unit, answers: Object.fromEntries(Object.entries(answers).filter(([k]) => nums.has(Number(k)))) })
  }
  return parts
}

/** 作答 → tally 的 answer 列：normalize、截 60 字；多选排序后用 ", " 连接；空为 '' */
export const answerText = (a: Answers[number] | undefined) =>
  (Array.isArray(a) ? a.map(normalize).filter(Boolean).sort().join(', ') : normalize(a ?? '')).slice(0, MAX_ANSWER)

export type RecordInput = {
  who: string
  unit: PracticeUnit
  answers: Answers
  /** 本机交卷记录的时间戳，去重键用它 */
  at: number
  /** 存进库的交卷时间；客户端时钟偏太多时由接口换成服务器时间，去重键仍用 at */
  time?: number
  source: 'live' | 'backfill'
  /** 回填时记录没有作答：用记录里的对错，写 unknown 行（research R7） */
  items?: ScoreItem[]
}

/** 记入一次交卷；同一 who + 单元 + at 已记过返回 false（FR-004、SC-005） */
export const recordAttempt = async (payload: Payload, { who, unit, answers, at, time = at, source, items: given }: RecordInput) => {
  const unknown = Boolean(given)
  const items = given ?? scoreUnit(unit, answers).items
  const correct = new Set(items.filter((i) => i.correct).map((i) => i.number))
  const qs = questionsOf(unit)
  const rows = qs.map(({ g, q }) => {
    const span = Math.max(q.span, 1)
    let credit = 0
    for (let i = 0; i < span; i++) if (correct.has(q.number + i)) credit++
    return { number: q.number, type: g.type, span, credit, answer: unknown ? String(credit) : answerText(answers[q.number]), keys: answerLines(q.answers).map(normalize).join('\n') }
  })
  const score = rows.reduce((s, r) => s + r.credit, 0)
  const total = rows.reduce((s, r) => s + r.span, 0)
  // 键一律用拆分后的单元 id（模考是来源单元 u{id}），否则同一场模考的 4 个单元同键，只记得上第一个
  const unitKey = unitKeyOf(unit.id)!
  const firstKey = firstKeyOf(unit.id)
  const when = new Date(time).toISOString()

  return drizzle(payload).transaction(async (tx) => {
    // ponytail: 同一人并发提交时两条可能都算首次，影响可忽略
    const { rows: inserted } = await tx.execute(sql`
      INSERT INTO stat_attempts (attempt_key, who, unit_id, unit_key, first_key, exam, module, score, total, first, at, source)
      VALUES (${attemptKeyOf(who, unit.id, at)}, ${who}, ${unit.id}, ${unitKey}, ${firstKey}, ${unit.exam ?? 'ielts'}, ${unit.module},
        ${score}, ${total}, NOT EXISTS (SELECT 1 FROM stat_attempts WHERE who = ${who} AND first_key = ${firstKey}), ${when}, ${source})
      ON CONFLICT (attempt_key) DO NOTHING
      RETURNING first`)
    if (!inserted.length) return false
    if (!rows.length) return true
    const first = inserted[0].first ? 1 : 0
    await tx.execute(sql`
      INSERT INTO answer_tallies (unit_key, number, answer, unknown, q_type, span, credit, count, first_count, last_at)
      VALUES ${sql.join(
        rows.map((r) => sql`(${unitKey}, ${r.number}, ${r.answer}, ${unknown}, ${r.type}, ${r.span}, ${r.credit}, 1, ${first}, ${when})`),
        sql`, `,
      )}
      ON CONFLICT (unit_key, number, unknown, answer) DO UPDATE SET
        count = answer_tallies.count + 1,
        first_count = answer_tallies.first_count + EXCLUDED.first_count,
        credit = EXCLUDED.credit,
        last_at = GREATEST(answer_tallies.last_at, EXCLUDED.last_at)`)
    // 快照在第一次记入这题时写：有统计的题一定有快照，改答案时才有东西可比（research R6）
    await tx.execute(sql`
      INSERT INTO question_keys (unit_key, number, answers)
      VALUES ${sql.join(
        rows.map((r) => sql`(${unitKey}, ${r.number}, ${r.keys})`),
        sql`, `,
      )}
      ON CONFLICT (unit_key, number) DO NOTHING`)
    return true
  })
}
