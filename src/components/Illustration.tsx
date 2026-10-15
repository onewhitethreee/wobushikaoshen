import React from 'react'

import { cn } from '@/utilities/ui'

// 单线条插画：描边用 currentColor（2.5px），平涂只用明黄 / 深青绿（不用页面底色，深色模式下会变黑吞掉描边），深色模式自动跟随。纯装饰，对读屏隐藏。

type Art = React.FC<{ className?: string }>
const line = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2.5 } as const

/** 首页 01 听力：一副耳机和两道声波 */
export const HeadphonesArt: Art = ({ className }) => (
  <svg aria-hidden="true" className={cn('pointer-events-none', className)} viewBox="0 0 160 150" {...line}>
    <path d="M30 100V75a50 50 0 0 1 100 0v25" />
    <rect fill="var(--sun)" height="50" width="30" x="18" y="88" />
    <rect fill="var(--mark)" height="50" width="30" x="112" y="88" />
    <path d="M64 120q8-10 0-20M78 126q14-20 0-40" />
  </svg>
)

/** 首页 02 阅读：一本摊开的书 */
export const BookArt: Art = ({ className }) => (
  <svg aria-hidden="true" className={cn('pointer-events-none', className)} viewBox="0 0 160 150" {...line}>
    <path d="M80 52C60 40 30 38 10 44v88c20-6 50-4 70 8z" />
    <path d="M80 52c20-12 50-14 70-8v88c-20-6-50-4-70 8z" />
    <path d="M24 66c16-4 34-2 46 4M24 84c16-4 34-2 46 4M24 102c16-4 34-2 46 4M92 70c12-6 30-8 46-4M92 88c12-6 30-8 46-4" />
  </svg>
)

/** 首页 03 全真模考：一只计时器 */
export const TimerArt: Art = ({ className }) => (
  <svg aria-hidden="true" className={cn('pointer-events-none', className)} viewBox="0 0 160 150" {...line}>
    <rect fill="var(--sun)" height="14" width="28" x="66" y="10" />
    <circle cx="80" cy="86" fill="var(--sun)" r="56" />
    <circle cx="80" cy="86" r="42" />
    <path d="M80 86V58M80 86l20 12M80 44v6M122 86h-6M80 128v-6M38 86h6" />
  </svg>
)

/** 正确率空状态：一张还空着的小柱状图 */
export const EmptyChartArt: Art = ({ className }) => (
  <svg aria-hidden="true" className={cn('pointer-events-none', className)} viewBox="0 0 120 80" {...line} strokeWidth={2}>
    <path d="M10 70h100M10 10v60" />
    {[24, 48, 72, 96].map((x, i) => (
      <rect fill={i === 0 ? 'var(--sun)' : 'none'} height={16 + i * 10} key={x} strokeDasharray={i ? '4 4' : undefined} width="12" x={x - 6} y={70 - 16 - i * 10} />
    ))}
  </svg>
)

/** 404：一张折了角、带问号的答题纸 */
export const LostPaperArt: Art = ({ className }) => (
  <svg aria-hidden="true" className={cn('pointer-events-none', className)} viewBox="0 0 160 140" {...line}>
    <rect fill="var(--sun)" height="96" width="96" x="32" y="30" />
    <g transform="rotate(-7 80 70)">
      <path d="M46 26h52l20 20v76H40V26z" />
      <path d="M98 26v20h20" />
      <path d="M68 66a12 12 0 1 1 18 10c-4 2-6 4-6 8" strokeWidth="4" />
      <circle cx="80" cy="98" fill="currentColor" r="3" stroke="none" />
    </g>
  </svg>
)
