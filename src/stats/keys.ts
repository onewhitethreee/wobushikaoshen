// 035：单元发布时比对每题的答案快照（research R6）。只多了可接受答案 → 这题的 tally 逐行重判；
// 改掉或删掉原答案 → 这题清零、记 resetAt；题号已不在单元里 → 删掉它的快照和 tally（spec Edge Cases）
import { sql } from '@payloadcms/db-postgres'
import type { CollectionAfterChangeHook, Payload } from 'payload'

import { answerLines, isCorrect, normalize, scoreMulti, type QuestionType } from '@/exam/scoring'

import { drizzle } from './record'

export type KeyQuestion = { number: number; span: number; type: QuestionType; answers: string; maxWords?: number | null; numberAllowed?: boolean | null }

type RawGroup = {
  type: QuestionType
  maxWords?: number | null
  numberAllowed?: boolean | null
  questions?: { number: number; span?: number | null; answers: string }[] | null
}

const flatten = (groups: RawGroup[] | null | undefined): KeyQuestion[] =>
  (groups ?? []).flatMap((g) =>
    (g.questions ?? []).map((q) => ({ number: q.number, span: Math.max(q.span ?? 1, 1), type: g.type, answers: q.answers, maxWords: g.maxWords, numberAllowed: g.numberAllowed })),
  )

/** 直接从保存后的文档取题：afterChange 里 getPracticeUnit 可能还读不到本次事务里的新内容 */
export const unitDocQuestions = (doc: { id: number; groups?: RawGroup[] | null }) => [{ unitKey: `u${doc.id}`, questions: flatten(doc.groups) }]

export const testDocQuestions = (doc: {
  id: number
  listening?: { parts?: { groups?: RawGroup[] | null }[] | null } | null
  reading?: { passages?: { groups?: RawGroup[] | null }[] | null } | null
}) => [
  { unitKey: `t${doc.id}-l`, questions: (doc.listening?.parts ?? []).flatMap((p) => flatten(p.groups)) },
  { unitKey: `t${doc.id}-r`, questions: (doc.reading?.passages ?? []).flatMap((p) => flatten(p.groups)) },
]

const lines = (answers: string) => answerLines(answers).map(normalize)

/** 按新答案算某种作答的得分；answer 是 tally 里存的规范化作答 */
export const creditOf = (q: KeyQuestion, answer: string) =>
  q.type === 'multi_choice' ? scoreMulti(answer ? answer.split(', ') : [], q.answers) : isCorrect(answer, q.answers, q) ? 1 : 0

export const syncKeys = async (payload: Payload, unitKey: string, questions: KeyQuestion[], now = new Date()) =>
  drizzle(payload).transaction(async (tx) => {
    const { rows } = await tx.execute(sql`SELECT number::int AS number, answers FROM question_keys WHERE unit_key = ${unitKey}`)
    const byNumber = new Map(questions.map((q) => [q.number, q]))
    for (const row of rows) {
      const number = row.number as number
      const q = byNumber.get(number)
      if (!q) {
        await tx.execute(sql`DELETE FROM answer_tallies WHERE unit_key = ${unitKey} AND number = ${number}`)
        await tx.execute(sql`DELETE FROM question_keys WHERE unit_key = ${unitKey} AND number = ${number}`)
        continue
      }
      const old = new Set(String(row.answers ?? '').split('\n').filter(Boolean))
      const cur = lines(q.answers)
      const curSet = new Set(cur)
      if (old.size === curSet.size && [...old].every((a) => curSet.has(a))) continue
      const snapshot = cur.join('\n')
      if ([...old].every((a) => curSet.has(a))) {
        const { rows: tallies } = await tx.execute(sql`SELECT id, answer FROM answer_tallies WHERE unit_key = ${unitKey} AND number = ${number} AND NOT unknown`)
        for (const t of tallies) await tx.execute(sql`UPDATE answer_tallies SET credit = ${creditOf(q, String(t.answer))} WHERE id = ${t.id}`)
        await tx.execute(sql`UPDATE question_keys SET answers = ${snapshot}, updated_at = now() WHERE unit_key = ${unitKey} AND number = ${number}`)
      } else {
        await tx.execute(sql`DELETE FROM answer_tallies WHERE unit_key = ${unitKey} AND number = ${number}`)
        await tx.execute(sql`UPDATE question_keys SET answers = ${snapshot}, reset_at = ${now.toISOString()}, updated_at = now() WHERE unit_key = ${unitKey} AND number = ${number}`)
      }
    }
  })

/** Units / Tests 的 afterChange：只在发布时同步；出错只记日志，不挡保存 */
export const syncOnPublish =
  <D,>(pick: (doc: D) => { unitKey: string; questions: KeyQuestion[] }[]): CollectionAfterChangeHook =>
  async ({ doc, req }) => {
    if (doc._status !== 'published') return doc
    try {
      for (const { unitKey, questions } of pick(doc as D)) await syncKeys(req.payload, unitKey, questions)
    } catch (e) {
      req.payload.logger.error(e, '作答统计：同步答案快照失败')
    }
    return doc
  }
