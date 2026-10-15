import type { Metadata } from 'next'

import React from 'react'

import { MistakeBook } from '@/components/Account/MistakeBook'

export const metadata: Metadata = { title: '错题本', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-medium tracking-[-0.02em]">错题本</h1>
          <p className="text-[15px] text-muted-foreground">交卷后做错的题自动收进来；重做答对就移到「已掌握」。</p>
        </div>
        <MistakeBook />
      </div>
    </section>
  )
}
