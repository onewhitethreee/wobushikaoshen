import type { Metadata } from 'next'
import Link from 'next/link'

import React from 'react'

import { RadioPlayer } from '@/components/Radio/RadioPlayer'

export const metadata: Metadata = { title: '磨耳朵', robots: { index: false, follow: false } }

// 033 四级磨耳朵：从 ?start= 指定的 Section 开始连播这一套，不带时从最新一套开始
export default async function Page({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <nav aria-label="当前位置" className="text-[13px] text-muted-foreground">
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
              首页
            </Link>{' '}
            /{' '}
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/cet4">
              四级真题
            </Link>{' '}
            / 磨耳朵
          </nav>
          <h1 className="text-[30px] font-medium tracking-[-0.02em]">磨耳朵</h1>
          <p className="text-[15px] text-muted-foreground">锁屏、切到别的 App 也会继续播；一个播完自动接下一个。</p>
        </div>
        <RadioPlayer exam="cet4" key={start ?? ''} start={start} />
      </div>
    </section>
  )
}
