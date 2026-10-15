import Link from 'next/link'
import React from 'react'

import { BookArt, HeadphonesArt, TimerArt } from '@/components/Illustration'
import { cn } from '@/utilities/ui'

// 首页首屏右侧三块编号色块：浅纸 / 明黄 / 深青绿，各配一幅单线条插画（006 FR-051）
// 彩色块上的插画描边一律用深色（sun-foreground），深色模式下也不会变成浅线压在明黄上
const tiles = [
  { no: '01', title: '听力', desc: '按 Part、按题型练', href: '/listening', tone: 'bg-background', ink: 'text-foreground', Art: HeadphonesArt },
  { no: '02', title: '阅读', desc: '学术类长文，三种题型', href: '/reading', tone: 'bg-sun text-sun-foreground', ink: 'text-sun-foreground', Art: BookArt },
  { no: '03', title: '全真模考', desc: '1:1 还原机考界面', href: '/mock', tone: 'bg-mark text-mark-foreground', ink: 'text-sun-foreground', Art: TimerArt },
]

export const HeroTiles: React.FC<{ className?: string }> = ({ className }) => (
  <ul className={cn('grid grid-cols-3 gap-3 sm:gap-4', className)}>
    {tiles.map(({ no, title, desc, href, tone, ink, Art }) => (
      <li key={no}>
        <Link
          className={cn('flex h-full min-h-56 flex-col overflow-hidden p-4 hover:-translate-y-1 sm:min-h-[380px] sm:p-5', tone)}
          href={href}
        >
          <span className="text-[15px]">{no}</span>
          <span className="mt-4 text-[clamp(20px,2.2vw,30px)] leading-tight font-medium tracking-[-0.02em] sm:mt-6">{title}</span>
          <span className="mt-1.5 hidden text-[13px] opacity-85 sm:block">{desc}</span>
          <Art className={cn('mt-auto w-full max-w-44 self-end', ink)} />
        </Link>
      </li>
    ))}
  </ul>
)
