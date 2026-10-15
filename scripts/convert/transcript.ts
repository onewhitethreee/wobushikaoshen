// 听力原文（007 T033，research R7）：原始逐句 → 导入包 transcript，标出播报语

export type RawSentence = { i: number; speaker?: string; start?: number; end?: number; text: string }
export type Sentence = { n: number; speaker?: string; start?: number; end?: number; text: string; announce?: true }

// 开头那段播报（Part one. / You will hear… / you have some time to look at… / Now listen and answer…）
const LEAD = [
  /^(part|section) (one|two|three|four|[1-4])\.?$/i,
  /^you will hear\b/i,
  /^(first|1st),? you (will )?have (some )?time to (look at|read)\b/i,
  /^now listen (carefully )?and answer\b/i,
]
// 中途的播报：哪里出现都算
const ANYWHERE = [
  /^before you hear the rest\b/i,
  /^now (turn|look) to (questions?|section|part)\b/i,
  /\byou (now )?have (some )?time to (look at|read) questions?\b/i,
  /^now listen (carefully )?and answer questions?\b/i,
]
// 结尾：从 "That is the end of part/section …" 开始到最后（讲者自己说的 "That is the end of my talk" 不算）
const END = /^that is the end of (part|section) /i

/** 标出播报语；规则漏判只影响显示，不影响判分 */
export const toTranscript = (raw: RawSentence[]): { transcript: Sentence[]; issues: string[] } => {
  const issues: string[] = []
  const transcript: Sentence[] = raw.map((s) => ({
    n: s.i,
    speaker: s.speaker || undefined,
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }))
  for (const s of transcript) {
    if (!LEAD.some((re) => re.test(s.text))) break
    s.announce = true
  }
  const endAt = transcript.findIndex((s) => END.test(s.text))
  transcript.forEach((s, i) => {
    if ((endAt >= 0 && i >= endAt) || ANYWHERE.some((re) => re.test(s.text))) s.announce = true
  })

  if (transcript.some((s, i) => s.n !== i)) issues.push('句子编号不是从 0 连续')
  const timed = transcript.every((s, i) => typeof s.start === 'number' && (i === 0 || s.start! >= transcript[i - 1].start!))
  return { transcript, issues: timed ? issues : [...issues, '无逐句时间轴（缺失或倒序），不影响导入'] }
}
