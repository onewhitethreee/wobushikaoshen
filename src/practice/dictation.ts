// 听写宽松比对（023 research R1–R3）：两边用同一个规范化函数，再按最长公共子序列对齐。纯函数
export type Tok = { t: string; src: number[] }
export type WordResult = { text: string; status: 'ok' | 'wrong' | 'missing'; typed?: string }
export type Comparison = { words: WordResult[]; extra: string[]; ok: boolean }

// 缩写：整词映射（先查这里），其余按后缀规则
const WHOLE: Record<string, string> = {
  "can't": 'can not',
  "won't": 'will not',
  "shan't": 'shall not',
  "let's": 'let us',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "he's": 'he is',
  "she's": 'she is',
  "who's": 'who is',
  "where's": 'where is',
  "here's": 'here is',
}
const SUFFIX: [string, string][] = [
  ["n't", ' not'],
  ["'m", ' am'],
  ["'re", ' are'],
  ["'ll", ' will'],
  ["'ve", ' have'],
  ["'d", ' would'],
]

const UNITS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ')
const TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ')
const isNum = (w: string) => UNITS.includes(w) || TENS.includes(w) || w === 'hundred' || w === 'thousand'

// 英美拼写：词干表（英式 → 美式），其余按规则；两边同样处理，规则偏宽只会更宽松
const OUR = 'colour favour honour labour neighbour behaviour flavour humour harbour rumour savour vapour endeavour armour odour parlour rigour splendour valour vigour'.split(' ')
const TRE = 'kilometre centimetre millimetre centre theatre metre litre fibre calibre spectre meagre sombre'.split(' ')
const LL = 'travel cancel label model level signal fuel dial equal total marvel quarrel jewel counsel tunnel channel panel pedal'.split(' ')
const WORDS: Record<string, string> = {
  grey: 'gray',
  programme: 'program',
  programmes: 'programs',
  tyre: 'tire',
  tyres: 'tires',
  jewellery: 'jewelry',
  aluminium: 'aluminum',
  mould: 'mold',
  plough: 'plow',
  catalogue: 'catalog',
  dialogue: 'dialog',
  analogue: 'analog',
  licence: 'license',
  defence: 'defense',
  offence: 'offense',
  pyjamas: 'pajamas',
  enrol: 'enroll',
  enrolment: 'enrollment',
  fulfil: 'fulfill',
  skilful: 'skillful',
  practise: 'practice',
  practised: 'practiced',
  ageing: 'aging',
  cosy: 'cozy',
  doughnut: 'donut',
}

export const spell = (w: string): string => {
  if (WORDS[w]) return WORDS[w]
  for (const s of OUR) if (w.startsWith(s)) return s.replace('our', 'or') + w.slice(s.length)
  for (const s of TRE) if (w.startsWith(s)) return s.slice(0, -2) + 'er' + w.slice(s.length)
  for (const s of LL) if (w.startsWith(s + 'l')) return s + w.slice(s.length + 1)
  if (w.length >= 6) {
    const z = w.replace(/is(e|es|ed|ing|ation|ations|ational|er|ers)$/, 'iz$1').replace(/ys(e|es|ed|ing)$/, 'yz$1')
    if (z !== w) return z
  }
  return w
}

