// 套题发布校验（FR-014 / FR-024 / FR-061）和分数换算表校验（FR-072），纯函数。
// 后台发布钩子和导入接口共用；规则见 specs/001-content-types-nav/data-model.md「发布校验」。

import { isCet } from './cet'
import { answerLines, countWords, expandOptional, TEXT_TYPES, type QuestionType } from './scoring'
import { WRITING_CATEGORIES } from './writingCategories'

type Option = { key?: string | null; text?: string | null }
type Question = {
  number?: number | null
  span?: number | null
  options?: Option[] | null
  answers?: string | null
  evidence?: string | null
  answerStatus?: string | null
}
type Group = {
  type?: QuestionType | null
  maxWords?: number | null
  numberAllowed?: boolean | null
  options?: Option[] | null
  questions?: Question[] | null
}
type Part = { audio?: unknown; transcript?: string | null; groups?: Group[] | null }
type Passage = {
  title?: string | null
  paragraphs?: { label?: string | null; text?: string | null }[] | null
  groups?: Group[] | null
}
type Rel = unknown
export type TestData = {
  listening?: { parts?: Part[] | null } | null
  reading?: { passages?: Passage[] | null } | null
  writing?: { task1?: Rel; task2?: Rel } | null
  speaking?: { part1?: Rel[] | null; part2?: Rel; part3?: Rel[] | null } | null
}

const FIXED: Partial<Record<QuestionType, string[]>> = {
  tfng: ['TRUE', 'FALSE', 'NOT GIVEN'],
  ynng: ['YES', 'NO', 'NOT GIVEN'],
}

const keysOf = (opts?: Option[] | null) => (opts ?? []).map((o) => (o.key ?? '').trim()).filter(Boolean)

const lower = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase()))

const checkGroups = (
  where: string,
  groups: Group[] | null | undefined,
  paragraphLabels: string[],
  errors: string[],
): number[] => {
  const numbers: number[] = []
  ;(groups ?? []).forEach((g, gi) => {
    const gWhere = `${where} / 第 ${gi + 1} 个题组`
    const type = g.type
    if (!type) errors.push(`${gWhere}：缺少题型`)
    if (!g.questions?.length) errors.push(`${gWhere}：没有题目`)

    for (const q of g.questions ?? []) {
      const span = q.span && q.span > 0 ? q.span : 1
      if (typeof q.number !== 'number') {
        errors.push(`${gWhere}：有题目缺少题号`)
        continue
      }
      for (let i = 0; i < span; i++) numbers.push(q.number + i)

      const qWhere = `${gWhere} / 第 ${q.number} 题`
      const answers = answerLines(q.answers)
      if (answers.length === 0) {
        errors.push(`${qWhere}：缺少标准答案`)
        continue
      }
      if (type === 'multi_choice' && answers.length !== span) {
        errors.push(`${qWhere}：多选题要选 ${span} 项，但填了 ${answers.length} 个答案`)
      }

      // 选择 / 匹配类：答案必须是选项里的 key
      let allowed: string[] | null = null
      if (type === 'single_choice') allowed = keysOf(q.options)
      else if (type && FIXED[type]) allowed = FIXED[type]!
      else if (type === 'matching_information') allowed = paragraphLabels
      else if (type && !TEXT_TYPES.includes(type)) allowed = keysOf(g.options)
      else if (keysOf(g.options).length) allowed = keysOf(g.options) // 带词库的填空 / 选字母的标注

      if (allowed) {
        const set = lower(allowed)
        for (const a of answers) {
          if (!set.has(a.toLowerCase())) errors.push(`${qWhere}：答案「${a}」不在选项 ${allowed.join(' / ') || '（空）'} 中`)
        }
      } else if (g.maxWords) {
        for (const a of answers) {
          for (const v of expandOptional(a)) {
            if (countWords(v, Boolean(g.numberAllowed)) > g.maxWords) {
              errors.push(`${qWhere}：可接受答案「${v}」超过 ${g.maxWords} 个词`)
            }
          }
        }
      }
    }
  })
  return numbers
}

