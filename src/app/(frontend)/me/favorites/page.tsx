import type { Metadata } from 'next'

import React from 'react'

import { FavoriteList } from '@/components/Account/FavoriteList'

export const metadata: Metadata = { title: '我的收藏', robots: { index: false, follow: false } }

export default function Page() {
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-medium tracking-[-0.02em]">我的收藏</h1>
          <p className="text-[15px] text-muted-foreground">收藏的单元和题目，点进去直接练。</p>
        </div>
        <FavoriteList />
      </div>
    </section>
  )
}
