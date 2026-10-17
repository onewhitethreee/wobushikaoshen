import type { Metadata } from 'next'

import Link from 'next/link'
import React from 'react'

import { ReviewDetail } from '@/components/Writing/ReviewHistory'

export const metadata: Metadata = { title: '批改详情', robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground hover:text-foreground" href="/me/reviews">
          ← 写作批改
        </Link>
        <ReviewDetail id={id} />
      </div>
    </section>
  )
}
