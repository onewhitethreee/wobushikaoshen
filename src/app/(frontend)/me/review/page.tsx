import type { Metadata } from 'next'

import React from 'react'

import { Review } from '@/components/Vocab/Review'

export const metadata: Metadata = { title: '背单词', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-medium tracking-[-0.02em]">背单词</h1>
          <p className="text-[15px] text-muted-foreground">先回想意思，再看释义，按记住的程度打分。</p>
        </div>
        <Review />
      </div>
    </div>
  )
}
