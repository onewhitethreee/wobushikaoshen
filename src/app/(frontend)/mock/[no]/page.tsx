import type { Metadata } from 'next'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { cache } from 'react'

import { MockExam } from '@/components/Mock/MockExam'
import { MockGone } from '@/components/Mock/MockGone'
import { getMockPaper, mockPaperExists } from '@/content/mockPaper'

// 028 模考考试页：说明 → 听力 → 过渡 → 阅读 → 成绩单；?a={开始时间} 看某一场的成绩单
const load = cache(getMockPaper)

type Props = { params: Promise<{ no: string }>; searchParams: Promise<{ a?: string }> }

const parseNo = (s: string) => (/^[1-9]\d{0,5}$/.test(s) ? Number(s) : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const no = parseNo((await params).no)
  const paper = no ? await load(no) : null
  return { title: paper ? `${paper.title} · 模考` : '模考' }
}

export default async function Page({ params, searchParams }: Props) {
  const no = parseNo((await params).no)
  if (!no) notFound()
  const paper = await load(no)
  if (!paper) {
    if (await mockPaperExists(no)) return <MockGone no={no} />
    notFound()
  }
  const a = Number((await searchParams).a)

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
            / {paper.title}
          </nav>
        </div>
      </section>
      <MockExam paper={paper} view={Number.isFinite(a) && a > 0 ? a : undefined} />
    </>
  )
}