// [1,2,3,7] → "1–3、7"
const ranges = (ns: number[]): string => {
  const out: string[] = []
  for (let i = 0; i < ns.length; i++) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    out.push(j > i ? `${ns[i]}–${ns[j]}` : `${ns[i]}`)
    i = j
  }
  return out.join('、')
}

const checkNumbering = (where: string, numbers: number[], errors: string[]) => {
  const seen = new Map<number, number>()
  for (const n of numbers) seen.set(n, (seen.get(n) ?? 0) + 1)
  const missing = []
  for (let n = 1; n <= 40; n++) if (!seen.has(n)) missing.push(n)
  const dup = [...seen].filter(([, c]) => c > 1).map(([n]) => n)
  const out = [...seen.keys()].filter((n) => n < 1 || n > 40)
  if (missing.length) errors.push(`${where}：缺少第 ${ranges(missing)} 题`)
  if (dup.length) errors.push(`${where}：第 ${dup.sort((a, b) => a - b).join('、')} 题重复`)
  if (out.length) errors.push(`${where}：题号 ${out.join('、')} 超出 1–40`)
}

export const validateTest = (data: TestData): string[] => {
  const errors: string[] = []

  const parts = data.listening?.parts ?? []
  if (parts.length) {
    if (parts.length !== 4) errors.push(`听力：需要 4 个 Part，现在有 ${parts.length} 个`)
    const numbers: number[] = []
    parts.forEach((p, i) => {
      const where = `听力 Part ${i + 1}`
      if (!p.audio) errors.push(`${where}：缺少音频`)
      if (!p.transcript?.trim()) errors.push(`${where}：缺少原文`)
      numbers.push(...checkGroups(where, p.groups, [], errors))
    })
    checkNumbering('听力', numbers, errors)
  }

  const passages = data.reading?.passages ?? []
  if (passages.length) {
    if (passages.length !== 3) errors.push(`阅读：需要 3 篇文章，现在有 ${passages.length} 篇`)
    const numbers: number[] = []
    passages.forEach((p, i) => {
      const where = `阅读 Passage ${i + 1}`
      if (!p.title?.trim()) errors.push(`${where}：缺少标题`)
      if (!(p.paragraphs ?? []).some((para) => para.text?.trim())) errors.push(`${where}：没有正文段落`)
      const labels = (p.paragraphs ?? []).map((para) => (para.label ?? '').trim()).filter(Boolean)
      numbers.push(...checkGroups(where, p.groups, labels, errors))
    })
    checkNumbering('阅读', numbers, errors)
  }

  // 写作：填了就要两道都填（FR-013）
  const w = data.writing
  if (w && (w.task1 || w.task2) && !(w.task1 && w.task2)) errors.push('写作：Task 1 和 Task 2 需要都选上')

  // 口语：填了就要 Part 2 恰好 1 道、Part 1 / 3 至少各 1 道（FR-013）
  const s = data.speaking
  if (s && (s.part1?.length || s.part2 || s.part3?.length)) {
    if (!s.part1?.length) errors.push('口语：Part 1 至少选 1 道')
    if (!s.part2) errors.push('口语：Part 2 需要选 1 道题卡')
    if (!s.part3?.length) errors.push('口语：Part 3 至少选 1 道')
  }

  return errors
}

export type BandRow = { min?: number | null; max?: number | null; band?: number | null }

