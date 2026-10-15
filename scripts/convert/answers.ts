// 标准答案抽取（007 T022，research R4）：规则 → AI（OpenAI 兼容接口，默认 DeepSeek）→ 自动检查 → 站长覆盖
import { createHash } from 'node:crypto'

import { countWords, expandOptional } from '../../src/exam/scoring'
import type { AiSettings } from './aiSettings'
import type { ConvertedGroup, RawQuestion, UnitGroup, UnitQuestion } from './questions'

const FIXED: Record<string, string[]> = {
  tfng: ['TRUE', 'FALSE', 'NOT GIVEN'],
  ynng: ['YES', 'NO', 'NOT GIVEN'],
}
const TEXT = ['completion', 'short_answer', 'labelling']

/** 这题允许的答案；null = 自由填写 */
export const allowedKeys = (g: UnitGroup, q: UnitQuestion, paragraphLabels: string[]): string[] | null => {
  if (FIXED[g.type]) return FIXED[g.type]
  if (g.type === 'single_choice') return (q.options ?? []).map((o) => o.key)
  if (g.type === 'matching_information') return paragraphLabels
  if (g.options.length) return g.options.map((o) => o.key)
  return TEXT.includes(g.type) ? null : []
}

// —— 规则：只认解析里明确写出的"选 X / 填 X / 对应选项 X"，叙述性说法交给 AI ——

const lastMatch = (s: string, re: RegExp) => [...s.matchAll(re)].pop()?.[1]

/** 规则抽取一条原始小题的答案；没有明确写出返回 null */
export const ruleAnswer = (g: UnitGroup, raw: RawQuestion): string | null => {
  const a = raw.analysis ?? ''
  if (FIXED[g.type]) {
    const v = lastMatch(a.toUpperCase(), /选\s*[“"]?(TRUE|FALSE|NOT GIVEN|YES|NO)\b/g)
    return v && FIXED[g.type].includes(v) ? v : null
  }
  if (TEXT.includes(g.type) && !g.options.length) {
    const v = lastMatch(a, /填\s*[“"「]?([A-Za-z0-9][A-Za-z0-9 '’.,/-]*?)[”"」]?\s*(?:[。，；,;）)]|$)/g)
    return v?.trim() || null
  }
  if (g.type === 'matching_headings') return lastMatch(a, /选(?:项)?\s*([ivx]+)\b/g) ?? null
  // 选择 / 匹配：选 B、选项 B、对应选项 D
  // 「选项B错误」「选项C的说法」之类是在排除，不算
  return lastMatch(a, /(?:选|选项)\s*([A-Z])(?![A-Za-z]|\s*(?:错|不|的说法|说|是错|无中生有))/g) ?? null
}

// —— AI ——

export type AiCache = Record<string, Record<string, string[]>>

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12)

/** 发给 AI 的题组（只含判断答案需要的信息） */
const aiInput = (g: UnitGroup, c: ConvertedGroup) =>
  JSON.stringify({
    type: g.type,
    instructions: g.instructions,
    content: g.content,
    options: g.options.length ? Object.fromEntries(g.options.map((o) => [o.key, o.text])) : undefined,
    questions: c.raw.flat().map((r) => ({
      no: r.no,
      question: r.question,
      options: r.options,
      analysis: r.analysis,
      quote: r.quote,
      tip: r.tip,
    })),
  })

const SYSTEM = `你是雅思题库整理助手。根据每道题的中文解析（analysis）、引用原句（quote）和干扰提示（tip），给出标准答案。
只输出 JSON：{"答案": {"题号": ["可接受答案", ...]}}。
- 判断题输出 TRUE / FALSE / NOT GIVEN 或 YES / NO / NOT GIVEN。
- 选择、匹配题输出选项字母（标题匹配输出罗马数字，如 iv）；多选拆成多题的，每题只输出一个字母，互不重复。
- 填空、简答输出原文中的词，遵守题目说明里的字数限制；有多种可接受写法时都列出。
- 解析里看不出答案时，该题输出空数组。`

