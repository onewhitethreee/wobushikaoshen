import type { Metadata } from 'next'

import Link from 'next/link'
import React from 'react'

import { LoginForm } from '@/components/Account/LoginForm'

export const metadata: Metadata = { title: '登录', robots: { index: false, follow: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <section className="container py-12 md:py-20">
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] font-medium tracking-[-0.01em]">登录</h1>
          <p className="text-[15px] leading-[1.7] text-muted-foreground">
            第一次登录会自动注册。登录后换设备也能看到做题记录、错题本、收藏和单词本。
          </p>
        </div>
        <LoginForm next={next} />
        <p className="border-t border-border pt-4 text-[13px] text-muted-foreground">
          不登录也能做题。{' '}
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/listening">
            先去做题 ↗
          </Link>
          <br />
          错题本、收藏和单词本不登录也能用：
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/me/mistakes">
            错题本
          </Link>
          {' · '}
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/me/favorites">
            我的收藏
          </Link>
          {' · '}
          <Link className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4" href="/me/words">
            单词本
          </Link>
        </p>
      </div>
    </section>
  )
}
