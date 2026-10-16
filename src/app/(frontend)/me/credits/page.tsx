import type { Metadata } from 'next'

import React from 'react'

import { CreditsView } from '@/components/Account/CreditsView'

export const metadata: Metadata = { title: '我的额度', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-medium tracking-[-0.02em]">我的额度</h1>
          <p className="text-[15px] text-muted-foreground">写作批改、口语批改要用额度；做题和模考免费。</p>
        </div>
        <CreditsView />
      </div>
    </section>
  )
}
