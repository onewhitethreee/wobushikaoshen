// 做题计时（020 research R1–R6）：倒计时时长、格式、按当前题累计用时。纯函数 + 本机偏好
import { groupNumbers, type PracticeUnit } from '@/exam/practice'

export type TimerMode = 'up' | 'down' | 'hidden'
/** elapsed、times 为秒（浮点）；times 的键是题的首题号；current 为当前题首题号 */
export type Clock = { elapsed: number; times: Record<number, number>; current?: number }

export const MAX_SECONDS = 86400
export const clampSec = (n: number) => Math.min(MAX_SECONDS, Math.max(0, Math.round(n || 0)))

const MODE_KEY = 'ybz:timer:v1'

/** 阅读每题 1.5 分钟（官方 60 分钟 40 题）；听力按各 Part 音频长度，不知道时每 Part 10 分钟。都向上取整到分钟 */
export const limitSeconds = (unit: PracticeUnit): number => {
  if (unit.module === 'reading') {
    const n = unit.sections.reduce((s, sec) => s + sec.groups.reduce((m, g) => m + groupNumbers(g).length, 0), 0)
    return Math.ceil(n * 1.5) * 60
  }
  const sec = unit.sections.reduce((s, x) => {
    const last = Array.isArray(x.transcript) ? x.transcript[x.transcript.length - 1]?.end : undefined
    return s + (typeof last === 'number' && last > 0 ? last : 600)
  }, 0)
  return Math.ceil(sec / 60) * 60
}

/** 秒 → m:ss，满 1 小时 h:mm:ss */
export const fmt = (sec: number) => {
  const s = Math.floor(Math.abs(sec))
  const pad = (n: number) => String(n).padStart(2, '0')
  const [h, m, r] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

export const tick = (clock: Clock, dt: number) => {
  clock.elapsed += dt
  if (clock.current !== undefined) clock.times[clock.current] = (clock.times[clock.current] ?? 0) + dt
}

/** 题号 → 所在题的首题号（多选题占多个题号） */
export const anchorOf = (unit: PracticeUnit, n: number): number | undefined => {
  for (const s of unit.sections)
    for (const g of s.groups) for (const q of g.questions) if (n >= q.number && n < q.number + Math.max(q.span, 1)) return q.number
}

/** 用时 ≥ min 秒的题里最长的 n 道，[首题号, 秒] 降序 */
export const topTimes = (times: Record<number, number>, n = 3, min = 5): [number, number][] =>
  Object.entries(times)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .filter(([, v]) => v >= min)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, n)

/** 存进度 / 交卷记录用：整数秒、夹到上限、去掉 0 */
export const toSaved = (clock: Pick<Clock, 'elapsed' | 'times'>) => ({
  elapsed: clampSec(clock.elapsed),
  times: Object.fromEntries(
    Object.entries(clock.times)
      .map(([k, v]) => [k, clampSec(v)] as const)
      .filter(([, v]) => v > 0),
  ) as Record<number, number>,
})

export const loadMode = (): TimerMode => {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'down' || v === 'hidden' ? v : 'up'
  } catch {
    return 'up'
  }
}

export const saveMode = (m: TimerMode) => {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    // 存不了只是下次回到默认
  }
}
