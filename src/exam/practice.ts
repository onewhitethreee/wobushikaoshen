// 练习单位与整组判分（纯函数），形状见 specs/003-practice-ui/data-model.md
import { isCorrect, scoreMulti, type QuestionType } from './scoring'

export type UnitId = string
export type Module = 'l' | 'r'
// 套题 t{id}-{l|r}[n][-g{k}]；练习单元 u{id}[-g{k}]（007 research R9）
export type ParsedUnit =
  | { kind: 'test'; docId: number; module: Module; section?: number; group?: number }
  | { kind: 'unit'; docId: number; group?: number }

export type Option = { key: string; text: string }

export type GroupView = {
  key: string
  type: QuestionType
  instructions: string
  content?: string
  imageUrl?: string
  maxWords?: number
  numberAllowed?: boolean
  options: Option[]
  questions: {
    number: number
    span: number
    prompt?: string
    options: Option[]
    answers: string
    explanation?: string
    tip?: string
    /** 出处句号 "7" 或 "10-16"，对应 Section 里句子的 n */
    evidence?: string
    /** 026 同义替换：题干说法 ↔ 原文说法（交卷后才显示） */
    paraphrases?: { q: string; s: string }[]
  }[]
}

/** 听力原文一句（练习单元导入的原文按句给，套题仍是整段文字）；start / end 为秒，004 按句控制用 */
export type TranscriptLine = { n: number; speaker?: string; text: string; announce?: boolean; start?: number; end?: number }

export type Section = {
  label: string
  audioUrl?: string
  transcript?: string | TranscriptLine[]
  passage?: { title: string; paragraphs: { label?: string; text: string; sentences?: { n: number; text: string }[] }[]; imageUrl?: string }
  groups: GroupView[]
}

export type PracticeUnit = {
  id: UnitId
  docId: number
  source: 'test' | 'unit'
  version: string
  module: 'listening' | 'reading'
  title: string
  whole: boolean
  sections: Section[]
  bandScale?: { min: number; max: number; band: number }[]
}

/** 键为题号（多选用首个题号，值为选项数组） */
export type Answers = Record<number, string | string[]>

export type ScoreItem = { groupKey: string; number: number; type: QuestionType; correct: boolean }

const TEST_RE = /^t([1-9]\d*)-([lr])(?:([1-9]\d*)(?:-g([1-9]\d*))?)?$/
const UNIT_RE = /^u([1-9]\d*)(?:-g([1-9]\d*))?$/

export const parseUnitId = (s: string): ParsedUnit | null => {
  const u = UNIT_RE.exec(s)
  if (u) return u[2] ? { kind: 'unit', docId: Number(u[1]), group: Number(u[2]) } : { kind: 'unit', docId: Number(u[1]) }
  const m = TEST_RE.exec(s)
  if (!m) return null
  const p: ParsedUnit = { kind: 'test', docId: Number(m[1]), module: m[2] as Module }
  if (m[3]) p.section = Number(m[3])
  if (m[4]) p.group = Number(m[4])
  return p
}

export const unitId = (p: ParsedUnit): UnitId =>
  p.kind === 'unit'
    ? `u${p.docId}${p.group ? `-g${p.group}` : ''}`
    : `t${p.docId}-${p.module}${p.section ?? ''}${p.section && p.group ? `-g${p.group}` : ''}`

export const groupKey = (testId: number, module: Module, section: number, group: number) =>
  `t${testId}-${module}${section}-g${group}`

export const unitGroupKey = (docId: number, group: number) => `u${docId}-g${group}`

export const FIXED_OPTIONS: Partial<Record<QuestionType, Option[]>> = {
  tfng: ['TRUE', 'FALSE', 'NOT GIVEN'].map((k) => ({ key: k, text: k })),
  ynng: ['YES', 'NO', 'NOT GIVEN'].map((k) => ({ key: k, text: k })),
}

/** 一个题组里的全部题号（多选占 span 个） */
export const groupNumbers = (g: GroupView): number[] =>
  g.questions.flatMap((q) => Array.from({ length: Math.max(q.span, 1) }, (_, i) => q.number + i))

export const scoreUnit = (unit: PracticeUnit, answers: Answers) => {
  const items: ScoreItem[] = []
  for (const s of unit.sections)
    for (const g of s.groups)
      for (const q of g.questions) {
        const a = answers[q.number]
        const base = { groupKey: g.key, type: g.type }
        if (g.type === 'multi_choice') {
          const credit = scoreMulti(Array.isArray(a) ? a : [], q.answers)
          for (let i = 0; i < Math.max(q.span, 1); i++) items.push({ ...base, number: q.number + i, correct: i < credit })
        } else {
          const correct = typeof a === 'string' && isCorrect(a, q.answers, g)
          items.push({ ...base, number: q.number, correct })
        }
      }
  return { score: items.filter((i) => i.correct).length, total: items.length, items }
}

export const bandFor = (score: number, scale: { min: number; max: number; band: number }[] = []): number | null =>
  scale.find((r) => score >= r.min && score <= r.max)?.band ?? null
