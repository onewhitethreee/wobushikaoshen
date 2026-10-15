// 本机与账号之间的数据合并（009 research R6）。纯函数，接口和浏览器共用。
// 规则：记录取并集；其余按时间取新，取消 / 清空也是一条带时间的记录（删除标记），旧设备的数据不会复活
import { MAX_RECORDS, type Draft, type Mark, type PracticeRecord, type Progress } from '@/practice/store'

export type SyncData = {
  records: PracticeRecord[]
  progress: Record<string, Progress>
  drafts: Record<string, Draft>
  favorites: Record<string, Mark>
  dismissed: Record<string, Mark>
}

export const emptyData = (): SyncData => ({ records: [], progress: {}, drafts: {}, favorites: {}, dismissed: {} })

const recordKey = (r: PracticeRecord) => `${r.unitId}@${r.at}`

// 时间相同时按内容定先后，保证 merge(a, b) 与 merge(b, a) 结果一样
const later = <T,>(x: T, y: T, at: (v: T) => number): T => {
  const d = at(y) - at(x)
  if (d) return d > 0 ? y : x
  return JSON.stringify(y) > JSON.stringify(x) ? y : x
}

const newest = <T,>(a: Record<string, T> = {}, b: Record<string, T> = {}, at: (v: T) => number) => {
  const out: Record<string, T> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? later(out[k], v, at) : v
  return out
}

export const mergeData = (a: Partial<SyncData>, b: Partial<SyncData>): SyncData => {
  const byKey = new Map<string, PracticeRecord>()
  for (const r of [...(a.records ?? []), ...(b.records ?? [])]) {
    const k = recordKey(r)
    const old = byKey.get(k)
    byKey.set(k, old ? later(old, r, () => 0) : r)
  }
  const records = [...byKey.values()]
    .sort((x, y) => x.at - y.at || (recordKey(x) < recordKey(y) ? -1 : 1))
    .slice(-MAX_RECORDS)

  // 交卷后进度就没用了：同一单元有不早于进度的记录时丢掉进度
  const lastAt = new Map<string, number>()
  for (const r of records) lastAt.set(r.unitId, Math.max(lastAt.get(r.unitId) ?? 0, r.at))
  const progress = newest(a.progress, b.progress, (p) => p.savedAt)
  for (const [k, p] of Object.entries(progress)) if ((lastAt.get(k) ?? -1) >= p.savedAt) delete progress[k]

  return {
    records,
    progress,
    drafts: newest(a.drafts, b.drafts, (d) => d.at),
    favorites: newest(a.favorites, b.favorites, (m) => m.at),
    dismissed: newest(a.dismissed, b.dismissed, (m) => m.at),
  }
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown, max = 200) => typeof v === 'string' && v.length <= max
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const every = (o: unknown, ok: (v: Record<string, unknown>) => boolean, max = 5000) =>
  o === undefined || (isObj(o) && Object.keys(o).length <= max && Object.entries(o).every(([k, v]) => str(k) && isObj(v) && ok(v)))

/** 接口收到的数据逐项校验形状，不合格整体拒收 */
export const isSyncData = (d: unknown): d is Partial<SyncData> =>
  isObj(d) &&
  (d.records === undefined ||
    (Array.isArray(d.records) &&
      d.records.length <= MAX_RECORDS &&
      d.records.every(
        (r) =>
          isObj(r) && str(r.unitId) && num(r.at) && num(r.score) && num(r.total) && Array.isArray(r.items) && r.items.length <= 200 &&
          (r.module === undefined || r.module === 'l' || r.module === 'r') && (r.answers === undefined || isObj(r.answers)),
      ))) &&
  every(d.progress, (p) => str(p.version) && isObj(p.answers) && num(p.savedAt)) &&
  every(d.drafts, (x) => str(x.text, 20_000) && num(x.at)) &&
  every(d.favorites, (m) => num(m.at) && typeof m.on === 'boolean') &&
  every(d.dismissed, (m) => num(m.at) && typeof m.on === 'boolean')
