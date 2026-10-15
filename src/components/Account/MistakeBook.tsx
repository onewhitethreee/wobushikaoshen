'use client'

import { ArrowUpRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'

import { mistakes, type Mistake } from '@/account/mistakes'
import { listeningType, readingType } from '@/exam/typeNames'
import type { LookupItem, LookupQuestion } from '@/endpoints/lookup'
import { dismissMistake, load, save } from '@/practice/store'
import { STORE_EVENT, isMember, schedulePush, sync } from '@/practice/syncClient'
import { cn } from '@/utilities/ui'

// 错题本（009 US3、contracts/ui.md）：按栏目 / 题型 / 掌握情况筛选，每页 20 条，只查当前页的题目信息
const PAGE = 20
const ALL = '全部'
const MODULES = { [ALL]: null, 听力: 'l', 阅读: 'r' } as const
const STATES = { 未掌握: 'wrong', 已掌握: 'mastered' } as const

const typeName = (m: Mistake) => (m.module === 'l' ? listeningType : readingType)[m.type] ?? m.type
const when = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 选择题把选项文字带上：B → B. some text */
const withText = (keys: string, q?: LookupQuestion) =>
  keys
    .split(/[,，\n]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => {
      const o = q?.options.find((x) => x.key === k)
      return o ? `${k}. ${o.text}` : k
    })
    .join('；')

const yourAnswer = (m: Mistake, q?: LookupQuestion) => {
  const a = m.answers?.[q?.number ?? m.number]
  if (Array.isArray(a)) return a.length ? withText(a.join(','), q) : '—'
  return a?.trim() ? withText(a, q) : '—'
}

const Tabs: React.FC<{ label: string; testid: string; options: [string, number][]; value: string; onChange: (v: string) => void }> = ({
  label,
  testid,
  options,
  value,
  onChange,
}) => (
  <div aria-label={label} className="flex gap-x-7 overflow-x-auto border-b border-border" data-testid={testid} role="group">
    {options.map(([o, n]) => {
      const on = o === value
      return (
        <button
          aria-pressed={on}
          className={cn(
            'inline-flex min-h-12 shrink-0 items-center gap-1.5 text-[15px]',
            on ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground hover:text-foreground',
          )}
          key={o}
          onClick={() => onChange(o)}
          type="button"
        >
          {o}
          <span aria-hidden="true" className="text-[13px] font-normal text-muted-foreground tabular-nums">
            {n}
          </span>
        </button>
      )
    })}
  </div>
)

export const MistakeBook: React.FC = () => {
  const [all, setAll] = useState<Mistake[] | null>(null)
  const [loggedIn, setLoggedIn] = useState(true)
  const [mod, setMod] = useState<string>(ALL)
  const [type, setType] = useState<string>(ALL)
  const [state, setState] = useState<keyof typeof STATES>('未掌握')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [info, setInfo] = useState<Record<string, LookupItem>>({})

  useEffect(() => {
    const read = () => {
      const { store } = load()
      setAll(mistakes(store.records, store.dismissed))
    }
    read()
    window.addEventListener(STORE_EVENT, read)
    void sync()
    void isMember().then(setLoggedIn)
    return () => window.removeEventListener(STORE_EVENT, read)
  }, [])

  const inState = useMemo(() => (all ?? []).filter((m) => m.state === STATES[state]), [all, state])
  const inModule = inState.filter((m) => !MODULES[mod as keyof typeof MODULES] || m.module === MODULES[mod as keyof typeof MODULES])
  const types = [...new Set(inModule.map(typeName))]
  const shown = inModule.filter((m) => type === ALL || typeName(m) === type)
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const current = Math.min(page, pages)
  const rows = shown.slice((current - 1) * PAGE, current * PAGE)

  const need = [...new Set(rows.map((r) => r.groupKey))].filter((k) => !info[k]).join(',')
  useEffect(() => {
    if (!need) return
    fetch(`/api/practice/lookup?ids=${encodeURIComponent(need)}`)
      .then((r) => r.json())
      .then((d: { items?: Record<string, LookupItem> }) => setInfo((cur) => ({ ...cur, ...d.items })))
      .catch(() => {})
  }, [need])

  const dismiss = (key: string) => {
    const { store } = load()
    dismissMistake(store, key)
    save(store)
    schedulePush()
    setAll(mistakes(store.records, store.dismissed))
  }

  const reset = (f: () => void) => {
    f()
    setPage(1)
    setOpen(null)
  }

  if (all === null) return <p className="text-muted-foreground">正在读取…</p>

  return (
    <div className="flex flex-col gap-4">
      {!loggedIn && (
        <p className="bg-muted px-5 py-4 text-[13px] text-muted-foreground">
          错题保存在这台设备上。
          <Link className="ml-1 inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/login?next=/me/mistakes">
            登录后可在其他设备查看 ↗
          </Link>
        </p>
      )}

      <Tabs
        label="掌握情况"
        onChange={(v) => reset(() => setState(v as keyof typeof STATES))}
        options={Object.keys(STATES).map((s) => [s, (all ?? []).filter((m) => m.state === STATES[s as keyof typeof STATES]).length])}
        testid="filter-state"
        value={state}
      />
      <Tabs
        label="栏目"
        onChange={(v) => reset(() => {
          setMod(v)
          setType(ALL)
        })}
        options={Object.entries(MODULES).map(([k, v]) => [k, inState.filter((m) => !v || m.module === v).length])}
        testid="filter-module"
        value={mod}
      />
      {types.length > 1 && (
        <Tabs
          label="题型"
          onChange={(v) => reset(() => setType(v))}
          options={[[ALL, inModule.length], ...types.map((t): [string, number] => [t, inModule.filter((m) => typeName(m) === t).length])]}
          testid="filter-type"
          value={type}
        />
      )}

      {!shown.length ? (
        <div className="flex flex-col items-start gap-3 py-10">
          <p className="text-[15px] text-muted-foreground">
            {state === '未掌握' ? '交卷后做错的题会出现在这里。' : '错过、后来做对的题会出现在这里。'}
          </p>
          <Link className="inline-flex min-h-11 items-center gap-1 border-[1.5px] border-foreground px-5 text-sm font-semibold hover:bg-primary hover:text-primary-foreground" href="/listening">
            去练习 <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="border-t border-border">
          {rows.map((m) => {
            const item = info[m.groupKey]
            const gone = item?.gone === true
            const q = item && !item.gone ? item.questions?.find((x) => m.number >= x.number && m.number < x.number + Math.max(x.span, 1)) : undefined
            const expanded = open === m.key
            return (
              <li className="border-b border-border py-4" data-testid="mistake-row" key={m.key}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <button
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-[1_1_280px] items-center gap-4 text-left"
                    onClick={() => setOpen(expanded ? null : m.key)}
                    type="button"
                  >
                    <span className="flex size-[52px] shrink-0 items-center justify-center ring-[1.5px] ring-foreground ring-inset">
                      <span className="text-[15px] font-semibold tabular-nums">{m.number}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[17px] font-medium">{gone ? '题目已下架' : (item?.title ?? '…')}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3.5 text-[13px] text-muted-foreground">
                        <span>{m.module === 'l' ? '听力' : '阅读'}</span>
                        <span>{typeName(m)}</span>
                        <span>{when(m.at)}</span>
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" className={cn('ml-auto size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                  </button>
                  <div className="ml-auto">
                    {gone ? (
                      <button className="inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => dismiss(m.key)} type="button">
                        移除
                      </button>
                    ) : (
                      <Link
                        className="inline-flex min-h-11 items-center gap-1 border-[1.5px] border-foreground px-4 text-sm font-semibold hover:bg-primary hover:text-primary-foreground"
                        href={`/practice/${m.groupKey}`}
                      >
                        重做 <ArrowUpRight aria-hidden="true" className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>
                {expanded && !gone && (
                  <dl className="mt-3 grid gap-x-4 gap-y-1.5 bg-muted px-5 py-4 text-[15px] sm:grid-cols-[6em_1fr]">
                    {q?.prompt && (
                      <>
                        <dt className="text-muted-foreground">题目</dt>
                        <dd>{q.prompt}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">你的答案</dt>
                    <dd className="text-error">{yourAnswer(m, q)}</dd>
                    <dt className="text-muted-foreground">正确答案</dt>
                    <dd className="text-success">{q ? withText(q.answers, q) : '…'}</dd>
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="翻页" className="flex items-center justify-between text-sm">
          <button className="min-h-11 px-2 disabled:text-muted-foreground" disabled={current <= 1} onClick={() => setPage(current - 1)} type="button">
            ← 上一页
          </button>
          <span className="text-muted-foreground tabular-nums">
            {current} / {pages}
          </span>
          <button className="min-h-11 px-2 disabled:text-muted-foreground" disabled={current >= pages} onClick={() => setPage(current + 1)} type="button">
            下一页 →
          </button>
        </nav>
      )}
    </div>
  )
}
