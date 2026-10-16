// 复习调度（013 research R3、R4，data-model "每日队列"）：ts-fsrs 默认参数、不加随机扰动，固定输入结果稳定（FR-054）
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs'

import type { StoredCard, VocabSettings, WordItem } from './store'

const f = fsrs(generatorParameters({ enable_fuzz: false }))
const DAY = 24 * 3600_000
export const REQUEUE_MS = 20 * 60_000
export const MASTERED_DAYS = 21
/** 评分按钮顺序：忘了 / 模糊 / 记得 / 很熟 */
export const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

export const toCard = (s: StoredCard): Card => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review === undefined ? undefined : new Date(s.last_review),
})
export const fromCard = (c: Card): StoredCard => ({
  due: c.due.getTime(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  ...(c.last_review ? { last_review: c.last_review.getTime() } : {}),
})

/** 本地时间最近一个凌晨 4 点：熬夜背到 3 点仍算前一天 */
export const dayStart = (now: number) => {
  const d = new Date(now)
  d.setHours(4, 0, 0, 0)
  if (d.getTime() > now) d.setDate(d.getDate() - 1)
  return d.getTime()
}
export const dayEnd = (now: number) => {
  const d = new Date(dayStart(now))
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

export const learnedToday = (words: Record<string, WordItem>, now: number) => {
  const start = dayStart(now)
  return Object.values(words).filter((w) => w.on && (w.first ?? -1) >= start).length
}

/** 今天的队列：到期的全部（按到期时间），再加今天还剩名额的新词（按加入顺序） */
export const buildQueue = (words: Record<string, WordItem>, settings: VocabSettings, now: number) => {
  const end = dayEnd(now)
  const live = Object.entries(words).filter(([, w]) => w.on)
  const due = live.filter(([, w]) => w.card && w.card.due < end).sort((a, b) => a[1].card!.due - b[1].card!.due)
  const quota = Math.max(0, settings.newPerDay - learnedToday(words, now))
  const fresh = live.filter(([, w]) => !w.card).sort((a, b) => (a[1].added ?? 0) - (b[1].added ?? 0)).slice(0, quota)
  return { due: due.map(([k]) => k), fresh: fresh.map(([k]) => k) }
}

const cardOf = (w: WordItem, now: number) => (w.card ? toCard(w.card) : createEmptyCard(new Date(now)))

/** 四个评分各自的下次复习时间（毫秒） */
export const preview = (w: WordItem, now: number) => {
  const p = f.repeat(cardOf(w, now), new Date(now))
  return GRADES.map((g) => p[g].card.due.getTime())
}

export const rate = (w: WordItem, grade: Grade, now: number): WordItem => ({
  ...w,
  at: now,
  first: w.first ?? now,
  card: fromCard(f.next(cardOf(w, now), new Date(now), grade).card),
})

/** 作答后 20 分钟内又到期（学习 / 重学步骤）：本次学习里稍后再出现 */
export const requeue = (w: WordItem, now: number) => !!w.card && w.card.due - now < REQUEUE_MS

export type Status = 'new' | 'learning' | 'mastered'
export const status = (w: WordItem): Status => (!w.card ? 'new' : w.card.scheduled_days > MASTERED_DAYS ? 'mastered' : 'learning')
export const STATUS_LABEL: Record<Status, string> = { new: '新词', learning: '学习中', mastered: '已掌握' }

export const intervalLabel = (ms: number) => {
  if (ms < 3600_000) return `${Math.max(1, Math.round(ms / 60_000))} 分钟`
  if (ms < DAY) return `${Math.round(ms / 3600_000)} 小时`
  return `${Math.round(ms / DAY)} 天`
}

/** 单词本里"下次复习"那一栏 */
export const dueLabel = (w: WordItem, now: number) => {
  if (!w.card) return ''
  if (w.card.due < dayEnd(now)) return '今天'
  return `${intervalLabel(w.card.due - now)}后`
}
