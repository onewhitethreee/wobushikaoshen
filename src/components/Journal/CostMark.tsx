import React from 'react'

import type { Cost } from '@/sample'
import { cn } from '@/utilities/ui'

// 免费 = 绿点 + "免费"；扣额度 = 黄点 + "N 额度"。圆点颜色、文字都不同，灰度下靠文字分辨。
export const CostMark: React.FC<{ cost: Cost; label?: string; className?: string }> = ({ cost, label, className }) => {
  const free = cost.kind === 'free'
  return (
    <span className={cn('inline-flex items-center gap-1.5 bg-chip px-2 py-0.5 text-[13px] whitespace-nowrap', className)}>
      <span aria-hidden="true" className={cn('size-[7px] rounded-full', free ? 'bg-success' : 'bg-sun')} />
      {free ? (label ? `${label} · 免费` : '免费') : label ? `${label} ${cost.amount} 额度` : `${cost.amount} 额度`}
    </span>
  )
}