export const validateBandScale = (rows: BandRow[] | null | undefined, label: string): string[] => {
  const errors: string[] = []
  const list = rows ?? []
  list.forEach((r, i) => {
    const { min, max, band } = r
    if (typeof min !== 'number' || typeof max !== 'number' || typeof band !== 'number') {
      errors.push(`${label} 第 ${i + 1} 行：原始分区间和 band 都要填`)
      return
    }
    if (min > max) errors.push(`${label} 第 ${i + 1} 行：最小值 ${min} 大于最大值 ${max}`)
    if (band < 0 || band > 9 || band * 2 !== Math.round(band * 2)) {
      errors.push(`${label} 第 ${i + 1} 行：band ${band} 必须在 0–9 之间且是 0.5 的倍数`)
    }
  })
  for (let n = 0; n <= 40; n++) {
    const hits = list.filter((r) => typeof r.min === 'number' && typeof r.max === 'number' && r.min <= n && n <= r.max)
    if (hits.length === 0) errors.push(`${label}：原始分 ${n} 没有对应的 band`)
    if (hits.length > 1) errors.push(`${label}：原始分 ${n} 落在多个区间里`)
  }
  return errors
}

export type WritingData = {
  taskType?: string | null
  category?: string | null
  title?: string | null
  prompt?: string | null
  image?: unknown
  sourceType?: string | null
  sourceSets?: string | null
  exam?: string | null
  paper?: string | null
}

const IELTS_TASKS = ['task1', 'task2']
const CET_TASKS = ['cet_writing', 'cet_translation']

// 写作题发布规则（FR-030 / FR-031）；转载须记来源题集（宪章 III、007 FR-040）
export const validateWritingTask = (d: WritingData): string[] => {
  const errors: string[] = []
  const t = d.taskType ?? ''
  if (![...IELTS_TASKS, ...CET_TASKS].includes(t)) errors.push('taskType 必须是 task1、task2、cet_writing 或 cet_translation')
  // 033：四 / 六级题型只属于四 / 六级，雅思题型只属于雅思
  if (CET_TASKS.includes(t)) {
    if (!isCet(d.exam)) errors.push(`${t} 的 exam 必须是 cet4 或 cet6`)
    if (!d.paper?.trim()) errors.push('四 / 六级必须填写试卷 paper')
  }
  if (IELTS_TASKS.includes(t) && d.exam && d.exam !== 'ielts') errors.push(`${t} 只能用于雅思（exam 应为 ielts）`)
  if (!d.title?.trim()) errors.push('缺少标题')
  if (!d.prompt?.trim()) errors.push('缺少题目')
  if (d.taskType === 'task1' && !d.image) errors.push('Task 1 必须上传图表图片')
  if (d.sourceType === 'repost' && !d.sourceSets?.trim()) errors.push('转载内容必须填写来源题集 sourceSets')
  if (d.category && (d.taskType === 'task1' || d.taskType === 'task2')) {
    const ok = WRITING_CATEGORIES[d.taskType].some((c) => c.value === d.category)
    if (!ok) errors.push(`分类 ${d.category} 不属于 ${d.taskType === 'task1' ? 'Task 1' : 'Task 2'}`)
  }
  return errors
}

export type SpeakingData = {
  part?: string | null
  topic?: string | null
  questions?: { text?: string | null }[] | null
  cueCard?: string | null
}

// 口语题发布规则（FR-040 / FR-041）
export const validateSpeakingQuestion = (d: SpeakingData): string[] => {
  const errors: string[] = []
  if (d.part !== '1' && d.part !== '2' && d.part !== '3') errors.push('part 必须是 "1"、"2" 或 "3"')
  if (!d.topic?.trim()) errors.push('缺少话题')
  if ((d.part === '1' || d.part === '3') && !(d.questions ?? []).some((q) => q.text?.trim())) {
    errors.push(`Part ${d.part} 至少要有 1 个问题`)
  }
  if (d.part === '2' && !d.cueCard?.trim()) errors.push('Part 2 必须有题卡')
  return errors
}

// —— 007 练习单元 ——

