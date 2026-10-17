import type { Metadata } from 'next'

import React from 'react'

import { ReviewList } from '@/components/Writing/ReviewHistory'

export const metadata: Metadata = { title: '写作批改', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <h1 className="text-[30px] font-medium tracking-[-0.02em]">写作批改</h1>
        <ReviewList />
      </div>
    </section>
  )
}
