'use client'

import { Star } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import type { LookupItem } from '@/endpoints/lookup'
import { load, save, toggleFavorite } from '@/practice/store'
import { STORE_EVENT, isMember, schedulePush, sync } from '@/practice/syncClient'
import { cn } from '@/utilities/ui'

// 我的收藏（009 US4、contracts/ui.md）：单元 / 题目两个标签，按收藏时间倒序；取消后这一行留着可撤销，离开页面才消失
const PAGE = 20
const MODULE = { listening: '听力', reading: '阅读', writing: '写作' } as const

type Fav = { key: string; at: number; on: boolean; kind: 'unit' | 'question'; lookupId: string; href: string; number?: number }

const parse = (key: string, at: number, on: boolean): Fav | null => {
  const q = /^q:(.+)#(\d+)$/.exec(key)
  if (q) return { key, at, on, kind: 'question', lookupId: q[1], href: `/practice/${q[1]}#q-${q[2]}`, number: Number(q[2]) }
  const w = /^w:(\d+)$/.exec(key)
  if (w) return { key, at, on, kind: 'unit', lookupId: key, href: `/writing/${w[1]}` }
  const u = /^u:(.+)$/.exec(key)
  if (u) return { key, at, on, kind: 'unit', lookupId: u[1], href: `/practice/${u[1]}` }
  return null
}

const when = (at: number) => {
  const d = new Date(at)
  return `${d.getMonth() + 1}月${d.getDate()}日收藏`
}

export const FavoriteList: React.FC = () => {
  const [favs, setFavs] = useState<Fav[] | null>(null)
  const [loggedIn, setLoggedIn] = useState(true)
  const [tab, setTab] = useState<'unit' | 'question'>('unit')
  const [page, setPage] = useState(1)
  const [info, setInfo] = useState<Record<string, LookupItem>>({})
  const shown = useRef(new Set<string>()) // 本次打开页面时出现过的收藏：取消后仍显示，可撤销

  useEffect(() => {
    const read = () => {
      const { favorites } = load().store
      const list = Object.entries(favorites)
        .filter(([k, m]) => m.on || shown.current.has(k))
        .flatMap(([k, m]) => parse(k, m.at, m.on) ?? [])
      for (const f of list) shown.current.add(f.key)
      // 取消再撤销会刷新收藏时间，排序按第一次看到时的时间保持不动
      setFavs((prev) => {
        const firstAt = new Map(prev?.map((f) => [f.key, f.at]))
        return list.map((f) => ({ ...f, at: firstAt.get(f.key) ?? f.at })).sort((a, b) => b.at - a.at)
      })
    }
    read()
    window.addEventListener(STORE_EVENT, read)
    void sync()
    void isMember().then(setLoggedIn)
    return () => window.removeEventListener(STORE_EVENT, read)
  }, [])

  const inTab = (favs ?? []).filter((f) => f.kind === tab)
  const pages = Math.max(1, Math.ceil(inTab.length / PAGE))
  const current = Math.min(page, pages)
  const rows = inTab.slice((current - 1) * PAGE, current * PAGE)

  const need = [...new Set(rows.map((r) => r.lookupId))].filter((k) => !info[k]).join(',')
  useEffect(() => {
    if (!need) return
    fetch(`/api/practice/lookup?ids=${encodeURIComponent(need)}`)
      .then((r) => r.json())
      .then((d: { items?: Record<string, LookupItem> }) => setInfo((cur) => ({ ...cur, ...d.items })))
      .catch(() => {})
  }, [need])

  const toggle = (key: string) => {
    const { store } = load()
    toggleFavorite(store, key)
    if (!save(store)) return
    schedulePush()
    window.dispatchEvent(new Event(STORE_EVENT))
  }

  if (favs === null) return <p className="text-muted-foreground">正在读取…</p>

  const count = (k: Fav['kind']) => favs.filter((f) => f.kind === k && f.on).length

  return (
    <div className="flex flex-col gap-4">
      {!loggedIn && (
        <p className="bg-muted px-5 py-4 text-[13px] text-muted-foreground">
          收藏保存在这台设备上。
          <Link className="ml-1 inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/login?next=/me/favorites">
            登录后可在其他设备查看 ↗
          </Link>
        </p>
      )}

      <div aria-label="收藏类型" className="flex gap-x-7 border-b border-border" role="group">
        {(
          [
            ['unit', '单元'],
            ['question', '题目'],
          ] as const
        ).map(([k, label]) => (
          <button
            aria-pressed={tab === k}
            className={cn(
              'inline-flex min-h-12 items-center gap-1.5 text-[15px]',
              tab === k ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground hover:text-foreground',
            )}
            key={k}
            onClick={() => {
              setTab(k)
              setPage(1)
            }}
            type="button"
          >
            {label}
            <span aria-hidden="true" className="text-[13px] font-normal text-muted-foreground tabular-nums">
              {count(k)}
            </span>
          </button>
        ))}
      </div>

      {!inTab.length ? (
        <p className="py-10 text-[15px] text-muted-foreground">
          在{tab === 'unit' ? '栏目页、练习页或写作题' : '交卷后解析面板的题号'}旁点 ☆ 收藏，会出现在这里。
        </p>
      ) : (
        <ul className="border-t border-border">
          {rows.map((f) => {
            const item = info[f.lookupId]
            const gone = item?.gone === true
            const title = gone ? '已下架' : item ? item.title : '…'
            const meta = [item && !item.gone ? MODULE[item.module] : null, f.number ? `第 ${f.number} 题` : null, when(f.at)].filter(Boolean)
            return (
              <li className={cn('flex items-center gap-4 border-b border-border py-3', !f.on && 'opacity-60')} data-testid="fav-row" key={f.key}>
                <div className="min-w-0 flex-1">
                  {gone ? (
                    <span className="block text-[17px] font-medium text-muted-foreground">{title}</span>
                  ) : (
                    <Link className="flex min-h-11 flex-col justify-center hover:underline hover:underline-offset-4" href={f.href}>
                      <span className="text-[17px] font-medium">{title}</span>
                    </Link>
                  )}
                  <p className="flex flex-wrap gap-x-3.5 text-[13px] text-muted-foreground">
                    {meta.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </p>
                </div>
                {f.on ? (
                  <button
                    aria-label="取消收藏"
                    aria-pressed
                    className="inline-flex size-11 shrink-0 items-center justify-center text-mark"
                    data-testid="fav-btn"
                    onClick={() => toggle(f.key)}
                    title="取消收藏"
                    type="button"
                  >
                    <Star aria-hidden="true" className="size-6" fill="currentColor" strokeWidth={1.5} />
                  </button>
                ) : (
                  <button className="inline-flex min-h-11 shrink-0 items-center px-3 text-sm font-semibold hover:underline" onClick={() => toggle(f.key)} type="button">
                    撤销
                  </button>
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
