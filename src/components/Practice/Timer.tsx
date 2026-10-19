'use client'

import { Check, Timer as TimerIcon } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { fmt, loadMode, saveMode, tick, type Clock, type TimerMode } from '@/practice/timer'
import { cn } from '@/utilities/ui'

// 底栏计时（020 contracts/ui.md）：按真实时间差累加到 clock（research R1），页面在后台、暂停、交卷后不计（R2）
const MODES: [TimerMode, string][] = [
  ['up', '正计时'],
  ['down', '倒计时'],
  ['hidden', '隐藏'],
]

export const Timer: React.FC<{ clock: React.RefObject<Clock>; limit: number; running: boolean; onMode?: (m: TimerMode) => void }> = ({
  clock,
  limit,
  running,
  onMode,
}) => {
  const [mode, setMode] = useState<TimerMode>('up')
  // 显示用的快照：每秒从 clock 抄一次，渲染时不读 ref
  const [snap, setSnap] = useState({ elapsed: 0, paused: false })
  const paused = useRef(false)
  const [notice, setNotice] = useState('')
  const warned = useRef(false)
  const menu = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const m = loadMode()
    setMode(m)
    onMode?.(m)
  }, [onMode])

  useEffect(() => {
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const c = clock.current
      if (running && !paused.current && document.visibilityState !== 'hidden') tick(c, (now - last) / 1000)
      last = now
      setSnap({ elapsed: c.elapsed, paused: paused.current })
    }, 1000)
    // 回到前台时从这一刻重新算，后台那段不计
    const onVis = () => {
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [clock, running])

  const over = snap.elapsed - limit
  // 倒计时第一次越过 0：提示一次，5 秒后收起；重新开始（elapsed 归零）后可以再提示
  useEffect(() => {
    if (over < 0) warned.current = false
    if (mode !== 'down' || over < 0 || warned.current) return
    warned.current = true
    setNotice('时间到了，可以继续做完再交卷')
    const t = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(t)
  }, [mode, over])

  const pick = (m: TimerMode) => {
    setMode(m)
    saveMode(m)
    onMode?.(m)
    if (menu.current) menu.current.open = false
  }
  const togglePause = () => {
    paused.current = !paused.current
    setSnap((s) => ({ ...s, paused: paused.current }))
    if (menu.current) menu.current.open = false
  }

  const value =
    mode === 'down' ? (over >= 0 ? `超时 +${fmt(over)}` : fmt(limit - snap.elapsed)) : fmt(snap.elapsed)

  return (
    <div className="relative shrink-0">
      <p className="sr-only" role="status">
        {notice}
      </p>
      {notice && (
        <p aria-hidden="true" className="absolute right-0 bottom-full mb-2 w-max max-w-[16rem] bg-warning-soft px-3 py-2 text-[13px] text-warning">
          {notice}
        </p>
      )}
      <details
        className="relative"
        onKeyDown={(e) => {
          if (e.key !== 'Escape' || !menu.current?.open) return
          e.preventDefault()
          menu.current.open = false
          menu.current.querySelector('summary')?.focus()
        }}
        ref={menu}
      >
        <summary
          aria-label={mode === 'hidden' ? '计时（已隐藏）' : `计时 ${value}${snap.paused ? '，已暂停' : ''}`}
          className={cn(
            'inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-1.5 px-2 text-[14px] tabular-nums [&::-webkit-details-marker]:hidden',
            mode === 'down' && over >= 0 ? 'text-warning' : 'text-muted-foreground hover:text-foreground',
          )}
          data-testid="timer"
        >
          <TimerIcon aria-hidden="true" className="size-4" />
          {mode !== 'hidden' && <span data-testid="timer-value">{snap.paused ? '已暂停' : value}</span>}
        </summary>
        <ul className="absolute right-0 bottom-full z-30 mb-1 min-w-44 border border-border bg-background py-1 text-sm whitespace-nowrap">
          {MODES.map(([m, label]) => (
            <li key={m}>
              <button className="flex min-h-11 w-full items-center gap-2 px-4 text-left hover:bg-muted" onClick={() => pick(m)} type="button">
                <Check aria-hidden="true" className={cn('size-4', m === mode ? 'opacity-100' : 'opacity-0')} />
                {label}
                {m === 'down' && <span className="ml-auto pl-3 text-muted-foreground tabular-nums">{fmt(limit)}</span>}
              </button>
            </li>
          ))}
          <li className="border-t border-border">
            <button className="flex min-h-11 w-full items-center gap-2 px-4 text-left hover:bg-muted" onClick={togglePause} type="button">
              <span aria-hidden="true" className="size-4" />
              {snap.paused ? '继续' : '暂停'}
            </button>
          </li>
        </ul>
      </details>
    </div>
  )
}
