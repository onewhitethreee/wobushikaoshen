// 阅读 / 听力共用的题组转换（007 T021），纯函数：原始题组 → 导入包题组（答案由 answers.ts 填）
// 题型映射见 specs/007-question-bank-import/research.md R3

export type RawQuestion = {
  no: string
  question?: string
  options?: Record<string, string> | string[]
  evidence_sentences?: string
  analysis?: string
  quote?: string
  tip?: string
}

export type RawGroup = {
  range?: string
  type: 'fill-in-the-blank' | 'single-choice' | 'multiple-choice' | 'matching' | 'map' | string
  instructions?: string
  content?: string
  image?: string
  options?: Record<string, string>
  questions: RawQuestion[]
}

export type Option = { key: string; text: string }

export type UnitQuestion = {
  number: number
  span: number
  prompt?: string
  options?: Option[]
  answers: string
  explanation?: string
  tip?: string
  quote?: string
  evidence?: string
  answerStatus: 'auto' | 'pending' | 'confirmed'
}

export type UnitGroup = {
  type: string
  instructions: string
  content?: string
  image?: string
  maxWords?: number
  numberAllowed?: boolean
  options: Option[]
  questions: UnitQuestion[]
}

/** 转换后的题组 + 每题对应的原始小题（多选合并后一题对多条，供答案抽取用） */
export type ConvertedGroup = { group: UnitGroup; raw: RawQuestion[][]; issues: string[] }

const WORD_N: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

/**
 * 从题目说明解析字数限制：ONE WORD ONLY → 1；NO MORE THAN TWO WORDS → 2；… AND/OR A NUMBER → numberAllowed；
 * A NUMBER / ONE YEAR → 1 + numberAllowed（数字不计字数）。认不出返回 null。
 */
export const parseWordLimit = (instructions: string): { maxWords: number; numberAllowed: boolean } | null => {
  const s = instructions.toUpperCase().replace(/\s+/g, ' ')
  // 词尾不要求边界：原题有 "ONE WORDA" 这样的拼写错误
  // 原题写法不一："ONE WORD ONLY AND/OR A NUMBER"、"AND/ OR"、"AND/ ORA NUMBER"
  const m = /(?:NO MORE THAN )?\b(ONE|TWO|THREE|FOUR|FIVE) WORDS?( (?:ONLY )?AND ?\/ ?OR ?(?:A ?)?NUMBER)?/.exec(s)
  if (m) return { maxWords: WORD_N[m[1]], numberAllowed: Boolean(m[2]) }
  if (/\b(A|ONE) (NUMBER|YEAR)\b/.test(s)) return { maxWords: 1, numberAllowed: true }
  return null
}

/** "[11]" → "{{11}}" */
export const toBlanks = (s: string): string => s.replace(/\[(\d+)\]/g, '{{$1}}')

const blankNumbers = (s: string): number[] => [...s.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))

export const toOptions = (o: RawQuestion['options'] | RawGroup['options']): Option[] =>
  !o ? [] : Array.isArray(o) ? o.map((k) => ({ key: k, text: k })) : Object.entries(o).map(([key, text]) => ({ key: key.trim(), text: String(text).trim() }))

const values = (o: Option[]) => o.map((x) => x.text.toUpperCase().trim()).sort().join('|')
const TFNG = ['FALSE', 'NOT GIVEN', 'TRUE'].join('|')
const YNNG = ['NO', 'NOT GIVEN', 'YES'].join('|')

/** 原始 type + 说明 + 选项 → 网站题型（R3） */
export const mapType = (g: RawGroup, module: 'reading' | 'listening'): string => {
  const ins = (g.instructions ?? '').toLowerCase()
  const first = toOptions(g.questions[0]?.options)
  switch (g.type) {
    case 'single-choice':
      if (values(first) === TFNG) return 'tfng'
      if (values(first) === YNNG) return 'ynng'
      return 'single_choice'
    case 'multiple-choice':
      return 'multi_choice'
    case 'fill-in-the-blank':
      return /answer the questions/.test(ins) ? 'short_answer' : 'completion'
    case 'map':
      return module === 'reading' ? 'matching_information' : 'labelling'
    case 'matching':
      if (/heading/.test(ins)) return 'matching_headings'
      if (/ending/.test(ins)) return 'matching_endings'
      // 带词库的摘要填空：正文里有空位、答案是词库字母
      if (/summary|from the box|list of (words|phrases)/.test(ins) || (g.content && /summary|complete the/.test(ins))) return 'completion'
      if (module === 'reading' && first.length && first.every((o) => /^[A-Z]$/.test(o.key) && o.key === o.text)) return 'matching_information'
      return 'matching_features'
    default:
      return 'unknown'
  }
}

/** 多选：原数据把"选 TWO"拆成相邻几题（题干相同，后面的题省略选项或重复同样选项），合并成一题 */
export const mergeMulti = (qs: RawQuestion[]): RawQuestion[][] => {
  const out: RawQuestion[][] = []
  for (const q of qs) {
    const last = out[out.length - 1]
    // 后一题省略选项，或选项与前一题完全相同
    const sameOpts = !q.options || JSON.stringify(q.options) === JSON.stringify(last?.[0].options)
    const same = last && sameOpts && (q.question ?? '').trim() === (last[0].question ?? '').trim()
    if (same) last.push(q)
    else out.push([q])
  }
  return out
}

