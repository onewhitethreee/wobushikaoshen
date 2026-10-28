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
import { TodayPlan } from '@/components/Plan/TodayPlan'
import { getPlatform } from '@/account/credits'
import { noteText } from '@/account/notePlatform'
import { API_TAG } from '@/contentApi/request'
import { getColumn } from '@/content/columns'
import { home, type PracticeRow } from '@/sample'
import { cn } from '@/utilities/ui'

export const revalidate = 60

export const metadata: Metadata = { title: { absolute: '我不是考神' } }

const quotaTags = ['笔记', '邀请']

// 每科取两行：听力阅读优先整篇 / 整个 Part，没有就取前两行
const picks = (rows: PracticeRow[]) => {
  const units = rows.filter((r) => r.facets.kind === 'unit')
  return (units.length ? units : rows).slice(0, 2).map((r) => ({
    id: r.id,
    title: r.title,
    meta: r.meta.join(' · '),
    count: r.count ? `${r.count} 题` : undefined,
  }))
}

export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })
  // 领额度方式：笔记那项按平台设置换名或去掉（032），标签跟着同一项走
  const platform = await getPlatform(payload)
  const quotaWays = home.quotaWays
    .map((w, i) => ({ ...w, tag: quotaTags[i] }))
    .filter((w) => platform || w.kind !== 'note')
    .map((w) => (platform ? { ...w, title: noteText(w.title, platform), desc: noteText(w.desc, platform) } : w))
  const [daily, posts, ...cols] = await Promise.all([
    payload.find({
      collection: 'units',
      where: { _status: { equals: 'published' }, sourceTag: { equals: API_TAG } },
      sort: '-createdAt',
      limit: 3,
      depth: 0,
      select: { title: true, createdAt: true },
    }),
    payload.find({
      collection: 'posts',
      where: { _status: { equals: 'published' } },
      sort: '-publishedAt',
      limit: 4,
      depth: 1,
    }),
    ...home.subjects.map((s) => getColumn(s.slug)),
  ])
  const subjects = home.subjects.map((s, i) => ({ ...s, items: picks(cols[i]!.rows) }))
  const units = (slug: string) => cols[home.subjects.findIndex((s) => s.slug === slug)]?.rows.filter((r) => r.facets.kind === 'unit').length ?? 0
  const totals = { listening: units('listening'), reading: units('reading') }

  return (
    <div className="container flex flex-col pt-8 pb-24 md:pt-10">
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

      {/* 029 每日精选：最新三篇，没有就不显示 */}
      {daily.docs.length > 0 && (
        <section aria-labelledby="daily-title" className="mt-8 border border-border p-[clamp(20px,3vw,32px)]" data-testid="daily">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-2xl font-medium tracking-[-0.01em]" id="daily-title">
              每日精选阅读
            </h2>
            <span className="text-sm text-muted-foreground">
              每天更新新文章 · 最近更新{' '}
              {new Date(daily.docs[0]!.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' })}
            </span>
          </div>
          <ul className="mt-3 flex flex-col">
            {daily.docs.map((u) => (
              <li key={u.id}>
                <Link className="group flex min-h-11 items-baseline justify-between gap-4 py-1.5" href={`/practice/u${u.id}`}>
                  <span className="font-medium group-hover:underline underline-offset-4">{u.title}</span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">开始练习</span>
                </Link>
              </li>
            ))}
            <li>
              <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline underline-offset-4" href={`/reading?tag=${encodeURIComponent(API_TAG)}`}>
                看全部每日精选
                <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
              </Link>
            </li>
          </ul>
        </section>
      )}

      {/* 024 今日任务：考试倒计时、每日题量、背单词、打卡 */}
      <div className="mt-8">
        <TodayPlan totals={totals} />
      </div>

      {/* 四科目录 | 额度说明，中间一条竖线（006 FR-052、FR-053） */}
      <div className="flex flex-wrap">
        <section aria-labelledby="catalog-title" className="min-w-0 flex-[999_1_600px] py-14 lg:pr-10" data-testid="catalog">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 className="text-[30px] font-medium tracking-[-0.02em]" id="catalog-title">
              四科目录
            </h2>
            <span className="text-sm text-muted-foreground">听力阅读免费 · 写作口语批改用额度</span>
          </div>
          {subjects.map((s, i) => (
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
                    <Link className="inline-flex min-h-11 items-center text-2xl font-medium tracking-[-0.01em] hover:underline underline-offset-4" href={`/${s.slug}`}>
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
            {quotaWays.map((w) => (
              <li className={cn('flex flex-col gap-1.5 bg-muted px-5 py-4', w.disabled && 'text-muted-foreground')} key={w.title}>
                <p className="text-[17px] font-semibold">{w.title}</p>
                <p className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{w.desc}</span>
                  <span className="inline-flex items-center gap-1.5 bg-chip px-2 py-0.5 text-[13px] whitespace-nowrap text-foreground">
                    <span aria-hidden="true" className={cn('size-[7px] rounded-full', w.disabled ? 'bg-muted-foreground' : 'bg-sun')} />
                    {w.tag}
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
            <span className="flex flex-wrap gap-x-6">
              <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline underline-offset-4" data-testid="home-jijing" href="/jijing">
                机经 <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
              </Link>
              <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline underline-offset-4" href="/posts">
                全部文章 <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
              </Link>
            </span>
          </div>
          <ul>
            {posts.docs.map((p) => {
              const cat = p.categories?.[0]
              return (
                <li className="border-t border-border" key={p.id}>
                  <Link className="group flex min-h-14 items-center gap-4 py-3" href={`/posts/${p.slug}`}>
                    <span className="shrink-0 bg-muted px-2 py-0.5 text-[13px] text-muted-foreground">
                      {p.column === 'jijing' ? '机经' : typeof cat === 'object' && cat?.title ? cat.title : '文章'}
                    </span>
                    <span className="min-w-0 font-medium group-hover:underline underline-offset-4">{p.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
