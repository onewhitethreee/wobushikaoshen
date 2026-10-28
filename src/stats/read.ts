// 035 题目作答统计的读取（data-model「派生口径」）：后台三个页签、前台单元统计、栏目"N 人做过"共用，口径只写一份
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { unitKeyOf } from '@/endpoints/answerReports'

import { drizzle } from './record'

/** 考生前台显示门槛：首次作答不足 20 人不显示（FR-017） */
export const MIN_PEOPLE = 20
export const PAGE_SIZE = 50

type SQL = ReturnType<typeof sql>

const rows = async (payload: Payload, q: SQL) => (await drizzle(payload).execute(q)).rows
const and = (conds: (SQL | false | '' | undefined)[]) => {
  const list = conds.filter((c): c is SQL => Boolean(c))
  return list.length ? sql.join(list, sql` AND `) : sql`TRUE`
}

// 已发布的单元和套题（每科一行），带标题、考试、科目、题集；下架的不出现（spec Edge Cases）
const DOCS = sql`
  SELECT 'u' || id AS unit_key, id AS doc_id, 'units' AS coll, title, COALESCE(exam::text, 'ielts') AS exam, module::text AS module, source_tag::text AS tag
  FROM units WHERE _status = 'published'
  UNION ALL SELECT 't' || id || '-l', id, 'tests', title, 'ielts', 'listening', NULL FROM tests WHERE _status = 'published'
  UNION ALL SELECT 't' || id || '-r', id, 'tests', title, 'ielts', 'reading', NULL FROM tests WHERE _status = 'published'`

export type Filters = { exam?: string; module?: string; type?: string; tag?: string }

export type QuestionRow = {
  unitKey: string
  docId: number
  coll: 'units' | 'tests'
  title: string
  module: string
  number: number
  span: number
  qType: string
  people: number
  total: number
  rate: number | null
  avg: number | null
  blank: number
  resetAt: string | null
  wrong: { a: string; n: number }[]
}

/** 逐题（FR-008、FR-009）：min 按首次作答次数算；sort rate 升序 / count 降序 */
export const questionRows = async (
  payload: Payload,
  f: Filters & { unitKey?: string; min?: number; sort?: 'rate' | 'count'; page?: number },
): Promise<{ rows: QuestionRow[]; total: number }> => {
  const min = f.min ?? MIN_PEOPLE
  const page = Math.max(f.page ?? 1, 1)
  const order = f.sort === 'count' ? sql`total DESC, rate ASC NULLS LAST` : sql`rate ASC NULLS LAST, people DESC`
  const result = await rows(
    payload,
    sql`
    WITH docs AS (${DOCS}),
    q AS (
      SELECT t.unit_key, t.number::int AS number, MAX(t.span)::int AS span, MAX(t.q_type) AS q_type,
        SUM(t.count)::int AS total, SUM(t.first_count)::int AS people,
        COALESCE(SUM(t.first_count) FILTER (WHERE t.credit = t.span), 0)::float / NULLIF(SUM(t.first_count), 0) AS rate,
        SUM(t.first_count * t.credit)::float / NULLIF(SUM(t.first_count), 0) AS avg,
        COALESCE(SUM(t.count) FILTER (WHERE t.answer = '' AND NOT t.unknown), 0)::int AS blank
      FROM answer_tallies t
      ${f.unitKey ? sql`WHERE t.unit_key = ${f.unitKey}` : sql``}
      GROUP BY t.unit_key, t.number
    ),
    page AS (
      SELECT q.*, d.doc_id, d.coll, d.title, d.module, k.reset_at, COUNT(*) OVER () AS full_count
      FROM q
      JOIN docs d ON d.unit_key = q.unit_key
      -- 题号已不在单元里的旧数据：快照随发布删掉，这里一起排除（spec Edge Cases）
      JOIN question_keys k ON k.unit_key = q.unit_key AND k.number = q.number
      WHERE ${and([
        sql`q.people >= ${min}`,
        f.exam && sql`d.exam = ${f.exam}`,
        f.module && sql`d.module = ${f.module}`,
        f.type && sql`q.q_type = ${f.type}`,
        f.tag && sql`d.tag = ${f.tag}`,
      ])}
      ORDER BY ${order}, q.unit_key, q.number
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    )
    SELECT page.*, COALESCE(w.wrong, '[]'::json) AS wrong
    FROM page
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('a', x.answer, 'n', x.first_count::int) ORDER BY x.first_count DESC) AS wrong
      FROM (
        SELECT answer, first_count FROM answer_tallies
        WHERE unit_key = page.unit_key AND number = page.number AND credit < span AND answer <> '' AND NOT unknown AND first_count > 0
        ORDER BY first_count DESC, answer LIMIT 3
      ) x
    ) w ON TRUE
    ORDER BY ${order}, page.unit_key, page.number`,
  )
  return {
    total: Number(result[0]?.full_count ?? 0),
    rows: result.map((r) => ({
      unitKey: String(r.unit_key),
      docId: Number(r.doc_id),
      coll: r.coll as 'units' | 'tests',
      title: String(r.title),
      module: String(r.module),
      number: Number(r.number),
      span: Number(r.span),
      qType: String(r.q_type),
      people: Number(r.people),
      total: Number(r.total),
      rate: r.rate === null ? null : Number(r.rate),
      avg: r.avg === null ? null : Number(r.avg),
      blank: Number(r.blank),
      resetAt: r.reset_at ? new Date(r.reset_at as string).toISOString() : null,
      wrong: (r.wrong as { a: string; n: number }[]) ?? [],
    })),
  }
}