export type Sentence = { n?: number | null; text?: string | null }
export type UnitData = {
  module?: 'listening' | 'reading' | string | null
  part?: number | null
  exam?: string | null
  paper?: string | null
  title?: string | null
  sourceType?: string | null
  sourceSets?: string | null
  audio?: unknown
  transcript?: (Sentence & { speaker?: string | null; start?: number | null; end?: number | null; announce?: boolean | null })[] | null
  passage?: { label?: string | null; sentences?: Sentence[] | null }[] | null
  groups?: Group[] | null
}

/** 小题里还没确认的答案数（发布前必须为 0） */
export const countPending = (d: Pick<UnitData, 'groups'>): number =>
  (d.groups ?? []).reduce((n, g) => n + (g.questions ?? []).filter((q) => q.answerStatus === 'pending').length, 0)

// 练习单元发布规则（specs/007-question-bank-import/data-model.md「发布校验」）
export const validateUnit = (d: UnitData): string[] => {
  const errors: string[] = []
  const isL = d.module === 'listening'
  if (d.module !== 'listening' && d.module !== 'reading') errors.push('module 必须是 listening 或 reading')
  // 雅思听力 4 个 Part、阅读 3 篇；四 / 六级听力 3 个 Section、阅读 4 个 Part（033）
  const cet = isCet(d.exam)
  const maxPart = cet ? (isL ? 3 : 4) : isL ? 4 : 3
  if (typeof d.part !== 'number' || d.part < 1 || d.part > maxPart) errors.push(`part 必须是 1–${maxPart}`)
  if (cet && !d.paper?.trim()) errors.push('四 / 六级必须填写试卷 paper')
  if (!d.title?.trim()) errors.push('缺少标题')
  if (d.sourceType === 'repost' && !d.sourceSets?.trim()) errors.push('转载内容必须填写来源题集 sourceSets')

  // 实际存在的句子编号（evidence 只能指向这些；编号不一定从 0 连续）
  let sentences: Sentence[] = []
  let labels: string[] = []
  if (isL) {
    if (!d.audio) errors.push('听力缺少音频')
    sentences = d.transcript ?? []
  } else {
    sentences = (d.passage ?? []).flatMap((p) => p.sentences ?? [])
  }
  const ns = new Set(sentences.filter((s) => s.text?.trim() && typeof s.n === 'number').map((s) => s.n as number))
  if (!ns.size) errors.push(isL ? '听力缺少原文' : '阅读缺少正文')
  if (!isL) {
    const paras = d.passage ?? []
    labels = paras.map((p) => (p.label ?? '').trim()).filter(Boolean)
  }

  const numbers = checkGroups('', d.groups, labels, errors).sort((a, b) => a - b)
  if (!numbers.length) errors.push('没有题目')
  else {
    const dup = numbers.filter((n, i) => numbers[i - 1] === n)
    if (dup.length) errors.push(`第 ${[...new Set(dup)].join('、')} 题重复`)
    const gaps = numbers.filter((n, i) => i > 0 && n - numbers[i - 1] > 1)
    if (gaps.length) errors.push(`题号不连续：${numbers[0]}–${numbers[numbers.length - 1]} 之间有缺号`)
  }

  for (const g of d.groups ?? [])
    for (const q of g.questions ?? []) {
      const ev = q.evidence?.trim()
      if (!ev) continue
      const m = /^(\d+)(?:-(\d+))?$/.exec(ev)
      if (!m) errors.push(`第 ${q.number} 题：出处句号「${ev}」格式应为 7 或 10-16`)
      else if (!ns.has(Number(m[1])) || !ns.has(Number(m[2] ?? m[1])) || Number(m[1]) > Number(m[2] ?? m[1]))
        errors.push(`第 ${q.number} 题：出处句号「${ev}」不在原文里（原文句号 ${Math.min(...ns)}–${Math.max(...ns)}）`)
    }

  const pending = countPending(d)
  if (pending) errors.push(`还有 ${pending} 道题的答案待确认`)
  return errors.map((e) => e.replace(/^ \/ /, ''))
}
