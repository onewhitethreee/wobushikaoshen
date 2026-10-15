import type { Section } from '@/exam/practice'

// 听力按句控制（004 research R1）：当前句、上一句、下一句。句子来自 007 导入的逐句原文（带 start / end 秒）
export type TimedLine = { n: number; start: number; end: number }

/** 有时间的句子，按 start 排序；套题的整段字符串原文没有时间，返回空数组（调用方退回 ±5 秒） */
export const timedLines = (transcript: Section['transcript']): TimedLine[] =>
  Array.isArray(transcript)
    ? transcript
        .flatMap((l) => (typeof l.start === 'number' && typeof l.end === 'number' ? [{ n: l.n, start: l.start, end: l.end }] : []))
        .sort((a, b) => a.start - b.start)
    : []

/** 最后一个 start <= t 的句子下标；开场静音前为 -1。停顿期间自然停在上一句 */
export const currentIndex = (lines: TimedLine[], t: number) => {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].start <= t) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

/** 上一句的开始时间：当前句已播超过 1.5 秒先回到当前句开头；第一句或开场前回到 0 */
export const prevStart = (lines: TimedLine[], t: number) => {
  const i = currentIndex(lines, t)
  if (i < 0) return 0
  if (t - lines[i].start > 1.5) return lines[i].start
  return i > 0 ? lines[i - 1].start : 0
}

/** 下一句的开始时间；已是最后一句返回 null（不动作） */
export const nextStart = (lines: TimedLine[], t: number) => lines[currentIndex(lines, t) + 1]?.start ?? null
