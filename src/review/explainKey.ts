import type { GroupView } from '@/exam/practice'
import { isCorrect, normalize, scoreMulti } from '@/exam/scoring'

// 错题讲解的缓存键与判错（015 research R6）：纯函数，服务端和解析面板共用

export type Given = string | string[]

/** 规范化后的作答：多选排序后逗号连接，未作答为 ∅ */
export const answerKey = (answer: Given | undefined) => {
  const parts = (Array.isArray(answer) ? answer : [answer ?? '']).map(normalize).filter(Boolean)
  return parts.length ? [...parts].sort().join(',') : '∅'
}

export const cacheKey = (groupKey: string, number: number, version: string, answer: Given | undefined) =>
  `${groupKey}#${number}|${version}|${answerKey(answer)}`

/** 答错或未作答；多选没拿满分算错 */
export const isWrong = (group: GroupView, q: GroupView['questions'][number], answer: Given | undefined) =>
  group.type === 'multi_choice'
    ? scoreMulti(Array.isArray(answer) ? answer : [], q.answers) < Math.max(q.span, 1)
    : !(typeof answer === 'string' && isCorrect(answer, q.answers, group))