/** 原文 / 输入按空白切成"显示词"，再规范化成规范词，每个规范词记下来源显示词下标 */
export const canon = (text: string): Tok[] => {
  const display = text.split(/\s+/).filter(Boolean)
  const toks: Tok[] = []
  display.forEach((word, i) => {
    let w = word.toLowerCase().replace(/[’‘`]/g, "'").replace(/(\d)[,.:](?=\d)/g, '$1')
    w = w.replace(/[-/–—]/g, ' ').replace(/[^a-z0-9' ]/g, ' ')
    for (let part of w.split(/\s+/).filter(Boolean)) {
      part = part.replace(/^'+|'+$/g, '')
      if (!part) continue
      let expanded = WHOLE[part]
      if (!expanded) for (const [suf, rep] of SUFFIX) if (part.endsWith(suf) && part.length > suf.length) { expanded = part.slice(0, -suf.length) + rep; break }
      for (const t of (expanded ?? part).replace(/'/g, '').split(' ').filter(Boolean)) toks.push({ t, src: [i] })
    }
  })

  // 连续的数字词合并成阿拉伯数字（中间可夹 and：one hundred and twenty）
  const out: Tok[] = []
  for (let i = 0; i < toks.length; ) {
    if (!isNum(toks[i].t)) {
      out.push({ t: spell(toks[i].t), src: toks[i].src })
      i++
      continue
    }
    let total = 0
    let cur = 0
    const src = new Set<number>()
    let j = i
    while (j < toks.length) {
      const t = toks[j].t
      if (t === 'and' && j > i && j + 1 < toks.length && isNum(toks[j + 1].t) && ['hundred', 'thousand'].includes(toks[j - 1].t)) {
        toks[j].src.forEach((s) => src.add(s))
        j++
        continue
      }
      if (!isNum(t)) break
      if (UNITS.includes(t)) cur += UNITS.indexOf(t)
      else if (TENS.includes(t)) cur += (TENS.indexOf(t) + 2) * 10
      else if (t === 'hundred') cur = (cur || 1) * 100
      else {
        total += (cur || 1) * 1000
        cur = 0
      }
      toks[j].src.forEach((s) => src.add(s))
      j++
    }
    out.push({ t: String(total + cur), src: [...src] })
    i = j
  }
  return out
}

export const compare = (original: string, input: string): Comparison => {
  const display = original.split(/\s+/).filter(Boolean)
  const typedWords = input.split(/\s+/).filter(Boolean)
  const A = canon(original)
  const B = canon(input)

  // LCS
  const dp = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0))
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i].t === B[j].t ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])

  const stateA: ('ok' | 'wrong' | 'missing')[] = new Array(A.length).fill('missing')
  const typedFor: (number[] | undefined)[] = new Array(A.length)
  const usedB = new Array<boolean>(B.length).fill(false)
  let i = 0
  let j = 0
  let gapA: number[] = []
  let gapB: number[] = []
  const flush = () => {
    gapA.forEach((a, k) => {
      if (k < gapB.length) {
        stateA[a] = 'wrong'
        typedFor[a] = B[gapB[k]].src
        usedB[gapB[k]] = true
      }
    })
    gapA = []
    gapB = []
  }
  while (i < A.length && j < B.length) {
    if (A[i].t === B[j].t) {
      flush()
      stateA[i] = 'ok'
      usedB[j] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) gapA.push(i++)
    else gapB.push(j++)
  }
  while (i < A.length) gapA.push(i++)
  while (j < B.length) gapB.push(j++)
  flush()

  const words: WordResult[] = display.map((text, d) => {
    const mine = A.map((tok, k) => [tok, k] as const).filter(([tok]) => tok.src.includes(d))
    const wrong = mine.filter(([, k]) => stateA[k] === 'wrong')
    if (wrong.length) {
      const idx = [...new Set(wrong.flatMap(([, k]) => typedFor[k] ?? []))].sort((a, b) => a - b)
      return { text, status: 'wrong' as const, typed: idx.map((x) => typedWords[x]).join(' ') }
    }
    if (!mine.length || mine.every(([, k]) => stateA[k] === 'ok')) return { text, status: 'ok' as const }
    return { text, status: 'missing' as const }
  })
  const extraIdx = [...new Set(B.flatMap((tok, k) => (usedB[k] ? [] : tok.src)))].sort((a, b) => a - b)
  const extra = extraIdx.map((x) => typedWords[x])
  return { words, extra, ok: extra.length === 0 && words.every((w) => w.status === 'ok') }
}

export const checkWord = (original: string, typed: string) => {
  const a = canon(original).map((t) => t.t).join(' ')
  return a !== '' && a === canon(typed).map((t) => t.t).join(' ')
}

// 挖空：答案词优先，其次去掉虚词后最长的词（≥ 6 个字母），每句最多 3 个；不足 4 个词的句子不挖
const FUNCTION = new Set(
  `a an the and or but if so of to in on at by for with from into onto upon about above below over under after before since until while during through between among against without within along across behind beyond near off out up down
  i me my mine you your yours he him his she her hers it its we us our ours they them their theirs this that these those there here what which who whom whose when where why how
  is am are was were be been being have has had having do does did doing will would shall should can could may might must
  not no nor yes very too also just only even still yet already ever never always often sometimes really quite rather much many more most less least some any all each every both either neither other another such same
  than then because although though however therefore whether well okay oh um uh like going gonna wanna actually basically probably perhaps maybe something anything nothing everything someone anyone everyone`.split(/\s+/),
)

export const pickBlanks = (text: string, answers: string[]): number[] => {
  const display = text.split(/\s+/).filter(Boolean)
  if (display.length < 4) return []
  const key = display.map((w) => canon(w).map((t) => t.t).join(' '))
  const picked: number[] = []
  const add = (i: number) => {
    if (picked.length < 3 && !picked.includes(i) && key[i]) picked.push(i)
  }
  for (const ans of answers) {
    const words = (ans.split(/\r?\n/)[0] ?? '').replace(/\([^)]*\)/g, ' ')
    for (const t of canon(words).map((x) => x.t)) {
      const at = key.findIndex((k, i) => k === t && !picked.includes(i))
      if (at >= 0) add(at)
    }
  }
  const letters = (w: string) => w.replace(/[^a-z]/gi, '').length
  display
    .map((w, i) => ({ i, n: letters(w), k: key[i] }))
    .filter((x) => x.n >= 6 && !FUNCTION.has(x.k))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .forEach((x) => add(x.i))
  return picked.sort((a, b) => a - b)
}
