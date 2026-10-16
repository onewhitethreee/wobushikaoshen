import type { Metadata } from 'next'

import Link from 'next/link'
import React from 'react'

import { WordBook } from '@/components/Vocab/WordBook'

export const metadata: Metadata = { title: '单词本', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <main className="container py-10 md:py-14" id="main">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-[30px] font-medium tracking-[-0.02em]">单词本</h1>
            <p className="text-[15px] text-muted-foreground">在电脑上双击文章里的单词，就能加进来。</p>
          </div>
          <Link className="inline-flex min-h-11 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground" href="/me/review">
            去背单词 →
          </Link>
        </div>
        <WordBook />
      </div>
    </main>
  )
}