const CHOOSE_N: Record<string, number> = { TWO: 2, THREE: 3, FOUR: 4 }

/** 正文里 "[14]" 所在的那一行去掉题号与空位，作题干（匹配题：Paragraph A / 句子开头） */
const promptFromContent = (content: string, n: number): string | undefined => {
  const line = content.split('\n').find((l) => l.includes(`[${n}]`))
  if (!line) return undefined
  return line
    .replace(`[${n}]`, '')
    .replace(new RegExp(`^\\s*${n}\\s*[.)]?\\s+`), '')
    .replace(/\s+/g, ' ')
    .trim()
}

const clean = (s?: string) => s?.trim() || undefined

/** 原始题组 → 导入包题组；answers 先留空、状态 pending，由 answers.ts 回填 */
export const convertGroup = (g: RawGroup, module: 'reading' | 'listening'): ConvertedGroup => {
  const issues: string[] = []
  const type = mapType(g, module)
  if (type === 'unknown') issues.push(`未知题型 ${g.type}`)
  const instructions = (g.instructions ?? '').trim()
  const textual = type === 'completion' || type === 'short_answer' || type === 'labelling'

  // 个别原题正文开头混进了网页残留（"Preview" + 一行 CSS），去掉
  const content = g.content
    ?.split('\n')
    .filter((l) => !/^Preview$/.test(l.trim()) && !/^[\w-]+\{[^}]*\}$/.test(l.trim()))
    .join('\n')
    .trim()
  // 匹配类（非填空）的正文只是"题号 + 空位"列表，拆成每题题干，正文不再显示
  const contentToPrompts = Boolean(content) && !textual

  const chunks = type === 'multi_choice' ? mergeMulti(g.questions) : g.questions.map((q) => [q])
  if (type === 'multi_choice') {
    const n = CHOOSE_N[/CHOOSE (TWO|THREE|FOUR)/i.exec(instructions)?.[1]?.toUpperCase() ?? '']
    for (const c of chunks) if (n && c.length !== n) issues.push(`第 ${c[0].no} 题：说明要求选 ${n} 项，合并出 ${c.length} 题`)
  }

  const questions: UnitQuestion[] = chunks.map((c) => {
    const q = c[0]
    const number = Number(q.no)
    let prompt = clean(q.question)
    if (contentToPrompts && (!prompt || /^(paragraph|section)$/i.test(prompt))) prompt = promptFromContent(content!, number) ?? prompt
    if (prompt) prompt = toBlanks(prompt)
    const join = (k: 'analysis' | 'tip' | 'quote') =>
      clean(c.map((x) => x[k]?.trim()).filter(Boolean).join('\n')) // 合并多选：每条一行
    return {
      number,
      span: c.length,
      prompt,
      options: type === 'single_choice' ? toOptions(q.options) : undefined,
      answers: '',
      explanation: join('analysis'),
      tip: join('tip'),
      quote: join('quote'),
      // "17-17" → "17"；原始数据偶有 "-"（没有出处），当作没有
      evidence: /^\d+(-\d+)?$/.test(q.evidence_sentences?.trim() ?? '') ? q.evidence_sentences!.trim().replace(/^(\d+)-\1$/, '$1') : undefined,
      answerStatus: 'pending',
    }
  })

  // 组选项：匹配 / 词库填空用题组选项；多选用第一题的选项
  let options = toOptions(g.options)
  if (type === 'multi_choice') options = toOptions(g.questions[0]?.options)
  // 听力地图题：图上字母挂在第一题的 options 里（["A","B",…]），作为题组选项
  if (type === 'labelling' && !options.length) options = toOptions(g.questions[0]?.options)
  if (type === 'matching_information' || type === 'tfng' || type === 'ynng') options = []

  // 填空：正文空位要和题号一一对应
  if (textual && content) {
    const blanks = blankNumbers(content).sort((a, b) => a - b)
    const nums = questions.map((q) => q.number).sort((a, b) => a - b)
    const missing = nums.filter((n) => !blanks.includes(n) && !questions.find((q) => q.number === n)?.prompt)
    if (missing.length) issues.push(`正文缺少空位 ${missing.join('、')}`)
    const extra = blanks.filter((n) => !nums.includes(n))
    if (extra.length) issues.push(`正文空位 ${extra.join('、')} 没有对应的题`)
  }

  const limit = textual && !options.length ? parseWordLimit(instructions) : null
  // 说明里提到了字数却认不出才算错；完全没写限制（如只有 "Questions 31-40"）按不限字数
  if (textual && !options.length && !limit && /WORD|NUMBER/i.test(instructions)) issues.push('字数限制解析失败')

  return {
    group: {
      type,
      instructions,
      content: content && !contentToPrompts ? toBlanks(content) : undefined,
      image: clean(g.image),
      maxWords: limit?.maxWords,
      numberAllowed: limit?.numberAllowed || undefined,
      options,
      questions,
    },
    raw: chunks,
    issues,
  }
}
