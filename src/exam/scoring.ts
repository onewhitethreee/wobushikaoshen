// 判分规则（FR-070），纯函数，前台练习 / 模考和后台"答案试判"共用。
// 算法说明见 specs/001-content-types-nav/research.md R5。

import { spell } from '@/practice/dictation'

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'tfng'
  | 'ynng'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'matching_endings'
  | 'completion'
  | 'short_answer'
  | 'labelling'

/** 需要按文字比较（可选词、数字、字数）的题型；其余都是选项 key 的完全比较 */
export const TEXT_TYPES: QuestionType[] = ['completion', 'short_answer', 'labelling']

export type ScoreOptions = { type: QuestionType; maxWords?: number | null; numberAllowed?: boolean | null }

export const normalize = (s: string): string =>
  s.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\.+$/, '').trim()

/** 一行一个可接受答案，空行忽略 */
export const answerLines = (answersText: string | null | undefined): string[] =>
  (answersText ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

/** "(the) river bank" → ["river bank", "the river bank"]；支持多个括号 */
export const expandOptional = (answer: string): string[] => {
  const m = answer.match(/\(([^()]*)\)/)
  if (!m || m.index === undefined) return [answer.replace(/\s+/g, ' ').trim()]
  const head = answer.slice(0, m.index)
  const tail = answer.slice(m.index + m[0].length)
  return [...expandOptional(head + tail), ...expandOptional(head + m[1] + tail)]
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** 0–999 的英文写法，如 21 → "twenty-one"，105 → "one hundred and five" */
export const numberToWords = (n: number): string => {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')
  const rest = n % 100
  return ONES[Math.floor(n / 100)] + ' hundred' + (rest ? ' and ' + numberToWords(rest) : '')
}

const TENS_ALT = TENS.filter(Boolean).join('|')
const ONES_ALT = ONES.slice(1, 10).join('|')

// 序数词 → 基数词：eighteenth → eighteen、twenty-first → twenty-one（18th 的后缀另外去掉）
const ORDINAL: Record<string, string> = { first: 'one', second: 'two', third: 'three', fifth: 'five', eighth: 'eight', ninth: 'nine', twelfth: 'twelve', twentieth: 'twenty', thirtieth: 'thirty' }
const ORDINAL_RE = new RegExp(`\\b(${[...Object.keys(ORDINAL), ...ONES.slice(4).map((w) => w.replace(/t$/, '') + 'th')].join('|')})\\b`, 'g')
const ordinalToCardinal = (w: string) => ORDINAL[w] ?? ONES.find((o) => o.replace(/t$/, '') + 'th' === w) ?? w

const MONTH = '(january|february|march|april|may|june|july|august|september|october|november|december)'
const DAY = `((?:(?:${TENS_ALT}) (?:${ONES_ALT}))|${TENS_ALT}|${ONES.slice(1).join('|')})`
const DAY_MONTH = new RegExp(`^${DAY} ${MONTH}( \\d{4})?$`)

/** 日期统一成"月 日 年"：the 12th of January、January the twelfth、12 January 都一样 */
const date = (s: string): string => {
  if (!new RegExp(`\\b${MONTH}\\b`).test(s)) return s
  const t = s.replace(/,/g, ' ').replace(/\b(the|of)\b/g, ' ').replace(/\s+/g, ' ').trim()
  return t.replace(DAY_MONTH, (_, d: string, m: string, y = '') => `${m} ${d}${y}`)
}

// 判分前两边同样规范化（2026-10-27 放宽，雅思评分都算对的写法）：
// 长串数字去掉中间的空格 / 连字符（电话、编号）；序数词按基数；% 与 percent / per cent；
// 数字统一成英文单词，数字词里的连字符和 "hundred and" 统一，让 "15" 与 "fifteen"、"21" 与 "twenty one" 等价；
// 其余连字符当空格（cost-effective = cost effective）；英美拼写按听写同一张表；日期顺序
const canonical = (s: string): string =>
  date(
    s
      .replace(/\d[\d -]*\d/g, (m) => (m.replace(/\D/g, '').length >= 6 ? m.replace(/[ -]/g, '') : m))
      .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
      .replace(ORDINAL_RE, ordinalToCardinal)
      .replace(/\s*%/g, ' percent')
      .replace(/\bper cent\b/g, 'percent')
      .replace(/\b\d{1,3}\b/g, (d) => numberToWords(Number(d)))
      .replace(new RegExp(`\\b(${TENS_ALT})-(${ONES_ALT})\\b`, 'g'), '$1 $2')
      .replace(/\bhundred and\b/g, 'hundred')
      .replace(/([a-z])-(?=[a-z])/g, '$1 ')
      .split(' ')
      .map(spell)
      .join(' '),
  )

// 含数字的都按"数字"算：12、1,800、4.30pm、22nd、£8.50、邮编 HE25 / 4EU、编号 AF741-T
const NUMBER_TOKEN = /\d/
// 用英文写的数字也算"数字"：four、twenty-one、hundred、eighteenth（four weeks 与 4 weeks 同样是 1 个词）
const NUMBER_WORDS = new Set([...ONES, ...TENS.filter(Boolean), 'hundred', 'thousand'])
const isNumberWord = (w: string) => w.toLowerCase().split('-').every((p) => NUMBER_WORDS.has(ordinalToCardinal(p)))

/** 词数：按空白切分，连字符词算一个；numberAllowed 时数字（阿拉伯数字或英文写法）不计 */
export const countWords = (s: string, numberAllowed = false): number =>
  s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !(numberAllowed && (NUMBER_TOKEN.test(w) || isNumberWord(w)))).length

export const isCorrect = (response: string, answersText: string, opts: ScoreOptions): boolean => {
  const r = normalize(response)
  if (!r) return false
  const answers = answerLines(answersText)

  if (!TEXT_TYPES.includes(opts.type)) return answers.some((a) => normalize(a) === r)

  if (opts.maxWords && countWords(r, Boolean(opts.numberAllowed)) > opts.maxWords) return false
  const target = canonical(r)
  return answers.some((a) => expandOptional(a).some((v) => canonical(normalize(v)) === target))
}

/** 多选（选 N 项）：每个正确选项得 1 分，与作答顺序无关 */
export const scoreMulti = (responses: string[], answersText: string): number => {
  const answers = new Set(answerLines(answersText).map(normalize))
  return new Set(responses.map(normalize).filter((r) => answers.has(r))).size
}
