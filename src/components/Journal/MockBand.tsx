import { ArrowUpRight, Timer } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import type { HomeData } from '@/sample'

// 模考入口：整块明黄（006 FR-053）；首页唯一的实心主按钮留给"开始做题"，这里用浅纸色方块
export const MockBand: React.FC<{ mock: HomeData['mock'] }> = ({ mock }) => {
  const specs = [`听力 ${mock.listening}`, `阅读 ${mock.reading}`, mock.result]

  return (
    <section className="flex flex-wrap items-center gap-x-14 gap-y-8 bg-sun px-[clamp(20px,4vw,56px)] py-[clamp(28px,4vw,56px)] text-sun-foreground">
      <div className="flex min-w-0 flex-[1_1_340px] items-center gap-5">
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sun-foreground text-sun">
          <Timer className="size-7" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-[clamp(32px,3.4vw,48px)] leading-tight font-medium tracking-[-0.02em]">全真模考</h2>
          <p className="text-[15px]">界面按电脑考试 1:1 还原 · 免费</p>
        </div>
      </div>
      <ul className="flex min-w-0 flex-[2_1_360px] flex-wrap gap-x-8 gap-y-2 text-[17px] font-medium">
        {specs.map((s) => (
          <li className="whitespace-nowrap" key={s}>
            {s}
          </li>
        ))}
      </ul>
      <div className="flex flex-[1_1_220px] flex-col gap-2">
        <Link
          className="hidden min-h-[52px] items-center justify-between bg-background px-5 font-semibold text-foreground hover:bg-primary hover:text-primary-foreground lg:flex"
          href="/mock"
        >
          选一套开始
          <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
        </Link>
        <p className="hidden text-[13px] lg:block">考试模式请用电脑打开</p>
        <p className="text-sm lg:hidden">
          考试模式请用电脑打开。
          <Link className="ml-1 font-semibold underline underline-offset-4" href="/mock">
            先看看有哪些套题
          </Link>
        </p>
      </div>
    </section>
  )
}
