import type { PracticeUnit } from '@/exam/practice'

// 解析面板的翻页顺序（008 research R2）：分部 → 题组 → 题目，每道题一项，多选题按首题号只出一项
export type ExplainStop = { section: number; anchor: number }

export const explainOrder = (unit: PracticeUnit): ExplainStop[] =>
  unit.sections.flatMap((s, section) => s.groups.flatMap((g) => g.questions.map((q) => ({ section, anchor: q.number }))))
