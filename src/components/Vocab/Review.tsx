'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { sync } from '@/practice/syncClient'
import type { LookupItem } from '@/endpoints/lookup'
import { cn } from '@/utilities/ui'
import { buildQueue, GRADES, intervalLabel, preview, rate, requeue } from '@/vocab/schedule'
import { load, putWord, saveSettings, type VocabSettings, type WordItem } from '@/vocab/store'

import { speak } from './WordLookup'
import { Sentence, SourceLink, unitIdOf } from './WordBook'

// 背单词（013 US3、US4，contracts/ui.md "背单词"）：正面只有单词和遮住目标词的原句，翻面后评分；
// 每次作答立即写回本机，"忘了"等 20 分钟内到期的排回队尾
const LABELS = ['忘了', '模糊', '记得', '很熟']
// 键位提示只给有鼠标键盘的设备看
const KEY_HINT = 'hidden [@media(hover:hover)]:inline'

/** 原句里把这个词（含变形的开头）遮住；点一下显示 */
const Masked: React.FC<{ text: string; word: string }> = ({ text, word }) => {
  const [shown, setShown] = useState(false)
  const stem = word.length > 4 ? word.slice(0, -1) : word
  const parts = text.split(new RegExp(`(\\b${stem.replace(/[^a-z'-]/gi, '')}[a-z]*)`, 'i'))
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <button
            aria-label={shown ? undefined : '点击显示被遮住的词'}
            className={cn(
              'px-0.5',
              shown ? 'bg-mark text-mark-foreground' : 'bg-foreground text-transparent select-none',
            )}
            key={i}
            onClick={() => setShown(true)}
            type="button"
          >
            {p}
          </button>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  )
}

// seen：本次已经答过的词（排回队尾再答不重复计数）
type Session = {
  queue: string[]
  isNew: Set<string>
  seen: Set<string>
  learned: number
  reviewed: number
  startedAt: number
}

