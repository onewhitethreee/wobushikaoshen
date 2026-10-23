import type { PracticeRow } from '@/sample'

// 030 栏目随机抽题（specs/030-random-pick/research.md）。在浏览器里抽：范围 = 当前标签页 + 筛选下的行，
// 状态"全部"时优先没做过的，去掉本轮（这个浏览器标签页里）已抽过的，再等概率取一行

export const PICK_COLUMNS = ['listening', 'reading', 'writing'] as const

const ALL = '全部'

export type Drawn = { row: PracticeRow; allDone: boolean; resetRound: boolean }

export const drawRow = (
  rows: PracticeRow[],
  { status, round, rand = Math.random }: { status: string; round: string[]; rand?: () => number },
): Drawn | null => {
  if (!rows.length) return null
  // 状态筛成"未做 / 已做"时 rows 已经按它过滤过，尊重考生的选择
  const undone = status === ALL ? rows.filter((r) => !r.record) : rows
  const allDone = status === ALL && !undone.length
  const base = allDone ? rows : undone
  const seen = new Set(round)
  const fresh = base.filter((r) => !seen.has(r.id))
  const resetRound = !fresh.length
  const pool = resetRound ? base : fresh
  return { row: pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))], allDone, resetRound }
}

/** 网址里的 pick 只认三个栏目的站内路径（防止被拿来跳到别的网站），否则 null */
export const safeScope = (s: string | null | undefined): string | null => {
  if (!s?.startsWith('/')) return null
  try {
    const u = new URL(s, 'http://x')
    if (u.origin !== 'http://x' || !PICK_COLUMNS.some((c) => u.pathname === `/${c}`)) return null
    // 统一成浏览器编码后的形式（scopeOf 生成的本来就是这样），本轮记录按它分开记
    return u.pathname + u.search
  } catch {
    return null
  }
}

/** 范围 = 栏目路径 + 当前查询串，去掉翻页、定位和 draw；参数顺序和编码保持不变 */
export const scopeOf = (slug: string, search: string) => {
  const q = new URLSearchParams(search)
  for (const k of ['page', 'focus', 'draw']) q.delete(k)
  const s = q.toString()
  return s ? `/${slug}?${s}` : `/${slug}`
}

/** 抽中的入口加上 pick=范围（放在 # 前面） */
export const withPick = (href: string, scope: string) => {
  const i = href.indexOf('#')
  const [path, hash] = i < 0 ? [href, ''] : [href.slice(0, i), href.slice(i)]
  return `${path}${path.includes('?') ? '&' : '?'}pick=${encodeURIComponent(scope)}${hash}`
}

/** "再抽一题"：回到栏目页带 draw=1，栏目页按同样的范围抽 */
export const drawHref = (scope: string) => `${scope}${scope.includes('?') ? '&' : '?'}draw=1`

// 本轮已抽过：只记在这个浏览器标签页（sessionStorage），不同步
const KEY = 'ybz_pick_round:'
const MAX_ROUND = 500

export const readRound = (scope: string): string[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY + scope) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export const addRound = (scope: string, id: string) => {
  try {
    sessionStorage.setItem(KEY + scope, JSON.stringify([...readRound(scope), id].slice(-MAX_ROUND)))
  } catch {}
}

export const clearRound = (scope: string) => {
  try {
    sessionStorage.removeItem(KEY + scope)
  } catch {}
}
