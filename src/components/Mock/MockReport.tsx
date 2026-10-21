'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { PracticeView } from '@/components/Practice/PracticeView'
import { TypeBars } from '@/components/Progress/TypeBars'
import { Button } from '@/components/ui/button'
import type { MockPaperView } from '@/content/mockPaper'
import { overall } from '@/exam/mock'
import { scoreUnit } from '@/exam/practice'
import { listeningType, readingType } from '@/exam/typeNames'
import type { MockAttempt, SectionState } from '@/practice/mockAttempt'
import { accuracyByType, emptyStore } from '@/practice/store'
import { fmt } from '@/practice/timer'
import { cn } from '@/utilities/ui'

const band = (v: number) => v.toFixed(1)

// 028 成绩单（contracts「成绩单」）：两科 Band、正确数、用时、两科平均（参考）、各题型正确率，可展开每科解析
export const MockReport: React.FC<{ attempt: MockAttempt; paper: MockPaperView; onRetry: () => void }> = ({ attempt, paper, onRetry }) => {
  const [open, setOpen] = useState<'l' | 'r' | null>(null)
  const reviewRef = useRef<HTMLElement>(null)
  // 展开解析后滚过去，不然解析在首屏下面，看起来像没反应
  useEffect(() => {
    if (open) reviewRef.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [open])
  const parts = [
    { key: 'l' as const, name: '听力', unit: paper.l, sec: attempt.l, typeName: listeningType, slug: 'listening' as const },
    { key: 'r' as const, name: '阅读', unit: paper.r, sec: attempt.r, typeName: readingType, slug: 'reading' as const },
  ]
  const types = useMemo(
    () =>
      parts.map((p) => {
        if (!p.sec) return []
        const store = emptyStore()
        store.records = [{ unitId: p.unit.id, at: 0, ...scoreUnit(p.unit, p.sec.answers) }]
        return accuracyByType(store, (t) => p.typeName[t]).sort((a, b) => a.correct / a.total - b.correct / b.total || a.label.localeCompare(b.label))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只随这一场变化
    [attempt, paper],
  )
  const l = attempt.l?.band
  const r = attempt.r?.band

  return (
    <div className="flex flex-col gap-8 py-8">
      <header className="container flex flex-col gap-2">
        <h1 className="text-[clamp(28px,3vw,40px)] leading-tight font-medium tracking-[-0.02em]">{paper.title} · 成绩</h1>
        <p className="text-sm text-muted-foreground">{new Date(attempt.startedAt).toLocaleString('zh-CN', { dateStyle: 'long', timeStyle: 'short' })}</p>
      </header>

      <div className="container grid gap-6 md:grid-cols-[1fr_1fr_auto]">
        {parts.map((p) => (
          <SectionCard key={p.key} name={p.name} sec={p.sec} testId={`band-${p.key}`} />
        ))}
        {typeof l === 'number' && typeof r === 'number' && (
          <div className="flex flex-col justify-end gap-1 border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className="text-sm text-muted-foreground">两科平均（参考）</p>
            <p className="text-[32px] leading-none font-medium tabular-nums" data-testid="band-avg">
              {band(overall(l, r))}
            </p>
          </div>
        )}
      </div>

      <div className="container grid gap-8 md:grid-cols-2">
        {parts.map((p, i) =>
          types[i].length ? (
            <section aria-label={`${p.name}各题型`} key={p.key}>
              <TypeBars rows={types[i]} slug={p.slug} />
            </section>
          ) : null,
        )}
      </div>

      <div className="container flex flex-wrap gap-3">
        {parts.map((p) => (
          <Button
            aria-expanded={open === p.key}
            key={p.key}
            onClick={() => setOpen((o) => (o === p.key ? null : p.key))}
            type="button"
            variant={open === p.key ? 'default' : 'outline'}
          >
            {open === p.key ? `收起${p.name}解析` : `查看${p.name}解析`}
          </Button>
        ))}
        <Button onClick={onRetry} type="button" variant="outline">
          再考一次
        </Button>
        <Link className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4" href="/mock">
          回到模考列表
        </Link>
      </div>

      {open && (
        <section aria-label={`${open === 'l' ? '听力' : '阅读'}解析`} className="scroll-mt-4 border-t border-border" ref={reviewRef}>
          <PracticeView
            key={open}
            review={{ answers: attempt[open]?.answers ?? {}, times: attempt[open]?.times }}
            unit={open === 'l' ? paper.l : paper.r}
          />
        </section>
      )}
    </div>
  )
}

const SectionCard: React.FC<{ name: string; sec?: SectionState; testId: string }> = ({ name, sec, testId }) => (
  <div className="flex flex-col gap-2 border-t-2 border-foreground pt-4">
    <p className="text-[15px] font-semibold">{name}</p>
    <p className={cn('text-[56px] leading-none font-medium tabular-nums', !sec && 'text-muted-foreground')} data-testid={testId}>
      {typeof sec?.band === 'number' ? band(sec.band) : '–'}
    </p>
    {sec && (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">答对</dt>
        <dd className="tabular-nums">
          {sec.score} / {sec.total}
        </dd>
        <dt className="text-muted-foreground">用时</dt>
        <dd className="tabular-nums">
          {fmt(Math.round(((sec.submittedAt ?? sec.deadline) - sec.startedAt) / 1000))}
          {sec.auto && <span className="ml-2 text-warning">到点自动交卷</span>}
        </dd>
      </dl>
    )}
  </div>
)
