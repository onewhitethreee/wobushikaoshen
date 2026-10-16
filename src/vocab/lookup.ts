// 查词的候选词（013 research R2）。前后端共用：前端判断"是不是英文词"，接口用同一套规则生成候选
export const WORD_RE = /^[A-Za-z]+(['’-][A-Za-z]+)*$/

/** 去掉首尾标点，弯撇号换成直撇号；不是英文词时返回 null */
export const clean = (raw: string): string | null => {
  const w = raw
    .trim()
    // 只去掉首尾的标点和空白；带数字的（abc123）整体不算单词
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/’/g, "'")
  return w && w.length <= 64 && WORD_RE.test(w) ? w : null
}

/** 按顺序：小写原样 → 去掉 's → 撇号前半段 → 去掉撇号 → 连字符第一段 */
export const candidates = (raw: string): string[] => {
  const w = clean(raw)?.toLowerCase()
  if (!w) return []
  const out = [w]
  if (w.endsWith("'s")) out.push(w.slice(0, -2))
  if (w.includes("'")) out.push(w.split("'")[0], w.replace(/'/g, ''))
  if (w.includes('-')) out.push(w.split('-')[0])
  return [...new Set(out.filter(Boolean))]
}

/** ECDICT 的 exchange："p:studied/d:studied/3:studies" 或 "0:study/1:s" */
export const parseExchange = (s?: string | null): Record<string, string> =>
  Object.fromEntries(
    (s ?? '')
      .split('/')
      .map((p) => p.split(':'))
      .filter((p) => p.length === 2 && p[0] && p[1]),
  )

export const FORM_LABEL: Record<string, string> = {
  p: '过去式',
  d: '过去分词',
  i: '现在分词',
  '3': '第三人称单数',
  s: '复数',
  r: '比较级',
  t: '最高级',
}

/** "mitigated 是 mitigate 的过去分词、过去式" */
export const formText = (form: { word: string; type: string }, base: string) =>
  `${form.word} 是 ${base} 的${[...form.type].map((t) => FORM_LABEL[t]).filter(Boolean).join('、') || '变形'}`

export type DictResult = {
  word: string
  phonetic?: string
  meanings: string[]
  form?: { word: string; type: string }
}
