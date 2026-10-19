// 错题本（009 research R8）：由交卷记录算出，不单独存。每道题（题组 + 题号）看最近一次作答
import { parseUnitId, type Answers } from '@/exam/practice'
import type { QuestionType } from '@/exam/scoring'
import type { Mark, PracticeRecord } from '@/practice/store'

export type Mistake = {
  key: string // groupKey#number
  groupKey: string
  number: number
  module: 'l' | 'r'
  type: QuestionType
  at: number // 最近一次作答时间
  /** 最近一次作答那份记录的全部答案（多选题的答案挂在首个题号上，展示时按题组找） */
  answers?: Answers
  state: 'wrong' | 'mastered'
}

export const moduleOf = (r: PracticeRecord, groupKey: string): 'l' | 'r' | undefined => {
  if (r.module) return r.module
  const p = parseUnitId(groupKey) ?? parseUnitId(r.unitId)
  return p?.kind === 'test' ? p.module : undefined
}

/** 错过的题：最近一次错 → wrong；曾错、最近一次对 → mastered。按最近作答时间倒序，去掉已移除的 */
export const mistakes = (records: PracticeRecord[], dismissed: Record<string, Mark> = {}): Mistake[] => {
  const latest = new Map<string, Mistake>()
  const everWrong = new Set<string>()
  for (const r of [...records].sort((a, b) => a.at - b.at))
    for (const x of r.items) {
      const key = `${x.groupKey}#${x.number}`
      if (!x.correct) everWrong.add(key)
      const mod = moduleOf(r, x.groupKey)
      if (!mod) continue
      latest.set(key, {
        key,
        groupKey: x.groupKey,
        number: x.number,
        module: mod,
        type: x.type,
        at: r.at,
        answers: r.answers,
        state: x.correct ? 'mastered' : 'wrong',
      })
    }
  return [...latest.values()]
    .filter((m) => everWrong.has(m.key) && !dismissed[m.key]?.on)
    .sort((a, b) => b.at - a.at || (a.key < b.key ? -1 : 1))
}