/** 调 AI 抽取一个题组的答案，带缓存与重试；失败返回 null */
export const aiAnswers = async (
  ai: AiSettings,
  cache: AiCache,
  key: string,
  g: UnitGroup,
  c: ConvertedGroup,
): Promise<Record<string, string[]> | null> => {
  const input = aiInput(g, c)
  const cacheKey = `${key}#${hash(input + ai.model)}`
  if (cache[cacheKey]) return cache[cacheKey]
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${ai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model: ai.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: input },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '{}') as { 答案?: Record<string, unknown> }
      const out: Record<string, string[]> = {}
      for (const [no, v] of Object.entries(parsed.答案 ?? {}))
        out[no] = (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean)
      cache[cacheKey] = out
      return out
    } catch (e) {
      if (attempt === 2) console.error(`AI 抽取失败 ${key}：${(e as Error).message}`)
    }
  }
  return null
}

// —— 自动检查 ——

const plain = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** 选择类：选项字母或选项原文（判断题选项常被写成 A/B/C）都换成标准 key */
const toKey = (a: string, allowed: string[], q: UnitQuestion, raw: RawQuestion): string => {
  const up = a.trim()
  const hit = allowed.find((k) => k.toLowerCase() === up.toLowerCase())
  if (hit) return hit
  // 判断题原始选项 {A: TRUE, …}：AI 或规则给了字母
  if (raw.options && !Array.isArray(raw.options)) {
    const text = raw.options[up.toUpperCase()]
    const t = text && allowed.find((k) => k.toLowerCase() === text.trim().toLowerCase())
    if (t) return t
  }
  return up
}

export type Candidate = { rule: string[]; ai: string[] | null }

/** 检查候选答案；返回最终答案与失败原因（空 = 通过） */
export const checkAnswer = (
  g: UnitGroup,
  q: UnitQuestion,
  raws: RawQuestion[],
  cand: Candidate,
  paragraphLabels: string[],
): { answers: string[]; reasons: string[] } => {
  const reasons: string[] = []
  const allowed = allowedKeys(g, q, paragraphLabels)
  const norm = (a: string, i: number) => (allowed ? toKey(a, allowed, q, raws[Math.min(i, raws.length - 1)]) : a.trim())
  const ai = cand.ai?.map(norm)
  const rule = cand.rule.map(norm)
  const answers = ai?.length ? ai : rule
  if (!answers.length) return { answers, reasons: [...reasons, '没有候选答案'] }

  if (allowed) {
    const bad = answers.filter((a) => !allowed.includes(a))
    if (bad.length) reasons.push(`答案 ${bad.join('、')} 不是有效选项（${allowed.join(' / ') || '无'}）`)
  }
  if (g.type === 'multi_choice') {
    if (new Set(answers).size !== q.span) reasons.push(`多选要 ${q.span} 个不同答案，得到 ${answers.join('、')}`)
  } else if (allowed && answers.length > 1) reasons.push(`单题给了多个答案 ${answers.join('、')}`)

  if (!allowed) {
    const source = plain(raws.map((r) => `${r.quote ?? ''} ${r.analysis ?? ''}`).join(' '))
    for (const a of answers) {
      if (g.maxWords && expandOptional(a).some((v) => countWords(v, Boolean(g.numberAllowed)) > g.maxWords!))
        reasons.push(`「${a}」超过 ${g.maxWords} 个词`)
      if (!expandOptional(a).some((v) => source.includes(plain(v)))) reasons.push(`「${a}」在引用原句与解析里找不到`)
    }
  }

  // 规则有命中时必须和 AI 一致（多选按集合比）
  if (ai?.length && rule.length) {
    const same = g.type === 'multi_choice' ? rule.every((r) => ai.includes(r)) : ai.some((a) => plain(a) === plain(rule[0]))
    if (!same) reasons.push(`规则答案 ${rule.join('、')} 与 AI 答案 ${ai.join('、')} 不一致`)
  }
  return { answers, reasons }
}

/** 站长覆盖：`sourceId#题号` → 答案数组（修正 / 确认）或 "ok"（抽查通过） */
export type Overrides = Record<string, string[] | 'ok'>
