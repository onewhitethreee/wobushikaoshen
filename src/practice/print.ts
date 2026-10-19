// 错题打印（018 research R4、data-model）：把错题按来源分块，截原文摘录。纯函数，取数由调用方传入
import { parseUnitId, unitId, type GroupView, type Option, type PracticeUnit } from '@/exam/practice'
import type { QuestionType } from '@/exam/scoring'

export const MAX_PRINT = 100

export type PrintRequestItem = { groupKey: string; number: number }

export type MarkedSentence = { n: number; text: string; mark: boolean }
export type Excerpt =
  | { kind: 'paragraphs'; paragraphs: { label?: string; sentences: MarkedSentence[] }[] }
  | { kind: 'lines'; runs: (MarkedSentence & { speaker?: string })[][] }

export type PrintQuestion = { number: number; span: number; prompt?: string; options: Option[]; answers: string; explanation?: string }
export type PrintGroup = {
  groupKey: string
  type: QuestionType
  instructions: string
  content?: string
  imageUrl?: string
  maxWords?: number
  options: Option[]
  questions: PrintQuestion[]
}
export type PrintBlock = { source: string; title: string; module: 'listening' | 'reading'; excerpt: Excerpt | null; groups: PrintGroup[] }
export type PrintBatch = { blocks: PrintBlock[]; skipped: number }

/** u12-g2 → u12，t3-r1-g2 → t3-r1；解析不了返回 null */
export const sourceOf = (groupKey: string): string | null => {
  const p = parseUnitId(groupKey)
  if (!p) return null
  const { group: _, ...rest } = p
  return unitId(rest as typeof p)
}

/** 出处 "7" / "10-16" → 句号列表 */
const evidenceRange = (ev?: string): number[] => {
  const m = ev ? /^(\d+)(?:-(\d+))?$/.exec(ev.trim()) : null
  if (!m) return []
  const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])]
  return b >= a && b - a < 200 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : []
}

const readingExcerpt = (unit: PracticeUnit, marks: Set<number>): Excerpt | null => {
  const paragraphs = unit.sections.flatMap((s) => s.passage?.paragraphs ?? []).filter((p) => p.sentences?.some((x) => marks.has(x.n)))
  if (!paragraphs.length) return null
  return {
    kind: 'paragraphs',
    paragraphs: paragraphs.map((p) => ({ label: p.label, sentences: p.sentences!.map((x) => ({ n: x.n, text: x.text, mark: marks.has(x.n) })) })),
  }
}

const listeningExcerpt = (unit: PracticeUnit, marks: Set<number>): Excerpt | null => {
  const lines = unit.sections.flatMap((s) => (Array.isArray(s.transcript) ? s.transcript : []))
  const hit = lines.flatMap((l, i) => (marks.has(l.n) ? [i] : []))
  if (!hit.length) return null
  // 每处出处取前后各一句，相邻或重叠的区间合并
  const ranges: [number, number][] = []
  for (const i of hit) {
    const [a, b] = [Math.max(0, i - 1), Math.min(lines.length - 1, i + 1)]
    const last = ranges[ranges.length - 1]
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else ranges.push([a, b])
  }
  return {
    kind: 'lines',
    runs: ranges.map(([a, b]) => lines.slice(a, b + 1).map((l) => ({ n: l.n, text: l.text, speaker: l.speaker, mark: marks.has(l.n) }))),
  }
}

export const buildPrint = async (items: PrintRequestItem[], load: (source: string) => Promise<PracticeUnit | null>): Promise<PrintBatch> => {
  // 按来源分组，保留各来源第一次出现的顺序
  const bySource = new Map<string, PrintRequestItem[]>()
  let skipped = 0
  const seen = new Set<string>()
  for (const it of items) {
    const key = `${it.groupKey}#${it.number}`
    if (seen.has(key)) continue
    seen.add(key)
    const source = sourceOf(it.groupKey)
    if (!source) {
      skipped++
      continue
    }
    bySource.set(source, [...(bySource.get(source) ?? []), it])
  }

  const blocks: PrintBlock[] = []
  for (const [source, list] of bySource) {
    const unit = await load(source)
    if (!unit) {
      skipped += list.length
      continue
    }
    const groups = new Map<string, { view: GroupView; numbers: Set<number> }>()
    const marks = new Set<number>()
    for (const it of list) {
      const view = unit.sections.flatMap((s) => s.groups).find((g) => g.key === it.groupKey)
      const q = view?.questions.find((x) => it.number >= x.number && it.number < x.number + Math.max(x.span, 1))
      if (!view || !q) {
        skipped++
        continue
      }
      const entry = groups.get(view.key) ?? { view, numbers: new Set<number>() }
      entry.numbers.add(q.number)
      for (const n of evidenceRange(q.evidence)) marks.add(n)
      groups.set(view.key, entry)
    }
    if (!groups.size) continue

    const printGroups: PrintGroup[] = [...groups.values()]
      .map(({ view, numbers }) => ({
        groupKey: view.key,
        type: view.type,
        instructions: view.instructions,
        content: view.content,
        imageUrl: view.imageUrl,
        maxWords: view.maxWords,
        options: view.options,
        questions: view.questions
          .filter((q) => numbers.has(q.number))
          .map((q) => ({ number: q.number, span: Math.max(q.span, 1), prompt: q.prompt, options: q.options, answers: q.answers, explanation: q.explanation })),
      }))
      .sort((a, b) => a.questions[0].number - b.questions[0].number)

    const excerpt = !marks.size ? null : unit.module === 'reading' ? readingExcerpt(unit, marks) : listeningExcerpt(unit, marks)
    blocks.push({ source, title: unit.title, module: unit.module, excerpt, groups: printGroups })
  }
  return { blocks, skipped }
}
