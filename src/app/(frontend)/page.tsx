import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { CostMark } from '@/components/Journal/CostMark'
import { HeroTiles } from '@/components/Journal/HeroTiles'
import { MockBand } from '@/components/Journal/MockBand'
import { StartForm } from '@/components/Journal/StartForm'
import { home } from '@/sample'
import { cn } from '@/utilities/ui'

export const revalidate = 60

export const metadata: Metadata = { title: { absolute: '我不是考神' } }

const quotaTags = ['笔记', '邀请', '未开放']

export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
    sort: '-publishedAt',
    limit: 4,
    depth: 1,
  })

  return (
    <main className="container flex flex-col pt-8 pb-24 md:pt-10" id="main">
      {/* 首屏：整块米色区，左标题 + 选科，右三块编号色块（006 FR-051） */}
      <section className="flex animate-rise flex-wrap gap-10 bg-muted p-[clamp(20px,4vw,48px)]">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
          {home.issueLine && <p className="text-[15px] text-muted-foreground">{home.issueLine}</p>}
          <h1 className="text-[clamp(30px,4.4vw,60px)] leading-[1.18] font-medium tracking-[-0.02em]">
            听力阅读模考，
            <br />
            全部免费。
            <br />
            不用注册，现在就能做。
          </h1>
          <StartForm className="max-w-[460px]" />
        </div>
        <HeroTiles className="min-w-0 flex-[1.2_1_520px]" />
      </section>

      {/* 四科目录 | 额度说明，中间一条竖线（006 FR-052、FR-053） */}
      <div className="flex flex-wrap">
        <section aria-labelledby="catalog-title" className="min-w-0 flex-[999_1_600px] py-14 lg:pr-10" data-testid="catalog">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 className="text-[30px] font-medium tracking-[-0.02em]" id="catalog-title">
              四科目录
            </h2>
            <span className="text-sm text-muted-foreground">听力阅读免费 · 写作口语批改用额度</span>
          </div>
          {home.subjects.map((s, i) => (
            <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-5 border-t border-border py-7" data-testid={`subject-${s.name}`} key={s.slug}>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-[52px] items-center justify-center text-[15px] font-semibold',
                  s.cost.kind === 'free' ? 'ring-[1.5px] ring-foreground ring-inset' : 'bg-primary text-primary-foreground',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div className="min-w-0 flex-[1_1_200px]">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link className="text-2xl font-medium tracking-[-0.01em] hover:underline underline-offset-4" href={`/${s.slug}`}>
                      {s.name}
                    </Link>
                    <CostMark cost={s.cost} label={s.costLabel} />
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
                </div>
                <ul className="flex min-w-0 flex-[1.4_1_280px] flex-col">
                  {s.items.map((it) => (
                    <li key={it.id}>
                      <Link
                        className="group flex min-h-11 items-baseline justify-between gap-4 py-1.5"
                        href={`/${s.slug}?focus=${it.id}`}
                      >
                        <span className="font-medium group-hover:underline underline-offset-4">{it.title}</span>
                        <span className="shrink-0 text-[13px] text-muted-foreground">
                          {it.meta}
                          {it.count && ` · ${it.count}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline underline-offset-4" href={`/${s.slug}`}>
                      {s.moreLabel}
                      <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </section>

        <aside
          aria-labelledby="quota-title"
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 border-border pb-14 lg:border-l lg:pt-14 lg:pl-10"
          id="quota"
        >
          <h2 className="text-[26px] leading-snug font-medium tracking-[-0.02em]" id="quota-title">
            写作和口语批改
            <br />
            要用额度
          </h2>
          <p className="text-sm text-muted-foreground">
            看题、写作不扣额度，交给 AI 批改时才扣。
          </p>
          <p className="mt-4 text-sm text-muted-foreground">怎么领</p>
          <ul className="flex flex-col gap-3">
            {home.quotaWays.map((w, i) => (
              <li className={cn('flex flex-col gap-1.5 bg-muted px-5 py-4', w.disabled && 'text-muted-foreground')} key={w.title}>
                <p className="text-[17px] font-semibold">{w.title}</p>
                <p className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{w.desc}</span>
                  <span className="inline-flex items-center gap-1.5 bg-chip px-2 py-0.5 text-[13px] whitespace-nowrap text-foreground">
                    <span aria-hidden="true" className={cn('size-[7px] rounded-full', w.disabled ? 'bg-muted-foreground' : 'bg-sun')} />
                    {quotaTags[i]}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <MockBand mock={home.mock} />

      {posts.docs.length > 0 && (
        <section className="pt-16">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[30px] font-medium tracking-[-0.02em]">备考文章</h2>
            <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline underline-offset-4" href="/posts">
              全部文章 <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
            </Link>
          </div>
          <ul>
            {posts.docs.map((p) => {
              const cat = p.categories?.[0]
              return (
                <li className="border-t border-border" key={p.id}>
                  <Link className="group flex min-h-14 items-center gap-4 py-3" href={`/posts/${p.slug}`}>
                    <span className="shrink-0 bg-muted px-2 py-0.5 text-[13px] text-muted-foreground">
                      {typeof cat === 'object' && cat?.title ? cat.title : '文章'}
                    </span>
                    <span className="min-w-0 font-medium group-hover:underline underline-offset-4">{p.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}