export type UnitRow = {
  unitKey: string
  docId: number
  coll: 'units' | 'tests'
  title: string
  exam: string
  module: string
  tag: string | null
  attempts: number
  people: number
  avgRate: number | null
  lastAt: string | null
}

/** 单元（FR-007）：所有已发布单元，没人做过的作答 0；按题型练习的 u12-g2 不进单元列表 */
export const unitRows = async (payload: Payload, f: Filters & { sort?: 'count' | '-count'; page?: number }): Promise<{ rows: UnitRow[]; total: number }> => {
  const page = Math.max(f.page ?? 1, 1)
  const dir = f.sort === '-count' ? sql`ASC` : sql`DESC`
  const result = await rows(
    payload,
    sql`
    WITH docs AS (${DOCS}),
    a AS (
      SELECT unit_key, COUNT(*)::int AS attempts, (COUNT(*) FILTER (WHERE first))::int AS people,
        AVG(score::float / NULLIF(total, 0)) FILTER (WHERE first) AS avg_rate, MAX(at) AS last_at
      FROM stat_attempts
      WHERE unit_id = unit_key OR unit_id ~ '^t[0-9]+-[lr][0-9]+$'
      GROUP BY unit_key
    )
    SELECT d.*, COALESCE(a.attempts, 0) AS attempts, COALESCE(a.people, 0) AS people, a.avg_rate, a.last_at, COUNT(*) OVER () AS full_count
    FROM docs d LEFT JOIN a ON a.unit_key = d.unit_key
    WHERE ${and([f.exam && sql`d.exam = ${f.exam}`, f.module && sql`d.module = ${f.module}`, f.tag && sql`d.tag = ${f.tag}`])}
    ORDER BY attempts ${dir}, d.unit_key
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
  )
  return {
    total: Number(result[0]?.full_count ?? 0),
    rows: result.map((r) => ({
      unitKey: String(r.unit_key),
      docId: Number(r.doc_id),
      coll: r.coll as 'units' | 'tests',
      title: String(r.title),
      exam: String(r.exam),
      module: String(r.module),
      tag: (r.tag as string | null) ?? null,
      attempts: Number(r.attempts),
      people: Number(r.people),
      avgRate: r.avg_rate === null ? null : Number(r.avg_rate),
      lastAt: r.last_at ? new Date(r.last_at as string).toISOString() : null,
    })),
  }
}

export type TypeRow = { module: string; qType: string; questions: number; people: number; rate: number | null }

/** 题型汇总（FR-011）：平均正确率按首次作答次数加权 */
export const typeRows = async (payload: Payload, f: Pick<Filters, 'exam'>): Promise<TypeRow[]> => {
  const result = await rows(
    payload,
    sql`
    WITH docs AS (${DOCS})
    SELECT d.module, t.q_type, COUNT(DISTINCT (t.unit_key, t.number))::int AS questions, SUM(t.first_count)::int AS people,
      COALESCE(SUM(t.first_count) FILTER (WHERE t.credit = t.span), 0)::float / NULLIF(SUM(t.first_count), 0) AS rate
    FROM answer_tallies t
    JOIN docs d ON d.unit_key = t.unit_key
    JOIN question_keys k ON k.unit_key = t.unit_key AND k.number = t.number
    WHERE ${and([f.exam && sql`d.exam = ${f.exam}`])}
    GROUP BY d.module, t.q_type
    ORDER BY d.module, rate ASC NULLS LAST`,
  )
  return result.map((r) => ({
    module: String(r.module),
    qType: String(r.q_type),
    questions: Number(r.questions),
    people: Number(r.people),
    rate: r.rate === null ? null : Number(r.rate),
  }))
}

export type UnitPublic = {
  unit: { people: number; avgRate: number; dist: Record<number, number> } | null
  questions: Record<number, { people: number; rate: number; avg?: number; span?: number }>
}

/** 前台单元统计（contracts/api.md GET /api/stats/unit）：门槛在这里执行，不返回任何作答文本（FR-017、FR-018） */
export const unitPublic = async (payload: Payload, unitId: string, numbers: number[]): Promise<UnitPublic> => {
  const unitKey = unitKeyOf(unitId)
  const [head] = await rows(
    payload,
    sql`SELECT (COUNT(*) FILTER (WHERE first))::int AS people, AVG(score::float / NULLIF(total, 0)) FILTER (WHERE first) AS avg_rate
        FROM stat_attempts WHERE unit_id = ${unitId}`,
  )
  let unit: UnitPublic['unit'] = null
  if (Number(head?.people ?? 0) >= MIN_PEOPLE) {
    const dist = await rows(payload, sql`SELECT score::int AS score, COUNT(*)::int AS n FROM stat_attempts WHERE unit_id = ${unitId} AND first GROUP BY score`)
    unit = { people: Number(head.people), avgRate: Number(head.avg_rate), dist: Object.fromEntries(dist.map((d) => [Number(d.score), Number(d.n)])) }
  }
  const questions: UnitPublic['questions'] = {}
  if (unitKey && numbers.length) {
    const qs = await rows(
      payload,
      sql`
      SELECT t.number::int AS number, MAX(t.span)::int AS span, SUM(t.first_count)::int AS people,
        COALESCE(SUM(t.first_count) FILTER (WHERE t.credit = t.span), 0)::float / NULLIF(SUM(t.first_count), 0) AS rate,
        SUM(t.first_count * t.credit)::float / NULLIF(SUM(t.first_count), 0) AS avg
      FROM answer_tallies t
      WHERE t.unit_key = ${unitKey} AND t.number IN (${sql.join(
        numbers.map((n) => sql`${n}`),
        sql`, `,
      )})
      GROUP BY t.number
      HAVING SUM(t.first_count) >= ${MIN_PEOPLE}`,
    )
    for (const q of qs) {
      const span = Number(q.span)
      questions[Number(q.number)] = { people: Number(q.people), rate: Number(q.rate ?? 0), ...(span > 1 ? { avg: Number(q.avg ?? 0), span } : {}) }
    }
  }
  return { unit, questions }
}

/** 栏目"N 人做过"（FR-016）：所有首次作答 ≥ 20 的单元 id → 人数；结果很小，栏目页整张缓存 */
export const doneCounts = async (payload: Payload): Promise<Record<string, number>> => {
  const result = await rows(
    payload,
    sql`SELECT unit_id, (COUNT(*) FILTER (WHERE first))::int AS n FROM stat_attempts
        GROUP BY unit_id HAVING COUNT(*) FILTER (WHERE first) >= ${MIN_PEOPLE}`,
  )
  return Object.fromEntries(result.map((r) => [String(r.unit_id), Number(r.n)]))
}
