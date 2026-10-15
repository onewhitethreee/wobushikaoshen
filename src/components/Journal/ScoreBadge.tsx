import React from 'react'

import type { RowScore } from '@/sample'
import { cn } from '@/utilities/ui'

// 栏目页每行的成绩图形（005 US6，契约见 specs/005-visual-refresh/contracts/visual.md「成绩记录」）

export type Level = 'good' | 'mid' | 'low'

/** 三档：band ≥ 7 / 正确率 ≥ 80% 好；band ≥ 5.5 / 正确率 ≥ 50% 中；其余低 */
export const levelOf = (s: { band: number } | { ratio: number }): Level =>
  'band' in s ? (s.band >= 7 ? 'good' : s.band >= 5.5 ? 'mid' : 'low') : s.ratio >= 0.8 ? 'good' : s.ratio >= 0.5 ? 'mid' : 'low'

/** 弧线填充比例（0–1） */
export const fillOf = (s: { band: number } | { ratio: number }) => Math.min(Math.max('band' in s ? s.band / 9 : s.ratio, 0), 1)

// 三档（006 contracts 规则 7）：success-solid(ok-9) / mark(teal-9) / sun(sun-9)，OKLCH 明度 0.60 / 0.50 / 0.835，灰度下可分
const STROKE: Record<Level, string> = { good: 'stroke-success-solid', mid: 'stroke-mark', low: 'stroke-sun' }
// 未填充部分用同色淡轨道，看得出总量（不然半个环像加载转圈）
const TRACK = 'opacity-20'
const TEXT: Record<Level, string> = { good: 'text-success', mid: 'text-foreground', low: 'text-warning' }

// 填充弧用 pathLength=100，dashoffset 从 100（空）过渡到目标值；减少动效时全局过渡为 0
const fillArc = 'starting:[stroke-dashoffset:100] [transition:stroke-dashoffset_.8s_var(--ease-out-expo)]'

const BandGauge: React.FC<{ label: string; band: number }> = ({ label, band }) => {
  const level = levelOf({ band })
  const offset = 100 * (1 - fillOf({ band }))
  return (
    <span aria-label={`${label} ${band} 分`} className="inline-flex flex-col items-center" data-testid="band-gauge" role="img">
      <span className="relative block h-10 w-16">
        <svg aria-hidden="true" className="absolute inset-0" fill="none" viewBox="0 0 64 40">
          <path className={cn(STROKE[level], TRACK)} d="M6 35 A26 26 0 0 1 58 35" strokeLinecap="round" strokeWidth="7" />
          <path
            className={cn(STROKE[level], fillArc)}
            d="M6 35 A26 26 0 0 1 58 35"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="7"
          />
        </svg>
        <span className={cn('absolute inset-x-0 bottom-0.5 text-center text-[18px] font-bold leading-none tracking-tight tabular-nums', TEXT[level])}>
          {band.toFixed(1)}
        </span>
      </span>
      <span className="mt-0.5 text-[11px] leading-none text-muted-foreground">{label}</span>
    </span>
  )
}

const RatioRing: React.FC<{ correct: number; total: number }> = ({ correct, total }) => {
  const ratio = total ? correct / total : 0
  const level = levelOf({ ratio })
  return (
    <span className="inline-flex items-center gap-2" data-testid="ratio-ring">
      <svg aria-hidden="true" className="size-7 shrink-0 -rotate-90" fill="none" viewBox="0 0 28 28">
        <circle className={cn(STROKE[level], TRACK)} cx="14" cy="14" r="11" strokeWidth="4" />
        <circle
          className={cn(STROKE[level], fillArc)}
          cx="14"
          cy="14"
          pathLength={100}
          r="11"
          strokeDasharray="100"
          strokeDashoffset={100 * (1 - fillOf({ ratio }))}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      <span className="text-[13px] leading-tight tabular-nums">
        <span className="text-muted-foreground">上次 </span>
        <b className={TEXT[level]}>{correct}</b>
        <span className="text-muted-foreground">/{total}</span>
      </span>
    </span>
  )
}

export const ScoreBadge: React.FC<{ score: RowScore }> = ({ score }) =>
  score.kind === 'ratio' ? (
    <RatioRing correct={score.correct} total={score.total} />
  ) : (
    <span className="inline-flex items-end gap-3">
      {score.items.map((i) => (
        <BandGauge band={i.band} key={i.label} label={i.label} />
      ))}
    </span>
  )