export const Review: React.FC = () => {
  const [words, setWords] = useState<Record<string, WordItem> | null>(null)
  const [settings, setSettings] = useState<VocabSettings | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [back, setBack] = useState(false)
  const [done, setDone] = useState<{ learned: number; reviewed: number; minutes: number } | null>(
    null,
  )
  const [error, setError] = useState('')
  // 上一次作答前的状态：撤销时原样放回（只留一步）
  const [last, setLast] = useState<{ word: string; prev: WordItem; session: Session } | null>(null)
  const [gone, setGone] = useState<Record<string, boolean>>({})
  const card = useRef<HTMLDivElement>(null)
  // 渲染时用的"现在"：打开页面、开始、每次作答时更新（渲染里不能直接取 Date.now()）
  const [now, setNow] = useState(() => Date.now())

  const read = useCallback(() => {
    const v = load()
    setWords(v.words)
    setSettings(v.vocab)
    if (!v.ok) setError('这个浏览器保存不了背单词进度。')
  }, [])

  useEffect(() => {
    read()
    void sync().then(read)
  }, [read])

  const word = session?.queue[0]
  const item = word && words ? words[word] : undefined

  const answer = useCallback(
    (g: number) => {
      if (!session || !word || !item) return
      const at = Date.now()
      const next = rate(item, GRADES[g], at)
      if (putWord(word, next) !== 'ok') setError('保存失败，这张卡的评分没记下。')
      const queue = session.queue.slice(1)
      if (requeue(next, at)) queue.push(word)
      const first = !session.seen.has(word)
      const s = {
        ...session,
        queue,
        seen: new Set(session.seen).add(word),
        learned: session.learned + (first && session.isNew.has(word) ? 1 : 0),
        reviewed: session.reviewed + (first && !session.isNew.has(word) ? 1 : 0),
      }
      setLast({ word, prev: item, session })
      setWords((w) => ({ ...w, [word]: next }))
      setNow(at)
      setBack(false)
      if (!queue.length) {
        setDone({
          learned: s.learned,
          reviewed: s.reviewed,
          minutes: Math.max(1, Math.round((at - s.startedAt) / 60_000)),
        })
        setSession(null)
      } else setSession(s)
    },
    [session, word, item],
  )

  const undo = useCallback(() => {
    if (!last) return
    // at 取现在：同步合并时以较新的为准，撤销才不会被服务器上的作答结果盖回去
    const prev = { ...last.prev, at: Date.now() }
    if (putWord(last.word, prev) !== 'ok') setError('保存失败，撤销没有生效。')
    setWords((w) => ({ ...w, [last.word]: prev }))
    setSession(last.session)
    setDone(null)
    setBack(false)
    setLast(null)
  }, [last])

  const finish = () => {
    if (!session) return
    setDone({
      learned: session.learned,
      reviewed: session.reviewed,
      minutes: Math.max(1, Math.round((Date.now() - session.startedAt) / 60_000)),
    })
    setSession(null)
    setLast(null)
  }

  // 换卡或翻面后焦点放到卡片上，键盘和读屏用户不会掉回页面顶部
  useEffect(() => {
    if (word) card.current?.focus({ preventScroll: true })
  }, [word, back])

  // 翻面后检查出处所在单元是否已下架（与单词本同一个接口）
  const unit = back && item?.src?.at(-1) ? unitIdOf(item.src.at(-1)!.href) : undefined
  useEffect(() => {
    if (!unit || unit in gone) return
    fetch(`/api/practice/lookup?ids=${encodeURIComponent(unit)}`)
      .then((r) => r.json())
      .then((d: { items?: Record<string, LookupItem> }) =>
        setGone((g) => ({ ...g, [unit]: !!d.items?.[unit]?.gone })),
      )
      .catch(() => {})
  }, [unit, gone])

  useEffect(() => {
    if (!session && !last) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element)?.closest('input, textarea, button')) return
      if (e.key === 'z' || e.key === 'Z') undo()
      else if (!back && e.key === ' ') {
        e.preventDefault()
        setBack(true)
      } else if (back && /^[1-4]$/.test(e.key)) answer(Number(e.key) - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [session, last, back, answer, undo])

  if (!words || !settings) return <p className="text-muted-foreground">加载中…</p>

  if (session && word && item) {
    const src = item.src?.at(-1)
    const total = session.queue.length
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-x-5 text-[13px] text-muted-foreground tabular-nums">
          <span>还剩 {total} 张</span>
          {last && (
            <button
              className="min-h-11 hover:text-foreground"
              data-testid="review-undo"
              onClick={undo}
              type="button"
            >
              撤销上一张 <span className={KEY_HINT}>Z</span>
            </button>
          )}
          <button
            className="ml-auto min-h-11 hover:text-foreground"
            data-testid="review-finish"
            onClick={finish}
            type="button"
          >
            结束
          </button>
        </div>
        <div
          aria-label={`单词卡：${word}`}
          className="flex flex-col gap-4 border border-border p-5 outline-none sm:p-8"
          ref={card}
          role="group"
          tabIndex={-1}
        >
          <div className="flex items-center gap-3">
            <span className="text-[30px] font-medium tracking-[-0.01em]" data-testid="review-word">
              {word}
            </span>
            {item.phonetic && <span className="text-muted-foreground">/{item.phonetic}/</span>}
            {'speechSynthesis' in window && (
              <button
                aria-label="发音"
                className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={() => speak(word)}
                type="button"
              >
                <Volume2 aria-hidden="true" className="size-5" strokeWidth={1.5} />
              </button>
            )}
          </div>
          {src && (
            <p className="text-[17px] leading-[1.7]" lang="en">
              {back ? (
                <Sentence text={src.text} word={word} />
              ) : (
                <Masked text={src.text} word={word} />
              )}
            </p>
          )}
          {back ? (
            <div className="flex flex-col gap-4" data-testid="review-back">
              <ul className="flex flex-col gap-1 text-[17px] leading-[1.6]">
                {(item.meaning ?? '')
                  .split('\n')
                  .filter(Boolean)
                  .map((m) => (
                    <li key={m}>{m}</li>
                  ))}
              </ul>
              {src && <SourceLink gone={!!unit && gone[unit]} s={src} />}
            </div>
          ) : (
            <Button
              className="self-start"
              data-testid="review-show"
              onClick={() => setBack(true)}
              type="button"
            >
              显示释义{' '}
              <span className={cn('ml-2 text-[13px] font-normal opacity-70', KEY_HINT)}>空格</span>
            </Button>
          )}
        </div>
        {back && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {preview(item, now).map((due, i) => (
              <button
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 border-[1.5px] px-3 py-2 text-[15px] font-semibold',
                  i === 2
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-foreground hover:bg-muted',
                )}
                data-testid={`review-rate-${i + 1}`}
                key={LABELS[i]}
                onClick={() => answer(i)}
                type="button"
              >
                <span>
                  {LABELS[i]}{' '}
                  <span className={cn('text-[12px] font-normal opacity-70', KEY_HINT)}>
                    {i + 1}
                  </span>
                </span>
                <span className="text-[12px] font-normal opacity-80">
                  {intervalLabel(due - now)}
                </span>
              </button>
            ))}
            <p className="col-span-full text-[13px] text-muted-foreground">
              越熟，下次出现得越晚；选「忘了」的词这一轮还会再出现。
            </p>
          </div>
        )}
        {error && <p className="text-[13px] text-error">{error}</p>}
      </div>
    )
  }

  const { due, fresh } = buildQueue(words, settings, now)
  const t = buildQueue(words, settings, now + 86_400_000)
  const tomorrow =
    t.due.length + t.fresh.length ? `新词 ${t.fresh.length} · 复习 ${t.due.length}` : '没有到期的词'
  const start = () => {
    setDone(null)
    setBack(false)
    const at = Date.now()
    setNow(at)
    setSession({
      queue: [...due, ...fresh],
      isNew: new Set(fresh),
      seen: new Set(),
      learned: 0,
      reviewed: 0,
      startedAt: at,
    })
  }
  const change = (s: Omit<VocabSettings, 'at'>) => {
    if (saveSettings(s) === 'ok') read()
    else setSettings({ ...s, at: Date.now() })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4">
        {done ? (
          <div className="flex flex-col items-start gap-2" data-testid="review-done">
            <h2 className="text-[24px] font-medium tracking-[-0.01em]">
              {due.length + fresh.length ? '这一轮先到这里' : '今天的词背完了'}
            </h2>
            <p className="text-[17px] tabular-nums">
              新学 {done.learned} 个，复习 {done.reviewed} 个，用时 {done.minutes} 分钟。
            </p>
            <p className="text-[15px] text-muted-foreground tabular-nums">
              {due.length + fresh.length
                ? `今天还剩：新词 ${fresh.length} · 复习 ${due.length}`
                : `明天：${tomorrow}`}
            </p>
            {last && (
              <button
                className="min-h-11 text-[13px] text-muted-foreground hover:text-foreground"
                onClick={undo}
                type="button"
              >
                撤销上一张 <span className={KEY_HINT}>Z</span>
              </button>
            )}
          </div>
        ) : (
          <p className="text-[20px] tabular-nums" data-testid="review-today">
            今天：新词 {fresh.length} · 复习 {due.length}
          </p>
        )}
        {due.length + fresh.length ? (
          <Button data-testid="review-start" onClick={start} type="button">
            {done ? '继续' : '开始'}
          </Button>
        ) : (
          <p className="text-[15px] text-muted-foreground">
            {!done && '今天没有要背的词。'}
            <Link
              className="ml-1 inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
              href="/me/words"
            >
              单词本
            </Link>
            {' · '}
            <Link
              className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
              href="/reading"
            >
              去做阅读
            </Link>
          </p>
        )}
        {error && <p className="text-[13px] text-error">{error}</p>}
      </div>
      <fieldset className="flex flex-col gap-4 border-t border-border pt-6">
        <legend className="sr-only">学习设置</legend>
        <label className="flex flex-wrap items-center gap-3 text-[15px]">
          每天新词
          <input
            className="h-11 w-24 border border-input bg-background px-3 tabular-nums"
            data-testid="review-new-per-day"
            defaultValue={settings.newPerDay}
            key={settings.at}
            max={100}
            min={0}
            onBlur={(e) =>
              change({
                ...settings,
                newPerDay: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))),
              })
            }
            type="number"
          />
          <span className="text-[13px] text-muted-foreground">0–100，只限新词</span>
        </label>
        <div
          className="flex flex-wrap items-center gap-3 text-[15px]"
          role="radiogroup"
          aria-label="发音"
        >
          发音
          {(
            [
              ['gb', '英音'],
              ['us', '美音'],
            ] as const
          ).map(([k, label]) => (
            <label className="inline-flex min-h-11 items-center gap-2" key={k}>
              <input
                checked={settings.accent === k}
                name="accent"
                onChange={() => change({ ...settings, accent: k })}
                type="radio"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
