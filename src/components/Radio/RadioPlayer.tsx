'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AudioPlayer, type AudioControls } from '@/components/Practice/AudioPlayer'
import { currentIndex, nextStart, prevStart, timedLines } from '@/components/Practice/sentences'
import type { RadioItem } from '@/endpoints/playlist'
import { cn } from '@/utilities/ui'

// 听力磨耳朵（022 contracts/ui.md、research R1–R5）：一个 audio 元素连播一个题集；
// Media Session 提供锁屏信息和控制（上一曲 / 下一曲 = 上一句 / 下一句）
const fetchPage = async (params: Record<string, string>): Promise<RadioItem[] | null> => {
  const res = await fetch(`/api/listening/playlist?${new URLSearchParams(params)}`).catch(() => null)
  if (!res?.ok) return null
  return ((await res.json()) as { items: RadioItem[] }).items
}

export const RadioPlayer: React.FC<{ start?: string }> = ({ start }) => {
  const player = useRef<AudioControls>(null)
  const [items, setItems] = useState<RadioItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [time, setTime] = useState(0)
  const [showText, setShowText] = useState(false)
  const exhausted = useRef(false)
  const autoplay = useRef(false)

  useEffect(() => {
    void fetchPage(start ? { start } : {}).then((list) => {
      if (!list?.length) setFailed(true)
      else setItems(list)
    })
  }, [start])

  // 快播完这一批时取下一批；取回空表示题集到头
  useEffect(() => {
    if (!items || exhausted.current || items.length - index > 3) return
    const last = items[items.length - 1].id
    let alive = true
    void fetchPage({ after: last }).then((more) => {
      if (!alive || !more) return
      if (!more.length) exhausted.current = true
      else setItems((cur) => (cur && cur[cur.length - 1].id === last ? [...cur, ...more] : cur))
    })
    return () => {
      alive = false
    }
  }, [items, index])

  const cur = items?.[index]
  const lines = useMemo(() => (cur?.lines ? timedLines(cur.lines) : []), [cur])

  const go = useCallback(
    (i: number) => {
      if (!items || i < 0 || i >= items.length) return
      autoplay.current = true
      setDone(false)
      setTime(0)
      setIndex(i)
    },
    [items],
  )

  // 换 Part 后接着播（src 改了以后 play() 会等音频可以播放）
  useEffect(() => {
    if (!autoplay.current) return
    autoplay.current = false
    player.current?.play()
  }, [index])

  const prevLine = useCallback(() => {
    const t = player.current?.currentTime() ?? 0
    player.current?.seek(lines.length ? prevStart(lines, t) : t - 5)
  }, [lines])
  const nextLine = useCallback(() => {
    const t = player.current?.currentTime() ?? 0
    if (!lines.length) return player.current?.skip(5)
    const to = nextStart(lines, t)
    if (to !== null) player.current?.seek(to)
  }, [lines])

  // 快捷键与练习页一致：空格播放 / 暂停，← → 上一句 / 下一句（音频条上的按键提示依赖它）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || t.closest('input, textarea, select, button, a, [contenteditable="true"]')) return
      if (e.key === ' ') player.current?.toggle()
      else if (e.key === 'ArrowLeft') prevLine()
      else if (e.key === 'ArrowRight') nextLine()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevLine, nextLine])

  const onEnded = () => {
    if (items && index < items.length - 1) go(index + 1)
    else if (exhausted.current) setDone(true)
  }

  // Media Session：锁屏信息与控制
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (!ms || !cur) return
    ms.metadata = new MediaMetadata({
      title: cur.title,
      artist: `我不是考神 · 听力 Part ${cur.part}`,
      album: cur.tag,
      artwork: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    })
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => player.current?.play()],
      ['pause', () => player.current?.pause()],
      ['previoustrack', prevLine],
      ['nexttrack', nextLine],
      ['seekbackward', (d) => player.current?.skip(-(d.seekOffset ?? 5))],
      ['seekforward', (d) => player.current?.skip(d.seekOffset ?? 5)],
      ['seekto', (d) => d.seekTime !== undefined && player.current?.seek(d.seekTime)],
    ]
    for (const [a, h] of handlers) {
      try {
        ms.setActionHandler(a, h)
      } catch {
        // 有的浏览器不支持某个动作
      }
    }
    return () => {
      for (const [a] of handlers) {
        try {
          ms.setActionHandler(a, null)
        } catch {
          // 同上
        }
      }
    }
  }, [cur, prevLine, nextLine])

  const onTime = (t: number) => {
    setTime(t)
    const a = player.current?.element()
    if (a && Number.isFinite(a.duration) && navigator.mediaSession?.setPositionState)
      navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(t, a.duration), playbackRate: a.playbackRate })
  }

  if (failed) return <p className="text-[15px] text-muted-foreground">没找到可以连播的听力。</p>
  if (!items || !cur) return <p className="text-muted-foreground">加载中…</p>

  const li = lines.length ? currentIndex(lines, time) : -1
  const textLines = cur.lines ?? []
  const at = li >= 0 ? textLines.findIndex((l) => l.n === lines[li].n) : -1
  const btn = 'inline-flex min-h-11 items-center gap-1 border-[1.5px] border-foreground px-4 text-sm font-semibold hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1" data-testid="radio-now">
        <span className="text-[13px] text-muted-foreground">正在播放 · Part {cur.part}{cur.tag ? ` · ${cur.tag}` : ''}</span>
        <h2 className="text-[24px] font-medium break-words">{cur.title}</h2>
      </div>

      <div className="-mx-4 sm:-mx-6">
        <AudioPlayer
          nav={{
            onPrev: prevLine,
            onNext: nextLine,
            prevLabel: lines.length ? '上一句' : '后退 5 秒',
            nextLabel: lines.length ? '下一句' : '前进 5 秒',
            prevTitle: lines.length ? '上一句' : '后退 5 秒',
            nextTitle: lines.length ? '下一句' : '前进 5 秒',
          }}
          onEnded={onEnded}
          onTime={onTime}
          ref={player}
          src={cur.audioUrl}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className={btn} data-testid="radio-prev" disabled={index === 0} onClick={() => go(index - 1)} type="button">
          <ChevronLeft aria-hidden="true" className="size-4" />
          上一个 Part
        </button>
        <button className={btn} data-testid="radio-next" disabled={index >= items.length - 1} onClick={() => go(index + 1)} type="button">
          下一个 Part
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
        {textLines.length > 0 && (
          <button
            aria-pressed={showText}
            className="ml-auto inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            data-testid="radio-transcript-toggle"
            onClick={() => setShowText((v) => !v)}
            type="button"
          >
            {showText ? '隐藏原文' : '显示原文'}
          </button>
        )}
      </div>

      {showText && textLines.length > 0 && (
        <div aria-live="polite" className="flex flex-col gap-2 bg-muted px-5 py-4 text-[15px] leading-7" data-testid="radio-transcript">
          {(at < 0 ? textLines.slice(0, 2) : textLines.slice(Math.max(0, at - 1), at + 2)).map((l) => (
            <p className={cn(l.n === textLines[at]?.n ? 'font-semibold text-foreground' : 'text-muted-foreground')} key={l.n}>
              {l.speaker ? `${l.speaker}: ` : ''}
              {l.text}
            </p>
          ))}
        </div>
      )}

      {done && (
        <p className="flex flex-wrap items-center gap-3 bg-muted px-5 py-4 text-[15px]" role="status">
          这个题集播完了。
          <button className="min-h-11 font-semibold underline underline-offset-4" onClick={() => go(0)} type="button">
            从头再播
          </button>
        </p>
      )}

      {index < items.length - 1 && (
        <section className="flex flex-col gap-2" data-testid="radio-queue">
          <h3 className="text-[15px] font-medium text-muted-foreground">接下来</h3>
          <ol className="border-t border-border">
            {items.slice(index + 1, index + 6).map((it, k) => (
              <li className="border-b border-border" key={it.id}>
                <button className="flex min-h-11 w-full items-center gap-3 py-2 text-left hover:bg-muted" onClick={() => go(index + 1 + k)} type="button">
                  <span className="min-w-0 flex-1 break-words">{it.title}</span>
                  <span className="text-[13px] text-muted-foreground">Part {it.part}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
