'use client'

import { Volume2 } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { audioPosition } from '@/practice/mockAttempt'
import { fmt } from '@/practice/timer'

// 028 听力考试播放器（research R4）：4 个 Part 连着放，只放一次；没有暂停、拖动、倍速，只能调音量。
// 播放位置始终按真实时间算（开始时间 + 已过秒数），刷新、卡顿、断网回来都跳到"应在的位置"
export const ExamAudio: React.FC<{ srcs: string[]; startedAt: number; durations: number[]; autoStart: boolean }> = ({
  srcs,
  startedAt,
  durations,
  autoStart,
}) => {
  const audio = useRef<HTMLAudioElement>(null)
  const [blocked, setBlocked] = useState(!autoStart)
  const [error, setError] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [volume, setVolume] = useState(1)
  const total = durations.reduce((s, d) => s + d, 0)
  const pos = audioPosition(durations, startedAt, now)

  // 对齐到应在的位置并播放；浏览器拦截自动播放时显示"继续听力"
  const align = useCallback(() => {
    const a = audio.current
    if (!a) return
    const p = audioPosition(durations, startedAt)
    if (p === 'ended') {
      a.pause()
      return
    }
    const src = srcs[p.part] ?? ''
    const go = () => {
      const q = audioPosition(durations, startedAt)
      if (q === 'ended') return a.pause()
      if (Math.abs(a.currentTime - q.offset) > 2) a.currentTime = q.offset
      a.play().then(
        () => setBlocked(false),
        (e: Error) => e.name === 'NotAllowedError' && setBlocked(true),
      )
    }
    if (a.getAttribute('src') !== src) {
      a.src = src
      a.addEventListener('loadedmetadata', go, { once: true })
      a.load()
    } else go()
  }, [srcs, startedAt, durations])

  useEffect(() => {
    if (autoStart) align()
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [autoStart, align])

  // 按真实时间已经过了这个 Part（音频卡住了），直接接下一个
  const part = pos === 'ended' ? -1 : pos.part
  useEffect(() => {
    if (blocked || error || part < 0) return
    const a = audio.current
    if (a && a.getAttribute('src') !== (srcs[part] ?? '')) align()
  }, [part, blocked, error, srcs, align])

  useEffect(() => {
    if (audio.current) audio.current.volume = volume
  }, [volume])

  const played = Math.min(total, Math.max(0, (now - startedAt) / 1000))

  return (
    <div className="container flex flex-wrap items-center gap-x-5 gap-y-2 py-3" data-testid="exam-audio-bar">
      <audio
        data-testid="exam-audio"
        onEnded={align}
        onError={() => setError(true)}
        onPlaying={() => {
          // 卡顿恢复后：偏离应在位置超过 2 秒就跳过去（时间照走）
          const q = audioPosition(durations, startedAt)
          if (audio.current && q !== 'ended' && Math.abs(audio.current.currentTime - q.offset) > 2) audio.current.currentTime = q.offset
        }}
        preload="auto"
        ref={audio}
      />
      <p className="text-[15px] font-semibold" role="status">
        {pos === 'ended' ? '音频已结束' : `正在播放 Part ${pos.part + 1}`}
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">
        {fmt(played)} / {fmt(total)}
      </p>
      <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <Volume2 aria-hidden="true" className="size-4" />
        <input
          aria-label="音量"
          className="w-28 accent-primary"
          max={1}
          min={0}
          onChange={(e) => setVolume(Number(e.target.value))}
          step={0.05}
          type="range"
          value={volume}
        />
      </label>
      {pos !== 'ended' && blocked && !error && (
        <Button onClick={align} type="button">
          继续听力
        </Button>
      )}
      {error && (
        <p className="flex items-center gap-3 text-sm text-error" role="alert">
          音频加载失败
          <Button
            onClick={() => {
              setError(false)
              audio.current?.removeAttribute('src')
              align()
            }}
            type="button"
            variant="outline"
          >
            重试
          </Button>
        </p>
      )}
    </div>
  )
}
