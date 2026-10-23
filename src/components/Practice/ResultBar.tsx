import { RotateCcw, Share2, Shuffle } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'
import { fmt } from '@/practice/timer'
import { cn } from '@/utilities/ui'

// 交卷后页顶的成绩卡：得分环 + 答对 a / b；整套额外给 band（FR-041 ~ FR-043）
const R = 30
const C = 2 * Math.PI * R

type Time = { duration: number; limit?: number; slow: { anchor: number; span: number; sec: number }[] }

export const ResultBar: React.FC<{
  score: number
  total: number
  band?: number | null
  listHref: string
  onRetry: () => void
  /** 020：本次用时；旧记录、没有计时时不传 */
  time?: Time | null
  onPick?: (anchor: number) => void
  /** 025：打开分享成绩对话框 */
  onShare?: () => void
  /** 030：从"随机一题"进来时，按原范围再抽一题 */
  pickAgainHref?: string
}> = ({ score, total, band, listHref, onRetry, time, onPick, onShare, pickAgainHref }) => {
  const ratio = total ? score / total : 0
  const good = ratio >= 0.8
  return (
    <section
      aria-live="polite"
      className="flex animate-rise flex-wrap items-center gap-x-6 gap-y-4 bg-muted px-5 py-5 sm:px-6"
      data-testid="result-bar"
    >
      <div className="flex items-center gap-4">
        <svg aria-hidden="true" className="size-16 shrink-0 -rotate-90 sm:size-[72px]" viewBox="0 0 72 72">
          <circle cx="36" cy="36" fill="none" r={R} stroke="var(--muted)" strokeWidth="8" />
          <circle
            className="[transition:stroke-dashoffset_1s_var(--ease-out-expo)] starting:[stroke-dashoffset:var(--c)]"
            cx="36"
            cy="36"
            fill="none"
            r={R}
            stroke={good ? 'var(--success)' : 'var(--primary)'}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - ratio)}
            strokeLinecap="round"
            strokeWidth="8"
            style={{ '--c': C } as React.CSSProperties}
          />
        </svg>
        <div>
          <p className="text-lg tabular-nums">
            答对 <b className={cn('text-[30px] tracking-tight', good ? 'text-success' : 'text-primary-text')}>{score}</b> / {total}
          </p>
          <p className="text-[13px] text-muted-foreground">{good ? '不错。错的那几题点开看看解析' : ratio >= 0.5 ? '对了一半多。错题点开对一下原文，找出漏掉的那句' : '错得有点多。先把错题对着原文看一遍，再重做这组'}</p>
        </div>
      </div>
      {band != null && (
        <div className="flex items-baseline gap-3 bg-chip px-4 py-2">
          <span className="text-[30px] font-bold leading-none tracking-tight text-primary-text tabular-nums">band {band.toFixed(1).replace(/\.0$/, '')}</span>
          <span className="text-[12px] text-primary-text/80">估算分数，仅供参考</span>
        </div>
      )}
      {time && (
        <div className="flex basis-full flex-col gap-2 text-[14px] text-muted-foreground">
          <p className="tabular-nums" data-testid="result-time">
            用时 <b className="font-semibold text-foreground">{fmt(time.duration)}</b>
            {time.limit !== undefined && (
              <>
                {' · '}限时 {fmt(time.limit)}
                {' · '}
                {time.duration > time.limit ? <span className="text-warning">超时 {fmt(time.duration - time.limit)}</span> : `提前 ${fmt(time.limit - time.duration)}`}
              </>
            )}
          </p>
          {time.slow.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span>用时最长</span>
              {time.slow.map((x) => (
                <button
                  className="inline-flex min-h-11 items-center border border-border bg-background px-3 text-foreground tabular-nums hover:border-foreground"
                  data-testid="slow-q"
                  key={x.anchor}
                  onClick={() => onPick?.(x.anchor)}
                  type="button"
                >
                  第 {x.span > 1 ? `${x.anchor}–${x.anchor + x.span - 1}` : x.anchor} 题 {fmt(x.sec)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        {onShare && (
          <Button data-testid="share-open" onClick={onShare} type="button" variant="outline">
            <Share2 aria-hidden="true" strokeWidth={2} />
            分享成绩
          </Button>
        )}
        {pickAgainHref && (
          <Button asChild data-testid="pick-again">
            <Link href={pickAgainHref}>
              <Shuffle aria-hidden="true" strokeWidth={2} />
              再抽一题
            </Link>
          </Button>
        )}
        <Button onClick={onRetry} type="button" variant="outline">
          <RotateCcw aria-hidden="true" strokeWidth={2} />
          再做一遍
        </Button>
        <Button asChild variant="soft">
          <Link href={listHref}>返回列表</Link>
        </Button>
      </div>
    </section>
  )
}
