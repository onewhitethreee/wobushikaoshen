// 阅读转换（007 T024）：out/题目_json/<阅读题集>/*/exam.json → 导入包 kind "unit"
// 流程：读原始 → 去重 → 题组与段落 → pipeline.ts（答案、抽查、分包、报告）
import fs from 'node:fs'
import path from 'node:path'

import type { AiSettings } from './aiSettings'
import { finishUnits, type BaseUnit } from './pipeline'
import { convertGroup, type RawGroup, type UnitGroup } from './questions'
import { sourceIdOf } from './writing'

export type RawReading = {
  set: string
  title: string
  channel: 'reading'
  part: string
  passage: { i: number; text: string }[][]
  groups: RawGroup[]
}

export type Paragraph = { label?: string; sentences: { n: number; text: string }[] }

// 题集 → 前台中性标签（R8）；数组顺序即"多个题集时取哪个"的优先级（新月份优先）
export const READING_SETS: [string, string][] = [
  ['Z家阅读10月高频', '10月高频'],
  ['Z家阅读10月中频', '10月中频'],
  ['Z家阅读9月高频', '9月高频'],
  ['Z家阅读9月中频', '9月中频'],
  ['阅读增补（Z家未收录）', '增补'],
]

/** 段落：去掉 "(A) " 前缀作段落字母；全文都没有字母、而题目要用段落字母时按顺序补 A、B、C…（段数与说明 A-X 不符会报错） */
export const toPassage = (raw: RawReading['passage'], needLabels: boolean): { passage: Paragraph[]; issues: string[] } => {
  const issues: string[] = []
  const passage: Paragraph[] = raw
    .filter((p) => p.length)
    .map((p) => {
      const m = /^\(([A-Z])\)\s*/.exec(p[0].text)
      return {
        label: m?.[1],
        sentences: p.map((s, k) => ({ n: s.i, text: (k === 0 && m ? s.text.slice(m[0].length) : s.text).trim() })),
      }
    })
  // 部分段落不带字母是正常的（对话、引文、小标题），只在全文都没有时补
  const labelled = passage.filter((p) => p.label).length
  if (!labelled && needLabels) passage.forEach((p, i) => (p.label = String.fromCharCode(65 + i)))
  const ns = passage.flatMap((p) => p.sentences.map((s) => s.n))
  if (ns.some((n, i) => n !== i)) issues.push('句子编号不是从 0 连续')
  return { passage, issues }
}

/** 说明里的 "A-G" → 应有 7 段 */
const letterSpan = (g: UnitGroup): number | null => {
  const m = /\bA\s*[-–]\s*([A-Z])\b/.exec(g.instructions)
  return m ? m[1].charCodeAt(0) - 64 : null
}

export const convertReading = async (src: string, out: string, batch: number, ai: AiSettings | null) => {
  // 1. 读原始，按"标题 + 首句"去重（R8）
  const byKey = new Map<string, { raw: RawReading; dir: string; sourceId: string; sets: string[] }>()
  const dropped: string[] = []
  const errors: string[] = []
  for (const [set] of READING_SETS) {
    const base = path.join(src, set)
    if (!fs.existsSync(base)) {
      errors.push(`缺少题集目录：${base}`)
      continue
    }
    for (const folder of fs.readdirSync(base).sort()) {
      const dir = path.join(base, folder)
      const file = path.join(dir, 'exam.json')
      if (!fs.existsSync(file)) continue
      const sourceId = sourceIdOf(folder)
      if (!sourceId) {
        errors.push(`文件夹名里没有原始编号：${folder}`)
        continue
      }
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawReading
      const first = raw.passage.flat()[0]?.text ?? ''
      const key = `${raw.title}\n${first}`.toLowerCase().replace(/\s+/g, ' ')
      const seen = byKey.get(key)
      if (seen) {
        seen.sets.push(set)
        dropped.push(`${sourceId}（${set}）与 ${seen.sourceId}（${seen.sets[0]}）重复，合并题集`)
      } else byKey.set(key, { raw, dir, sourceId, sets: [set] })
    }
  }

  // 2. 题组与段落
  const units: BaseUnit[] = [...byKey.values()].map(({ raw, dir, sourceId, sets }) => {
    const converted = raw.groups.map((g) => convertGroup(g, 'reading'))
    const groups = converted.map((c) => c.group)
    const needLabels = groups.some((g) => g.type === 'matching_information' || g.type === 'matching_headings')
    const { passage, issues } = toPassage(raw.passage, needLabels)
    const unitErrors = [...issues, ...converted.flatMap((c, i) => c.issues.map((m) => `第 ${i + 1} 个题组：${m}`))]
    for (const g of groups.filter((g) => g.type === 'matching_information')) {
      const span = letterSpan(g)
      const labels = passage.filter((p) => p.label).length
      if (span && span > labels) unitErrors.push(`说明是 A-${String.fromCharCode(64 + span)}，文章只有 ${labels} 段带字母`)
    }
    const media = new Map<string, string>()
    for (const g of groups)
      if (g.image) {
        const from = path.join(dir, g.image)
        g.image = `img/${sourceId}-${path.basename(g.image)}`
        if (fs.existsSync(from)) media.set(g.image, from)
        else unitErrors.push(`配图文件不存在：${from}`)
      }
    return {
      module: 'reading' as const,
      part: Number(/\d/.exec(raw.part)?.[0]) || 0,
      title: raw.title.trim(),
      sourceType: 'repost' as const,
      sourceId,
      sourceSets: sets.join(', '),
      sourceTag: READING_SETS.find(([s]) => sets.includes(s))![1],
      passage,
      groups,
      converted,
      media,
      errors: unitErrors,
    }
  })

  return finishUnits({ kind: 'reading', units, out, batch, ai, errors, dropped })
}
