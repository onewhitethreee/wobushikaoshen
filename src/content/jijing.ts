// 机经栏目（027）：按口语换题月份（1 / 5 / 9 月）划分题季，记作 YYYY-01 / YYYY-05 / YYYY-09
export const SUBJECTS = [
  { label: '听力', value: 'listening' },
  { label: '阅读', value: 'reading' },
  { label: '写作', value: 'writing' },
  { label: '口语', value: 'speaking' },
] as const
export type Subject = (typeof SUBJECTS)[number]['value']

const pad = (n: number) => String(n).padStart(2, '0')

/** 日期所在的题季 */
export const seasonOf = (date: Date) => {
  const m = date.getMonth() + 1
  return `${date.getFullYear()}-${pad(m >= 9 ? 9 : m >= 5 ? 5 : 1)}`
}

export const isSeason = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(01|05|09)$/.test(s)

/** 2026-09 → 2026 年 9–12 月 */
export const seasonLabel = (s: string) => {
  const [y, m] = s.split('-').map(Number)
  return `${y} 年 ${m}–${m + 3} 月`
}
