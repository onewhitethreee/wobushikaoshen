import type { Metadata } from 'next'

import React from 'react'

import { ProgressPanel } from '@/components/Progress/ProgressPanel'

export const metadata: Metadata = { title: '学习进度', robots: { index: false, follow: false } }

// 021 进步曲线：听力、阅读各一块，读本机记录（登录后先同步）
export default function Page() {
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-medium tracking-[-0.02em]">学习进度</h1>
          <p className="text-[15px] text-muted-foreground">做过的听力、阅读按交卷顺序画成曲线；登录后换设备也能看到。</p>
        </div>
        <ProgressPanel module="listening" />
        <ProgressPanel module="reading" />
        <ProgressPanel exam="cet4" />
        <ProgressPanel exam="cet6" />
      </div>
    </section>
  )
}
