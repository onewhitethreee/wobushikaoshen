'use client'

import { Pause, Play, Repeat1, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'

import { cn } from '@/utilities/ui'

// 练习模式的音频条（research R4）：原生 audio + 自绘控件。
// 对外接口给 004（逐句字幕、方向键）复用：ref 拿到 AudioControls 做播放控制和跳转，onTime 拿当前时间。
export type AudioControls = {
  play: () => void
  pause: () => void
  toggle: () => void
  /** 跳到第 t 秒（会夹在 0 与时长之间） */
  seek: (t: number) => void
  /** 相对当前位置前进 / 后退 delta 秒 */
  skip: (delta: number) => void
  currentTime: () => number
  element: () => HTMLAudioElement | null
}

const RATES = [0.75, 1, 1.25, 1.5]

/** 按句导航（004）：上一句 / 下一句与单句循环；没有逐句时间时调用方传 ±5 秒和对应文字 */
export type AudioNav = {
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
  prevTitle: string
  nextTitle: string
  loop?: { on: boolean; toggle: () => void }
}

/** 按键标注（004 快捷键展示第一层）：只在有精确指针（鼠标 / 触控板）的设备上显示，读屏跳过 */
export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    aria-hidden="true"
    className="hidden min-w-5 items-center justify-center border border-border bg-muted px-1 font-sans text-xs leading-4 font-semibold text-muted-foreground pointer-fine:inline-flex"
  >
    {children}
  </kbd>
)

const mmss = (t: number) => {
  const s = Number.isFinite(t) ? Math.floor(t) : 0
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export const AudioPlayer: React.FC<{
  src: string
  ref?: React.Ref<AudioControls>
  onTime?: (t: number) => void
  onPlayingChange?: (playing: boolean) => void
  nav?: AudioNav
  /** 控件行右侧的附加内容（004 的"快捷键"按钮放这里） */
  children?: React.ReactNode
}> = ({ src, ref, onTime, onPlayingChange, nav, children }) => {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [error, setError] = useState(false)

  const seek = (t: number) => {
    const a = audio.current
    if (!a) return
    a.currentTime = Math.min(Math.max(t, 0), Number.isFinite(a.duration) ? a.duration : t)
    setTime(a.currentTime)
  }
  const controls: AudioControls = {
    play: () => void audio.current?.play().catch(() => undefined),
    pause: () => audio.current?.pause(),
    toggle: () => (audio.current?.paused ? controls.play() : controls.pause()),
    seek,
    skip: (d) => seek((audio.current?.currentTime ?? 0) + d),
    currentTime: () => audio.current?.currentTime ?? 0,
    element: () => audio.current,
  }
  useImperativeHandle(ref, () => controls)

  // 服务端渲染的 audio 在 hydration 前可能已读完元数据或已出错，事件错过了，挂载时补读一次
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (a.error) setError(true)
    else if (a.readyState >= 1) setDuration(a.duration)
  }, [])

  const btn = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 text-sm'
  const ghost = 'rounded-lg px-2 text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <div className="sticky top-2 z-10 mx-auto mt-4 max-w-[760px] px-4 sm:px-6" data-testid="audio-player">
      <audio
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEmptied={() => {
          setPlaying(false)
          onPlayingChange?.(false)
          setTime(0)
          setDuration(0)
          setError(false)
        }}
        onError={() => setError(true)}
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = rate
          setError(false)
        }}
        onPause={() => {
          setPlaying(false)
          onPlayingChange?.(false)
        }}
        onPlay={() => {
          setPlaying(true)
          onPlayingChange?.(true)
        }}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime)
          onTime?.(e.currentTarget.currentTime)
        }}
        preload="metadata"
        ref={audio}
        src={src}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-y border-border bg-background px-1 py-2">
        {error ? (
          <p className="flex min-h-11 flex-1 items-center gap-3 text-sm" role="alert">
            音频加载失败。
            <button
              className="min-h-11 rounded-lg border border-input px-4 font-semibold hover:border-primary hover:text-primary-text"
              onClick={() => {
                setError(false)
                audio.current?.load()
              }}
              type="button"
            >
              重试
            </button>
          </p>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <button
                aria-label={playing ? '暂停' : '播放'}
                className={cn(btn, 'bg-primary text-primary-foreground hover:bg-primary/88')}
                onClick={controls.toggle}
                title={playing ? '暂停（空格）' : '播放（空格）'}
                type="button"
              >
                {playing ? (
                  <Pause aria-hidden="true" className="size-5 fill-current" strokeWidth={1.5} />
                ) : (
                  <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" strokeWidth={1.5} />
                )}
              </button>
              {nav && <Kbd>空格</Kbd>}
            </span>
            {nav ? (
              <>
                <button aria-label={nav.prevLabel} className={cn(btn, ghost)} onClick={nav.onPrev} title={nav.prevTitle} type="button">
                  <SkipBack aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">{nav.prevLabel}</span>
                  <Kbd>←</Kbd>
                </button>
                <button aria-label={nav.nextLabel} className={cn(btn, ghost)} onClick={nav.onNext} title={nav.nextTitle} type="button">
                  <SkipForward aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">{nav.nextLabel}</span>
                  <Kbd>→</Kbd>
                </button>
                {nav.loop && (
                  <button
                    aria-label="单句循环"
                    aria-pressed={nav.loop.on}
                    className={cn(btn, ghost, nav.loop.on && 'bg-primary-soft text-primary-text hover:bg-primary-soft')}
                    onClick={nav.loop.toggle}
                    title="单句循环（R）"
                    type="button"
                  >
                    <Repeat1 aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">单句循环</span>
                    <Kbd>R</Kbd>
                  </button>
                )}
              </>
            ) : (
              <button aria-label="后退 5 秒" className={cn(btn, ghost)} onClick={() => controls.skip(-5)} type="button">
                <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.5} />5 秒
              </button>
            )}
            <input
              aria-label="播放进度"
              aria-valuetext={`${mmss(time)} / ${mmss(duration)}`}
              className="h-11 min-w-24 flex-1 [accent-color:var(--primary)]"
              max={duration || 0}
              min={0}
              onChange={(e) => seek(Number(e.target.value))}
              step={0.1}
              type="range"
              value={Math.min(time, duration || 0)}
            />
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {duration ? `${mmss(time)} / ${mmss(duration)}` : '音频加载中…'}
            </span>
          </>
        )}
        <div aria-label="倍速" className="flex gap-x-3" role="group">
          {RATES.map((r) => (
            <button
              aria-pressed={rate === r}
              className={cn(
                'min-h-11 min-w-9 text-[13px] tabular-nums',
                rate === r ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground hover:text-foreground',
              )}
              key={r}
              onClick={() => {
                setRate(r)
                if (audio.current) audio.current.playbackRate = r
              }}
              type="button"
            >
              {r}×
            </button>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}
