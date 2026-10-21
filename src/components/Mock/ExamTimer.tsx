'use client'

import { Timer as TimerIcon } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { fmt, tick, type Clock } from '@/practice/timer'
import { cn } from '@/utilities/ui'

// 028 考试倒计时（contracts「exam 模式」）：按截止时间显示剩余，最后 5 分钟、1 分钟各提示一次，到 0 只回调一次。
// 同时按真实时间差给当前题记用时（020 的 clock），页面在后台时不记
export const ExamTimer: React.FC<{ deadline: number; clock: React.RefObject<Clock>; onExpire: () => void }> = ({ deadline, clock, onExpire }) => {
  const left = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  const [sec, setSec] = useState(left)
  const [notice, setNotice] = useState('')
  const fired = useRef(false)
  const warned = useRef<Set<number>>(new Set())
  const expire = useRef(onExpire)
  useEffect(() => {
    expire.current = onExpire
  }, [onExpire])

  useEffect(() => {
    let last = performance.now()
    const step = () => {
      const now = performance.now()
      if (document.visibilityState !== 'hidden') tick(clock.current, (now - last) / 1000)
      last = now
      const s = left()
      setSec(s)
      for (const w of [300, 60])
        if (s <= w && s > 0 && !warned.current.has(w)) {
          warned.current.add(w)
          setNotice(w === 300 ? '还剩 5 分钟' : '还剩 1 分钟')
          setTimeout(() => setNotice(''), 5000)
        }
      if (s === 0 && !fired.current) {
        fired.current = true
        expire.current()
      }
    }
    step()
    const id = setInterval(step, 1000)
    const onVis = () => {
      last = performance.now()
      step()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- left 只依赖 deadline
  }, [deadline, clock])

  return (
    <div className="flex shrink-0 items-center gap-2">
      <p className="text-[13px] font-semibold whitespace-nowrap text-warning" role="status">
        {notice}
      </p>
      <p
        aria-label={`剩余时间 ${fmt(sec)}`}
        className={cn('inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-semibold tabular-nums', sec <= 300 ? 'text-warning' : 'text-foreground')}
        data-testid="exam-timer"
      >
        <TimerIcon aria-hidden="true" className="size-4" />
        {fmt(sec)}
      </p>
    </div>
  )
}
