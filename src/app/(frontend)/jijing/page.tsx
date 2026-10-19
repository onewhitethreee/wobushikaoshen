import type { Metadata } from 'next'
import configPromise from '@payload-config'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { getPayload, type Where } from 'payload'
import React from 'react'

import { seasonLabel, SUBJECTS, type Subject } from '@/content/jijing'
import { cn } from '@/utilities/ui'

// 027 机经栏目：已发布的机经按题季分组（新的在上），可按科目筛选；服务端渲染给搜索引擎
export const revalidate = 600

export const metadata: Metadata = {
  title: '雅思机经：考后回忆与本季高频题',
  description: '按题季整理的雅思学术类考后回忆和本季高频题：听力、阅读、写作、口语。题季按口语换题月份划分（1–4 月、5–8 月、9–12 月）。',
  alternates: { canonical: '/jijing' },
}

const NAME = Object.fromEntries(SUBJECTS.map((s) => [s.value, s.label])) as Record<Subject, string>
const day = (s?: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export default async function Page({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject: raw } = await searchParams
  const subject = SUBJECTS.some((s) => s.value === raw) ? (raw as Subject) : undefined
  const payload = await getPayload({ config: configPromise })
  const where: Where = { and: [{ column: { equals: 'jijing' } }, ...(subject ? [{ subjects: { contains: subject } }] : [])] }
  const { docs } = await payload.find({
    collection: 'posts',
    overrideAccess: false,
    where,
    sort: '-publishedAt',
    limit: 500,
    depth: 0,
    select: { title: true, slug: true, season: true, subjects: true, publishedAt: true },
  })

  const groups = new Map<string, typeof docs>()
  for (const d of docs) {
    const key = d.season ?? '其他'
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  const seasons = [...groups.keys()].sort((a, b) => (a === '其他' ? 1 : b === '其他' ? -1 : b.localeCompare(a)))
  const tab = (on: boolean) =>
    cn('inline-flex min-h-11 items-center text-[15px]', on ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground hover:text-foreground')

  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <nav aria-label="当前位置" className="text-[13px] text-muted-foreground">
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
              首页
            </Link>{' '}
            / 机经
          </nav>
          <h1 className="text-[clamp(32px,4vw,48px)] leading-tight font-medium tracking-[-0.02em]">机经</h1>
          <p className="text-[15px] text-muted-foreground">考后回忆和本季高频题，按题季整理（口语每年 1、5、9 月换题）。</p>
        </div>

        <nav aria-label="按科目筛选" className="flex gap-x-7 overflow-x-auto border-b border-border" data-testid="jijing-filter">
          <Link aria-current={!subject ? 'page' : undefined} className={tab(!subject)} href="/jijing">
            全部
          </Link>
          {SUBJECTS.map((s) => (
            <Link aria-current={subject === s.value ? 'page' : undefined} className={tab(subject === s.value)} href={`/jijing?subject=${s.value}`} key={s.value}>
              {s.label}
            </Link>
          ))}
        </nav>

        {!docs.length ? (
          <div className="flex flex-col items-start gap-3 py-10">
            <p className="text-[15px] text-muted-foreground">机经还在整理，先去练题。</p>
            <Link className="inline-flex min-h-11 items-center gap-1 border-[1.5px] border-foreground px-5 text-sm font-semibold hover:bg-primary hover:text-primary-foreground" href="/listening">
              去练习 <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : (
          seasons.map((season) => (
            <section className="flex flex-col gap-2" data-testid="jijing-season" key={season}>
              <h2 className="text-[22px] font-medium">{season === '其他' ? '其他' : seasonLabel(season)}</h2>
              <ul className="border-t border-border">
                {groups.get(season)!.map((d) => (
                  <li className="border-b border-border" data-testid="jijing-row" key={d.id}>
                    <Link className="group flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 py-3" href={`/posts/${d.slug}`}>
                      <span className="min-w-0 flex-1 font-medium underline-offset-4 group-hover:underline">{d.title}</span>
                      <span className="flex gap-1.5">
                        {(d.subjects ?? []).map((s) => (
                          <span className="bg-muted px-2 py-0.5 text-[13px] text-muted-foreground" key={s}>
                            {NAME[s]}
                          </span>
                        ))}
                      </span>
                      <span className="text-[13px] text-muted-foreground tabular-nums">{day(d.publishedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
