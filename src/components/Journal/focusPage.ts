import type { PracticeRow, Tab } from '@/sample'

export const ALL = '全部'

export const matches = (row: PracticeRow, match: Record<string, string>) =>
  Object.entries(match).every(([k, v]) => row.facets[k] === v)

// 过滤规则见 specs/002-frontend-visual-design/data-model.md
export const visible = (row: PracticeRow, tab: Tab, filters: Record<string, string>) =>
  matches(row, tab.match) &&
  Object.entries(filters).every(([k, v]) => {
    if (v === ALL) return true
    if (k === 'status') return (v === '已做') === Boolean(row.record)
    return row.facets[k] === v
  })

/** focus 行在过滤结果里的页码（从 1 起）；不在结果里返回 1。rows 需已带本机记录，否则"已做"筛选会算错（008 US3） */
export const focusPage = (rows: PracticeRow[], tab: Tab, filters: Record<string, string>, focus: string | undefined, pageSize: number) => {
  const i = rows.filter((r) => visible(r, tab, filters)).findIndex((r) => r.id === focus)
  return i >= 0 ? Math.floor(i / pageSize) + 1 : 1
}
