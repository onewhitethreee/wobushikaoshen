import type { QuestionType } from './scoring'

type StatsGroup = { type?: QuestionType | null; questions?: { number?: number | null; span?: number | null }[] | null }

/** 题组的题数与题号范围（"1–5" / "7"），栏目行用 */
export const groupStats = (g: Pick<StatsGroup, 'questions'>) => {
  const qs = g.questions ?? []
  const nums = qs.flatMap((q) => (q.number == null ? [] : [q.number, q.number + Math.max((q.span ?? 1) - 1, 0)]))
  return {
    count: qs.reduce((n, q) => n + Math.max(q.span ?? 1, 1), 0),
    range: !nums.length ? '' : Math.min(...nums) === Math.max(...nums) ? `${nums[0]}` : `${Math.min(...nums)}–${Math.max(...nums)}`,
  }
}

/** 练习单元的题组摘要：保存时算好存进 units.summary，栏目页只读它，不再读每道小题 */
export type GroupSummary = { type: QuestionType; count: number; range: string }

export const unitSummary = (groups: StatsGroup[] | null | undefined): GroupSummary[] =>
  (groups ?? []).map((g) => ({ type: g.type as QuestionType, ...groupStats(g) })) // 发布前 validateUnit 已保证每组有题型
