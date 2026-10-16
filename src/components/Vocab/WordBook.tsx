'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'

import { Tabs } from '@/components/Account/MistakeBook'
import type { LookupItem } from '@/endpoints/lookup'
import { STORE_EVENT, isMember, sync } from '@/practice/syncClient'
import { dueLabel, status, STATUS_LABEL, type Status } from '@/vocab/schedule'
import { activeWords, load, putWord, removeWord, type Source, type WordItem } from '@/vocab/store'

// 单词本（013 US2，contracts/ui.md "单词本"）：按加入时间倒序、状态筛选、拼写搜索、每页 50 条
const PAGE = 50
const ALL = '全部'
const FILTERS: Record<string, Status | null> = {
  [ALL]: null,
  新词: 'new',
  学习中: 'learning',
  已掌握: 'mastered',
}

/** 出处位置：#p{k}-s{n} → 第 k+1 部分第 n+1 句；#q-{n} → 第 n 题 */
export const placeOf = (href: string) => {
  const m = /#(?:p(\d+)-s(\d+)|q-(\d+))$/.exec(href)
  if (!m) return ''
  return m[3] ? `第 ${m[3]} 题` : `第 ${Number(m[1]) + 1} 部分第 ${Number(m[2]) + 1} 句`
}
// 练习单元 u{id}、套题 t{id}-{l|r}{n}（009 lookup 接口两种都认）
export const unitIdOf = (href: string) => /^\/practice\/([^/?#]+)/.exec(href)?.[1]

/** 原句里把这个词（及其变形的开头）用 mark 底色标出 */
export const Sentence: React.FC<{ text: string; word: string }> = ({ text, word }) => {
  const stem = word.length > 4 ? word.slice(0, -1) : word
  const re = new RegExp(`(\\b${stem.replace(/[^a-z'-]/gi, '')}[a-z]*)`, 'i')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark className="bg-mark px-0.5 text-mark-foreground" key={i}>
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  )
}

export const SourceLink: React.FC<{ s: Source; gone?: boolean }> = ({ s, gone }) => {
  const label = [s.title, placeOf(s.href)].filter(Boolean).join(' · ') || '原文'
  if (gone) return <span className="text-[13px] text-muted-foreground">原文已下架</span>
  return (
    <a
      className="inline-flex min-h-11 items-center gap-1 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
      href={s.href}
    >
      出处：{label} <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </a>
  )
}

export const WordBook: React.FC = () => {
  const [words, setWords] = useState<[string, WordItem][] | null>(null)
  const [ok, setOk] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [filter, setFilter] = useState(ALL)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [gone, setGone] = useState<Record<string, boolean>>({})
  const [now] = useState(() => Date.now())
  // 刚移出的词：几秒内可以撤销（移出会删掉复习记录）
  const [undone, setUndone] = useState<{ word: string; item: WordItem } | null>(null)
  useEffect(() => {
    if (!undone) return
    const t = setTimeout(() => setUndone(null), 8000)
    return () => clearTimeout(t)
  }, [undone])
  const remove = (word: string, item: WordItem) => {
    if (removeWord(word) === 'ok') setUndone({ word, item })
  }
  const restore = () => {
    // at 取现在，比删除标记新，同步合并时才不会被删掉
    if (undone) putWord(undone.word, { ...undone.item, at: Date.now() })
    setUndone(null)
  }

  useEffect(() => {
    const read = () => {
      const v = load()
      setOk(v.ok)
      setWords(activeWords(v.words).sort((a, b) => (b[1].added ?? 0) - (a[1].added ?? 0)))
    }
    read()
    window.addEventListener(STORE_EVENT, read)
    void sync()
    void isMember().then(setLoggedIn)
    return () => window.removeEventListener(STORE_EVENT, read)
  }, [])

  const shown = useMemo(() => {
    const s = FILTERS[filter]
    const needle = q.trim().toLowerCase()
    return (words ?? []).filter(
      ([k, w]) => (!s || status(w) === s) && (!needle || k.includes(needle)),
    )
  }, [words, filter, q])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const current = Math.min(page, pages)
  const rows = shown.slice((current - 1) * PAGE, current * PAGE)

  // 出处所在单元是否已下架：当前页的单元 id 每 20 个一批查（009 错题本同一个接口）
  const need = [
    ...new Set(
      rows.flatMap(([, w]) =>
        (w.src ?? []).map((s) => unitIdOf(s.href)).filter((x): x is string => !!x),
      ),
    ),
  ]
    .filter((id) => !(id in gone))
    .join(',')
  useEffect(() => {
    if (!need) return
    const ids = need.split(',')
    for (let i = 0; i < ids.length; i += 20) {
      fetch(`/api/practice/lookup?ids=${encodeURIComponent(ids.slice(i, i + 20).join(','))}`)
        .then((r) => r.json())
        .then((d: { items?: Record<string, LookupItem> }) =>
          setGone((cur) => ({
            ...cur,
            ...Object.fromEntries(Object.entries(d.items ?? {}).map(([k, v]) => [k, v.gone])),
          })),
        )
        .catch(() => {})
    }
  }, [need])

  if (words === null) return <p className="text-muted-foreground">加载中…</p>
  const count = (s: Status | null) => (words ?? []).filter(([, w]) => !s || status(w) === s).length

  return (
    <div className="flex flex-col gap-4">
      {!ok && (
        <p className="bg-warning-soft px-5 py-4 text-[13px] text-warning">
          这个浏览器不能保存单词本。
        </p>
      )}
      {ok && !loggedIn && (
        <p className="bg-muted px-5 py-4 text-[13px] text-muted-foreground">
          <Link
            className="ml-1 inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
            href="/login?next=/me/words"
          >
            登录后换设备也能看到 ↗
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <Tabs
            label="学习状态"
            onChange={(v) => {
              setFilter(v)
              setPage(1)
            }}
            options={Object.entries(FILTERS).map(([k, s]) => [k, count(s)])}
            testid="word-filter"
            value={filter}
          />
        </div>
        <input
          aria-label="搜索拼写"
          className="h-11 w-full border border-input bg-background px-3 text-[15px] sm:w-56"
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="搜索拼写…"
          type="search"
          value={q}
        />
      </div>
      <p aria-live="polite" className="text-[15px] empty:hidden">
        {undone && (
          <>
            已移出 {undone.word}。
            <button
              className="ml-2 min-h-11 font-semibold underline underline-offset-4"
              data-testid="word-undo"
              onClick={restore}
              type="button"
            >
              撤销
            </button>
          </>
        )}
      </p>
      {!shown.length ? (
        <div className="flex flex-col items-start gap-3 py-10">
          <p className="text-[15px] text-muted-foreground">
            {words.length ? '没有符合条件的单词。' : '在电脑上双击文章里的单词，就能加入单词本。'}
          </p>
          <Link
            className="inline-flex min-h-11 items-center gap-1 border-[1.5px] border-foreground px-5 text-sm font-semibold hover:bg-primary hover:text-primary-foreground"
            href="/reading"
          >
            去做阅读 <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="border-t border-border">
          {rows.map(([k, w]) => {
            const st = status(w)
            const src = w.src?.at(-1)
            const id = src && unitIdOf(src.href)
            return (
              <li
                className="flex flex-col gap-1.5 border-b border-border py-4"
                data-testid="word-row"
                key={k}
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="text-[18px] font-semibold">{k}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">
                    {w.meaning?.split('\n')[0]}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {STATUS_LABEL[st]}
                    {st !== 'new' && ` · ${dueLabel(w, now)}`}
                  </span>
                </div>
                {src && (
                  <p className="text-[15px] leading-[1.7]" lang="en">
                    <Sentence text={src.text} word={k} />
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-6">
                  {src && <SourceLink gone={!!id && gone[id]} s={src} />}
                  <button
                    aria-label={`移出 ${k}`}
                    className="ml-auto min-h-11 min-w-11 px-2 text-[13px] text-muted-foreground hover:text-foreground"
                    data-testid="word-remove"
                    onClick={() => remove(k, w)}
                    type="button"
                  >
                    移出
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="翻页" className="flex items-center justify-center gap-6 text-[15px]">
          <button
            className="min-h-11 disabled:text-muted-foreground"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            type="button"
          >
            ← 上一页
          </button>
          <span className="tabular-nums">
            {current} / {pages}
          </span>
          <button
            className="min-h-11 disabled:text-muted-foreground"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
            type="button"
          >
            下一页 →
          </button>
        </nav>
      )}
    </div>
  )
}
