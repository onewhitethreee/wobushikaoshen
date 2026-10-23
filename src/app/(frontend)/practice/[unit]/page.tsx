import type { Metadata } from 'next'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import React, { cache } from 'react'

import { BookOpen, Headphones } from 'lucide-react'

import { CostMark } from '@/components/Journal/CostMark'
import { FavoriteButton } from '@/components/Account/FavoriteButton'
import { PracticeView } from '@/components/Practice/PracticeView'
import { groupNumbers } from '@/exam/practice'
import { getPracticeUnit, latestUnitId } from '@/content/practiceUnit'

const load = cache(getPracticeUnit)

type Props = { params: Promise<{ unit: string }>; searchParams: Promise<{ pick?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const unit = await load((await params).unit)
  return { title: unit?.title ?? '没找到这组题' }
}

export default async function Page({ params, searchParams }: Props) {
  const id = (await params).unit
  // 030：从"随机一题"进来时带着抽题范围（PracticeView 里校验）
  const { pick } = await searchParams
  const latest = /^latest-([lr])1$/.exec(id)
  if (latest) {
    const m = latest[1] as 'l' | 'r'
    const target = await latestUnitId(m)
    redirect(target ? `/practice/${target}` : `/${m === 'l' ? 'listening' : 'reading'}?empty=1`)
  }

  const unit = await load(id)
  if (!unit) notFound()

  const isL = unit.module === 'listening'
  const column = isL ? { href: '/listening', name: '听力' } : { href: '/reading', name: '阅读' }
  const count = unit.sections.flatMap((s) => s.groups.flatMap(groupNumbers)).length

  return (
    <>
      <section>
        <div className="container pt-6 pb-1">
          <nav aria-label="当前位置" className="text-[13px] text-muted-foreground">
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
              首页
            </Link>{' '}
            /{' '}
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href={column.href}>
              {column.name}
            </Link>{' '}
            / {unit.title}
          </nav>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-3">
              {isL ? <Headphones aria-hidden="true" className="size-7 shrink-0" strokeWidth={1.75} /> : <BookOpen aria-hidden="true" className="size-7 shrink-0" strokeWidth={1.75} />}
              <h1 data-unit-title className="min-w-0 text-[22px] font-bold leading-tight tracking-tight text-balance md:text-[30px]">{unit.title}</h1>
              <FavoriteButton favKey={`u:${unit.id}`} />
            </div>
            <CostMark cost={{ kind: 'free' }} />
            <span className="bg-muted px-2.5 py-0.5 text-[12px] text-muted-foreground tabular-nums">{count} 题</span>
          </div>
        </div>
      </section>
      <PracticeView pickScope={pick} unit={unit} />
    </>
  )
}
