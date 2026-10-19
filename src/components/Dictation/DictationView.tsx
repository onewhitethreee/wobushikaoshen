'use client'

import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { checkWord, compare, pickBlanks, type Comparison } from '@/practice/dictation'
import { load, recordDictation, save } from '@/practice/store'
import { schedulePush, STORE_EVENT, sync } from '@/practice/syncClient'
import { cn } from '@/utilities/ui'

// 精听 / 听写（023 contracts/ui.md）：逐句播放 → 输入 → 宽松比对；挖空模式只填关键词。有错的句子进错题本"听写"
export type DictationData = {
  unitId: string
  title: string
  audioUrl: string
  lines: { n: number; text: string; start: number; end: number }[]
  answers: Record<number, string[]>
}
type Mode = 'full' | 'blank'
type BlankResult = { ok: boolean; marks: Record<number, boolean> }

const btn = 'inline-flex min-h-11 items-center gap-1.5 border-[1.5px] border-foreground px-4 text-sm font-semibold hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-40'
const tab = (on: boolean) =>
  cn('min-h-11 text-[15px]', on ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground hover:text-foreground')

/** 交过卷：本机记录里有这个单元或它的题组 */
const submitted = (unitId: string) => load().store.records.some((r) => r.unitId === unitId || r.unitId.startsWith(`${unitId}-g`))

export const DictationView: React.FC<{ data: DictationData; start?: number; initialMode?: Mode }> = ({ data, start, initialMode = 'full' }) => {
  const { lines } = data
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [i, setI] = useState(() => Math.max(0, lines.findIndex((l) => l.n === start)))
  const [mode, setMode] = useState<Mode>(initialMode)
  const [rate, setRate] = useState(1)
  const [full, setFull] = useState<Record<number, string>>({})
  const [fullRes, setFullRes] = useState<Record<number, Comparison>>({})
  const [blank, setBlank] = useState<Record<number, Record<number, string>>>({})
  const [blankRes, setBlankRes] = useState<Record<number, BlankResult>>({})
  const audio = useRef<HTMLAudioElement>(null)
  const stopAt = useRef<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setAllowed(submitted(data.unitId))
    check()
    window.addEventListener(STORE_EVENT, check)
    void sync()
    return () => window.removeEventListener(STORE_EVENT, check)
  }, [data.unitId])

  const line = lines[i]
  const words = useMemo(() => line.text.split(/\s+/).filter(Boolean), [line])
  const blanks = useMemo(() => pickBlanks(line.text, data.answers[line.n] ?? []), [line, data.answers])

  // 只播这一句：到句尾停（timeupdate 大约 250 ms 一次，播放期间再用 rAF 检查，误差压到 0.1 秒内）
  const play = () => {
    const a = audio.current
    if (!a) return
    a.playbackRate = rate
    a.currentTime = line.start
    stopAt.current = line.end
    void a.play().catch(() => undefined)
    const tick = () => {
      if (stopAt.current === null || a.paused) return
      if (a.currentTime >= stopAt.current - 0.05) {
        a.pause()
        stopAt.current = null
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const keep = (ok: boolean, typed: string) => {
    const { store } = load()
    recordDictation(store, { at: Date.now(), unitId: data.unitId, n: line.n, text: line.text, input: typed, mode }, ok)
    if (save(store)) schedulePush()
  }

  const check = () => {
    if (mode === 'full') {
      const typed = full[i] ?? ''
      const r = compare(line.text, typed)
      setFullRes((m) => ({ ...m, [i]: r }))
      keep(r.ok, typed)
    } else {
      if (!blanks.length) return
      const mine = blank[i] ?? {}
      const marks = Object.fromEntries(blanks.map((w) => [w, checkWord(words[w], mine[w] ?? '')]))
      const ok = Object.values(marks).every(Boolean)
      setBlankRes((m) => ({ ...m, [i]: { ok, marks } }))
      keep(ok, blanks.map((w) => mine[w] ?? '').join(' / '))
    }
  }

  const go = (to: number) => {
    if (to < 0 || to >= lines.length) return
    audio.current?.pause()
    stopAt.current = null
    setI(to)
    requestAnimationFrame(() => input.current?.focus())
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      check()
    } else if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault()
      play()
    }
  }

  if (allowed === null) return <p className="text-muted-foreground">加载中…</p>
  if (!allowed)
    return (
      <p className="flex flex-wrap items-center gap-x-3 bg-muted px-5 py-4 text-[15px]" data-testid="dict-gate">
        先做完这一组并交卷，再来精听。
        <Link className="inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 hover:underline" href={`/practice/${data.unitId}`}>
          去做题 <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </p>
    )

  const results = mode === 'full' ? fullRes : blankRes
  const checked = Object.values(results)
  const fr = fullRes[i]
  const br = blankRes[i]

  return (
    <div className="flex flex-col gap-6">
      <audio preload="auto" ref={audio} src={data.audioUrl} />
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-medium break-words">{data.title}</h2>
        <p className="text-[13px] text-muted-foreground" data-testid="dict-progress">
          第 {i + 1} / {lines.length} 句
          {checked.length > 0 && ` · 已检查 ${checked.length} 句，全对 ${checked.filter((r) => r.ok).length} 句`}
        </p>
      </div>

      <div aria-label="听写方式" className="flex gap-x-7 border-b border-border" role="group">
        <button aria-pressed={mode === 'full'} className={tab(mode === 'full')} data-testid="dict-mode-full" onClick={() => setMode('full')} type="button">
          整句
        </button>
        <button aria-pressed={mode === 'blank'} className={tab(mode === 'blank')} data-testid="dict-mode-blank" onClick={() => setMode('blank')} type="button">
          挖空
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className={cn(btn, 'bg-primary text-primary-foreground hover:bg-primary/88')} data-testid="dict-play" onClick={play} title="播放这句（Ctrl+空格）" type="button">
          <Play aria-hidden="true" className="size-4 fill-current" />
          播放这句
        </button>
        <div aria-label="倍速" className="flex gap-x-3" role="group">
          {[0.75, 1].map((r) => (
            <button aria-pressed={rate === r} className={cn(tab(rate === r), 'min-w-9 text-[13px] tabular-nums')} key={r} onClick={() => setRate(r)} type="button">
              {r}×
            </button>
          ))}
        </div>
      </div>

      {mode === 'full' ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              aria-label="输入你听到的这句"
              autoCapitalize="off"
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 border border-input bg-background px-3 text-[16px]"
              data-testid="dict-input"
              onChange={(e) => setFull((m) => ({ ...m, [i]: e.target.value }))}
              onKeyDown={onKey}
              placeholder="输入你听到的这句，回车检查"
              ref={input}
              spellCheck={false}
              value={full[i] ?? ''}
            />
            <button className={btn} data-testid="dict-check" onClick={check} type="button">
              检查
            </button>
          </div>
          {fr && (
            <div className="flex flex-col gap-2 bg-muted px-5 py-4" data-testid="dict-result">
              <p className="text-[16px] leading-8">
                {fr.words.map((w, k) => (
                  <React.Fragment key={k}>
                    {k > 0 && ' '}
                    <span
                      aria-label={w.status === 'wrong' ? `写成了 ${w.typed}，应为 ${w.text}` : w.status === 'missing' ? `缺 ${w.text}` : undefined}
                      data-status={w.status}
                      data-testid="dict-word"
                    >
                      {w.status === 'ok' && w.text}
                      {w.status === 'wrong' && (
                        <>
                          <del className="text-error">{w.typed}</del> → <b className="font-semibold">{w.text}</b>
                        </>
                      )}
                      {w.status === 'missing' && (
                        <span className="text-warning">
                          <b className="font-semibold">{w.text}</b>
                          <sup className="ml-0.5 text-[11px]">缺</sup>
                        </span>
                      )}
                    </span>
                  </React.Fragment>
                ))}
              </p>
              {fr.extra.length > 0 && (
                <p className="text-[14px] text-muted-foreground" data-testid="dict-extra">
                  多写：{fr.extra.map((x, k) => <del className="mr-2 text-error" key={k}>{x}</del>)}
                </p>
              )}
              <ResultMark ok={fr.ok} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {blanks.length === 0 ? (
            <p className="bg-muted px-5 py-4 text-[16px] leading-8">
              {line.text}
              <span className="ml-2 text-[13px] text-muted-foreground">（这句不挖空）</span>
            </p>
          ) : (
            <p className="text-[16px] leading-[2.6]">
              {words.map((w, k) => {
                if (!blanks.includes(k)) return <React.Fragment key={k}>{k > 0 && ' '}{w}</React.Fragment>
                const mark = br?.marks[k]
                return (
                  <React.Fragment key={k}>
                    {k > 0 && ' '}
                    <input
                      aria-label={`第 ${blanks.indexOf(k) + 1} 个空`}
                      autoCapitalize="off"
                      autoComplete="off"
                      className={cn(
                        'mx-0.5 h-9 w-[7.5em] border-b-2 bg-transparent px-1 text-center text-[16px] outline-none focus:bg-primary-soft',
                        mark === undefined ? 'border-foreground' : mark ? 'border-success' : 'border-error',
                      )}
                      data-testid="dict-blank"
                      onChange={(e) => setBlank((m) => ({ ...m, [i]: { ...m[i], [k]: e.target.value } }))}
                      onKeyDown={onKey}
                      ref={k === blanks[0] ? input : undefined}
                      spellCheck={false}
                      value={blank[i]?.[k] ?? ''}
                    />
                    {mark === false && <span className="text-[13px] text-error">（{w}）</span>}
                  </React.Fragment>
                )
              })}
            </p>
          )}
          {blanks.length > 0 && (
            <div className="flex items-center gap-3">
              <button className={btn} data-testid="dict-check" onClick={check} type="button">
                检查
              </button>
              {br && <ResultMark ok={br.ok} />}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <button className={btn} data-testid="dict-prev" disabled={i === 0} onClick={() => go(i - 1)} type="button">
          <ChevronLeft aria-hidden="true" className="size-4" />
          上一句
        </button>
        <button className={btn} data-testid="dict-next" disabled={i >= lines.length - 1} onClick={() => go(i + 1)} type="button">
          下一句
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p className="text-[13px] text-muted-foreground">
        比对时忽略大小写和标点；数字和英文数字（15 / fifteen）、常见缩写（don&apos;t / do not）、英美拼写（colour / color）都算对。序数词、年份读法不算。
      </p>
    </div>
  )
}

const ResultMark: React.FC<{ ok: boolean }> = ({ ok }) =>
  ok ? (
    <p className="inline-flex items-center gap-1.5 font-semibold text-success" data-testid="dict-ok">
      <Check aria-hidden="true" className="size-4" />
      全对
    </p>
  ) : (
    <p className="inline-flex items-center gap-1.5 font-semibold text-error">
      <X aria-hidden="true" className="size-4" />
      有不对的地方，已记进错题本
    </p>
  )
