import type { Metadata } from 'next'

import Link from 'next/link'
import React from 'react'

import { MockExam } from '@/components/Mock/MockExam'
import { MockGone } from '@/components/Mock/MockGone'
import { RandomDraw } from '@/components/Mock/RandomDraw'
import { getRandomPaper, getRandomPool } from '@/content/mockPaper'
import { RANDOM_NO } from '@/practice/mockAttempt'

// 随机一场（站长 2026-10-20 追加）：没带 u 时在浏览器里抽题；带 u=7 个单元 id 时就是考试页
export const metadata: Metadata = { title: '随机模考' }

type Props = { searchParams: Promise<{ u?: string; a?: string }> }

export default async function Page({ searchParams }: Props) {
  const q = await searchParams
  const a = Number(q.a)
  const view = Number.isFinite(a) && a > 0 ? a : undefined
  const ids = (q.u ?? '').split(',').filter((x) => /^[1-9]\d{0,8}$/.test(x)).map(Number)

  if (ids.length !== 7) return <RandomDraw pool={await getRandomPool()} view={view} />
  const paper = await getRandomPaper(ids)
  if (!paper) return <MockGone no={RANDOM_NO} />

  return (
    <>
      <section>
        <div className="container pt-6 pb-1">
          <nav aria-label="当前位置" className="text-[13px] text-muted-foreground">
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
              首页
            </Link>{' '}
            /{' '}
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/mock">
              模考
            </Link>{' '}
            / 随机模考
          </nav>
        </div>
      </section>
      <MockExam paper={paper} view={view} />
    </>
  )
}
