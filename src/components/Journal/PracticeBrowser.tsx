'use client'

import { ArrowUpRight, Clock, Copy, ListOrdered } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import type { Action, ColumnConfig, PracticeRow } from '@/sample'
import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/ui'

import { lastScore, load, favKeyFromHref } from '@/practice/store'
import { STORE_EVENT, sync } from '@/practice/syncClient'
import { FavoriteButton } from '@/components/Account/FavoriteButton'

import { CostMark } from './CostMark'
import { ALL, focusPage, matches, visible } from './focusPage'
import { ScoreBadge } from './ScoreBadge'

export type BrowserInitial = {
  tab?: string
  filters: Record<string, string>
  focus?: string
  page?: number
}

// 每页条数（007 R10）。ponytail: 全部行一次下发、浏览器内分页；单栏目行数过万或首屏变慢时改服务端分页
const PAGE_SIZE = 20

// 栏目页三栏（006 FR-054）：左练法 / 状态，中标题 + 筛选 + 列表，右侧栏；窄屏依次堆叠
export const PracticeBrowser: React.FC<{
  config: ColumnConfig
  header: React.ReactNode
  aside: React.ReactNode
  initial: BrowserInitial
  mobileHint?: string
}> = ({ config, header, aside, initial, mobileHint }) => {
  const focusRow = config.rows.find((r) => r.id === initial.focus)
  const startTab =
    config.tabs.find((t) => t.id === initial.tab) ??
    (focusRow && config.tabs.find((t) => matches(focusRow, t.match))) ??
    config.tabs[0]

  const [tabId, setTabId] = useState(startTab.id)
  const [filters, setFiltersState] = useState<Record<string, string>>(initial.filters)
  // 有 focus 时打开它所在的那一页；真实数据要等本机记录读完再算（"已做 / 未做"筛选依赖记录）
  const [page, setPage] = useState(() =>
    initial.page ?? (config.isSample ? focusPage(config.rows, startTab, initial.filters, initial.focus, PAGE_SIZE) : 1),
  )
  const setFilters = (f: Record<string, string>) => {
    setFiltersState(f)
    setPage(1)
  }
  const focusRef = useRef<HTMLLIElement>(null)

  // 真实数据的"上次成绩"读本机记录（FR-052）；示例数据保留示例 record
  const [local, setLocal] = useState<Record<string, { correct: number; total: number }>>({})
  const [recordsReady, setRecordsReady] = useState(config.isSample)
  useEffect(() => {
    if (config.isSample) return
    const read = () => {
      const { store } = load()
      const records: Record<string, { correct: number; total: number }> = {}
      for (const r of config.rows) {
        const s = lastScore(store, r.id)
        if (s) records[r.id] = s
      }
      setLocal(records)
      return records
    }
    const records = read()
    setRecordsReady(true)
    // 有 focus 时，带上本机记录再算它所在页（"已做 / 未做"筛选依赖记录，008 US3）
    if (initial.focus && !initial.page) {
      const withRecords = config.rows.map((r) => ({ ...r, record: records[r.id] ? 'done' : undefined }))
      setPage(focusPage(withRecords, startTab, initial.filters, initial.focus, PAGE_SIZE))
    }
    // 已登录时取回其他设备的记录，取回后重读（009）
    window.addEventListener(STORE_EVENT, read)
    void sync()
    return () => window.removeEventListener(STORE_EVENT, read)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial / startTab 只取首次打开时的值
  }, [config])

  const tab = config.tabs.find((t) => t.id === tabId) ?? config.tabs[0]
  const allRows = config.rows.map((r) => {
    if (config.isSample) return r
    const s = local[r.id]
    return {
      ...r,
      record: s && `上次 ${s.correct}/${s.total}`,
      score: s && { kind: 'ratio' as const, ...s },
    }
  })
  const rows = allRows.filter((r) => visible(r, tab, filters))
  const statusFilter = tab.filters.find((f) => f.id === 'status')
  const otherFilters = tab.filters.filter((f) => f.id !== 'status')
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const desktopOnly = rows.some((r) => r.actions.some((a) => a.desktopOnly))

  // 标签和筛选写进网址，刷新、返回、分享都能保留
  useEffect(() => {
    const q = new URLSearchParams()
    if (tabId !== config.tabs[0].id) q.set('tab', tabId)
    for (const [k, v] of Object.entries(filters)) if (v !== ALL) q.set(k, v)
    if (current > 1) q.set('page', String(current))
    const s = q.toString()
    window.history.replaceState(null, '', s ? `?${s}` : window.location.pathname)
  }, [tabId, filters, config.tabs, current])

  // 记录读完、页码定好后滚到 focus 行（只滚一次）
  const scrolled = useRef(false)
  useEffect(() => {
    if (!recordsReady || scrolled.current || !focusRef.current) return
    scrolled.current = true
    focusRef.current.scrollIntoView({ block: 'center' })
  }, [recordsReady, current])

  const selectTab = (id: string) => {
    setTabId(id)
    setFilters({})
  }

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const d = ['ArrowRight', 'ArrowDown'].includes(e.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(e.key)
        ? -1
        : 0
    if (!d) return
    e.preventDefault()
    const next = config.tabs[(i + d + config.tabs.length) % config.tabs.length]
    selectTab(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  return (
    <div className="container flex flex-wrap pb-24">
      <div className="flex min-w-0 flex-[1_1_100%] flex-col gap-6 pt-6 lg:flex-[0_0_220px] lg:gap-8 lg:border-r lg:border-border lg:pt-10 lg:pr-8">
        <div>
          <p className="mb-1 text-[13px] text-muted-foreground">练法</p>
          <div
            aria-label="练习方式"
            aria-orientation="vertical"
            className="flex gap-x-6 overflow-x-auto lg:flex-col"
            role="tablist"
          >
            {config.tabs.map((t, i) => {
              const on = t.id === tab.id
              return (
                <button
                  aria-controls="practice-panel"
                  aria-selected={on}
                  className={cn(
                    'flex min-h-12 shrink-0 items-center gap-3 text-left text-[15px] whitespace-nowrap',
                    on
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  id={`tab-${t.id}`}
                  key={t.id}
                  onClick={() => selectTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  role="tab"
                  tabIndex={on ? 0 : -1}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-3 shrink-0',
                      on ? 'bg-mark' : 'ring-[1.5px] ring-muted-foreground ring-inset',
                    )}
                  />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
        {statusFilter && (
          <div>
            <p className="mb-1 text-[13px] text-muted-foreground">{statusFilter.label}</p>
            <div className="flex gap-x-6 lg:flex-col">
              {statusFilter.options.map((o) => {
                const on = (filters.status ?? ALL) === o
                const n = allRows.filter((r) => visible(r, tab, { ...filters, status: o })).length
                return (
                  <button
                    aria-pressed={on}
                    className={cn(
                      'flex min-h-11 items-center justify-between gap-3 text-[15px]',
                      on
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    key={o}
                    onClick={() => setFilters({ ...filters, status: o })}
                    type="button"
                  >
                    {o}
                    <span
                      aria-hidden="true"
                      className="font-normal text-muted-foreground tabular-nums"
                    >
                      {n}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <main
        aria-labelledby={`tab-${tab.id}`}
        className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 pt-8 lg:px-10 lg:pt-10"
        id="main"
        role="tabpanel"
      >
        {header}

        {otherFilters.map((f) => (
          <div
            aria-label={f.label}
            className="flex gap-x-7 overflow-x-auto border-b border-border"
            key={f.id}
            role="group"
          >
            {f.options.map((o) => {
              const on = (filters[f.id] ?? ALL) === o
              return (
                <button
                  aria-pressed={on}
                  className={cn(
                    'min-h-12 shrink-0 text-[15px]',
                    on
                      ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  key={o}
                  onClick={() => setFilters({ ...filters, [f.id]: o })}
                  type="button"
                >
                  {o}
                </button>
              )
            })}
          </div>
        ))}

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground" data-testid="result-count">
            找到 <b className="text-foreground">{rows.length}</b> 组
            {config.isSample && '（示例数据）'}
          </p>
          {mobileHint && (
            <p className="text-[13px] text-muted-foreground lg:hidden">{mobileHint}</p>
          )}
        </div>

        {desktopOnly && <DesktopNotice />}

        {rows.length === 0 ? (
          <div className="flex animate-reveal flex-col items-start gap-4 bg-muted px-6 py-10">
            <p className="font-semibold">没有符合条件的题</p>
            <Button onClick={() => setFilters({})} type="button" variant="outline">
              清除筛选
            </Button>
          </div>
        ) : (
          <ol className="flex flex-col">
            {shown.map((r) => (
              <RowView
                focused={r.id === initial.focus}
                key={r.id}
                ref={r.id === initial.focus ? focusRef : undefined}
                row={r}
              />
            ))}
          </ol>
        )}

        {pages > 1 && (
          <Pager
            current={current}
            onGo={(p) => {
              setPage(p)
              document.getElementById('main')?.scrollIntoView({ block: 'start' })
            }}
            pages={pages}
          />
        )}
      </main>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-8 pt-8 lg:border-l lg:border-border lg:pt-10 lg:pl-8">
        {aside}
      </aside>
    </div>
  )
}

// 翻页：上一页 / 第 N / M 页 / 下一页（下划线标签同款的纯文字按钮）
const Pager: React.FC<{ current: number; pages: number; onGo: (p: number) => void }> = ({
  current,
  pages,
  onGo,
}) => (
  <nav aria-label="翻页" className="flex items-center justify-between gap-4 text-[15px]">
    <button
      className="min-h-11 px-1 font-semibold disabled:text-muted-foreground disabled:opacity-60"
      disabled={current <= 1}
      onClick={() => onGo(current - 1)}
      type="button"
    >
      ← 上一页
    </button>
    <span className="text-muted-foreground tabular-nums" data-testid="pager">
      第 {current} / {pages} 页
    </span>
    <button
      className="min-h-11 px-1 font-semibold disabled:text-muted-foreground disabled:opacity-60"
      disabled={current >= pages}
      onClick={() => onGo(current + 1)}
      type="button"
    >
      下一页 →
    </button>
  </nav>
)

const DesktopNotice: React.FC = () => {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-muted px-5 py-4 lg:hidden">
      <p className="text-sm">考试模式请用电脑打开，手机上可以先看看有哪些套题。</p>
      <Button
        onClick={() =>
          navigator.clipboard?.writeText(window.location.href).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
        type="button"
        variant="outline"
      >
        <Copy aria-hidden="true" strokeWidth={1.5} />
        {copied ? '已复制链接' : '复制链接到电脑打开'}
      </Button>
    </div>
  )
}

// 题目行（006 FR-055）：行首编号方框，做过的描边、没做的近黑实心
const RowView = React.forwardRef<HTMLLIElement, { row: PracticeRow; focused: boolean }>(
  ({ row, focused }, ref) => {
    const done = Boolean(row.record || row.score)
    const favKey = row.actions[0] && favKeyFromHref(row.actions[0].href)
    return (
      <li
        className={cn(
          'flex scroll-mt-24 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border py-5',
          focused && 'bg-muted px-4 ring-2 ring-foreground ring-inset',
        )}
        data-testid="practice-row"
        ref={ref}
      >
        <div className="flex min-w-0 flex-[1_1_280px] items-center gap-4">
          <div
            className={cn(
              'flex size-[52px] shrink-0 flex-col items-center justify-center leading-tight',
              done
                ? 'ring-[1.5px] ring-foreground ring-inset'
                : 'bg-primary text-primary-foreground',
            )}
          >
            <span className="text-[15px] font-semibold">{row.lead}</span>
            {row.leadSub && (
              <span className="text-[10px] whitespace-nowrap opacity-80">{row.leadSub}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-medium">{row.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3.5 text-[13px] text-muted-foreground">
              {row.meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
              {row.count !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <ListOrdered aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                  {row.count} 题
                </span>
              )}
              {row.minutes !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden="true" className="size-3.5" strokeWidth={1.5} />约{' '}
                  {row.minutes} 分钟
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:w-auto sm:justify-end">
          {focused && (
            <span className="bg-primary px-2 py-0.5 text-[12px] font-semibold text-primary-foreground">
              从这里开始
            </span>
          )}
          {row.score ? (
            <ScoreBadge score={row.score} />
          ) : (
            <span
              className={cn(
                'text-[13px] tabular-nums',
                row.record ? 'font-semibold text-success' : 'text-muted-foreground',
              )}
            >
              {row.record ?? '未做'}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-2">
            {favKey && <FavoriteButton favKey={favKey} />}
            {row.actions.map((a, i) => (
              <ActionView action={a} done={Boolean(row.record) && i === 0} key={a.label} />
            ))}
          </span>
        </div>
      </li>
    )
  },
)
RowView.displayName = 'RowView'

const ActionView: React.FC<{ action: Action; done: boolean }> = ({ action, done }) => {
  const link = (
    <Button asChild variant="outline">
      <Link href={action.href}>
        {done && action.doneLabel ? action.doneLabel : action.label}
        <ArrowUpRight aria-hidden="true" strokeWidth={2} />
      </Link>
    </Button>
  )

  // 手机上不给考试入口，列表上方统一提示一次
  if (action.desktopOnly) return <span className="hidden lg:inline-flex">{link}</span>

  if (action.cost.kind === 'quota') {
    return (
      <span className="inline-flex items-center gap-2">
        {link}
        <CostMark cost={action.cost} />
      </span>
    )
  }

  return link
}
