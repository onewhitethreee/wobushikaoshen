import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { FavoriteButton } from '@/components/Account/FavoriteButton'
import { CostMark } from '@/components/Journal/CostMark'
import { WritingPad } from '@/components/Writing/WritingPad'
import { categoryLabel } from '@/exam/writingCategories'
import type { Media, WritingTask } from '@/payload-types'

// 写作题页（007 R11）：看题、看图、在本机写；AI 批改仍未开放
const load = cache(async (id: string): Promise<WritingTask | null> => {
  if (!/^\d+$/.test(id)) return null
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'writing-tasks',
    where: { and: [{ id: { equals: Number(id) } }, { _status: { equals: 'published' } }] },
    depth: 1,
    limit: 1,
  })
  return (res.docs[0] as WritingTask | undefined) ?? null
})

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const task = await load((await params).id)
  return { title: task ? `${task.titleZh ?? task.title} · 写作` : '没找到这道题' }
}

export default async function Page({ params }: Props) {
  const task = await load((await params).id)
  if (!task) notFound()

  const t1 = task.taskType === 'task1'
  const image = typeof task.image === 'object' && task.image ? (task.image as Media) : null
  const minWords = task.minWords ?? (t1 ? 150 : 250)
  const minutes = task.suggestedMinutes ?? (t1 ? 20 : 40)

  return (
    <main className="container flex flex-col gap-6 pt-6 pb-24" id="main">
      <nav aria-label="面包屑" className="text-[13px] text-muted-foreground">
        <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
          首页
        </Link>{' '}
        /{' '}
        <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/writing">
          写作
        </Link>{' '}
        / {task.titleZh ?? task.title}
      </nav>

      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t1 ? 'Task 1' : 'Task 2'}
          {task.category && ` · ${categoryLabel[task.category]}`} · 至少 {minWords} 词 · 建议{' '}
          {minutes} 分钟
        </p>
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 text-[clamp(28px,3.4vw,44px)] leading-tight font-medium tracking-[-0.02em]">
            {task.title}
          </h1>
          <FavoriteButton className="mt-1" favKey={`w:${task.id}`} />
        </div>
        {task.titleZh && <p className="text-[15px] text-muted-foreground">{task.titleZh}</p>}
      </header>

      <div className="flex flex-wrap gap-8">
        <section
          aria-label="题目"
          className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 self-start bg-muted p-[clamp(20px,3vw,32px)]"
        >
          {task.prompt
            .split('\n')
            .filter(Boolean)
            .map((line, i) => (
              <p className="text-[16px] leading-7" key={i}>
                {line}
              </p>
            ))}
          {image?.url && (
            <a className="group block" href={image.url} rel="noreferrer" target="_blank">
              {/* eslint-disable-next-line @next/next/no-img-element -- 题图尺寸各异，原样显示 */}
              <img
                alt={`${task.title} 配图`}
                className="w-full bg-background"
                height={image.height ?? undefined}
                loading="lazy"
                src={image.url}
                width={image.width ?? undefined}
              />
              <span className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold group-hover:underline underline-offset-4">
                查看原图
                <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
              </span>
            </a>
          )}
        </section>

        <section aria-label="作答" className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <WritingPad minWords={minWords} taskId={String(task.id)} />
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className="inline-flex min-h-11 cursor-not-allowed items-center border-[1.5px] border-input px-5 text-sm font-semibold text-muted-foreground">
              AI 批改 · 即将开放
            </span>
            <CostMark cost={{ kind: 'quota', amount: 1 }} label="批改" />
          </div>
        </section>
      </div>
    </main>
  )
}
