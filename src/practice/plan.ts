// 备考计划（024 research R2–R5）：剩余天数、每日题量、今天已做、最弱题型、打卡日历。纯函数
import { moduleOf } from '@/account/mistakes'
import type { PracticeRecord } from '@/practice/store'
import { dayStart } from '@/vocab/schedule'
import type { WordItem } from '@/vocab/store'

export type Plan = { at: number; examDate: string | null; target: number }
type Module = 'listening' | 'reading'

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

/** 时间所在的"学习日"（凌晨 4 点为界）的日期 YYYY-MM-DD */
export const studyDay = (t: number) => {
  const d = new Date(dayStart(t))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY)
}
const fromNumber = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)

/** 考试日期与今天（学习日）相差的天数：当天 0，已过为负 */
export const daysLeft = (examDate: string, now: number) => dayNumber(examDate) - dayNumber(studyDay(now))

/** 未做 ÷ 剩余天数，向上取整，最少 1；考前两周以外每科最多 2，两周内听力 4、阅读 3 */
export const dailyTarget = (undone: number, days: number, module: Module) => {
  if (undone <= 0) return 0
  const cap = days > 14 ? 2 : module === 'listening' ? 4 : 3
  return Math.min(cap, Math.max(1, Math.ceil(undone / Math.max(days, 1))))
}

const unitOf = (id: string) => id.replace(/-g\d+$/, '')
// 033：备考计划只算雅思，四 / 六级记录不计
const mine = (records: PracticeRecord[], module: Module) => records.filter((r) => !r.exam && moduleOf(r, r.unitId) === (module === 'listening' ? 'l' : 'r'))

/** 这科做过的练习单元（u{id}），题组归到单元 */
export const doneUnits = (records: PracticeRecord[], module: Module) =>
  new Set(mine(records, module).map((r) => unitOf(r.unitId)).filter((id) => /^u\d+$/.test(id)))

/** 今天这科交过卷的不同单元数 */
export const doneToday = (records: PracticeRecord[], module: Module, now: number) => {
  const start = dayStart(now)
  return new Set(mine(records, module).filter((r) => r.at >= start).map((r) => unitOf(r.unitId))).size
}

/** 题数 ≥ min 的题型里正确率最低的 */
export const weakest = (types: { label: string; correct: number; total: number }[], min = 5) =>
  types.filter((t) => t.total >= min).sort((a, b) => a.correct / a.total - b.correct / b.total)[0]?.label

/** 最近 35 天（含今天）的打卡和连续天数；今天还没打卡时从昨天往前数 */
export const calendar = (records: PracticeRecord[], words: Record<string, WordItem>, now: number) => {
  const active = new Set<string>()
  for (const r of records) active.add(studyDay(r.at))
  for (const w of Object.values(words)) if (w.card?.last_review) active.add(studyDay(w.card.last_review))
  const today = dayNumber(studyDay(now))
  const days = Array.from({ length: 35 }, (_, i) => {
    const date = fromNumber(today - 34 + i)
    return { date, active: active.has(date), today: i === 34 }
  })
  let streak = 0
  for (let n = active.has(fromNumber(today)) ? today : today - 1; active.has(fromNumber(n)); n--) streak++
  return { days, streak }
}
