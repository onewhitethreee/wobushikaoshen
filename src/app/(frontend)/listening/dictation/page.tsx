import type { Metadata } from 'next'
import Link from 'next/link'

import React from 'react'

import { DictationView, type DictationData } from '@/components/Dictation/DictationView'
import { getPracticeUnit } from '@/content/practiceUnit'
import { parseUnitId } from '@/exam/practice'

export const metadata: Metadata = { title: '精听 / 听写', robots: { index: false, follow: false } }

// 023 精听 / 听写：服务端取逐句原文、音频和各句关联的答案词，交给客户端（research R4：交卷检查在客户端）
const load = async (u: string | undefined): Promise<DictationData | string> => {
  const p = u ? parseUnitId(u) : null
  if (!p || p.kind !== 'unit') return '没找到这个听力 Part。'
  const unit = await getPracticeUnit(`u${p.docId}`)
  const s = unit?.module === 'listening' ? unit.sections[0] : undefined
  if (!unit || !s?.audioUrl) return '没找到这个听力 Part。'
  const lines = (Array.isArray(s.transcript) ? s.transcript : [])
    .filter((l) => !l.announce && typeof l.start === 'number' && typeof l.end === 'number' && l.text.trim())
    .sort((a, b) => a.start! - b.start!)
    .map((l) => ({ n: l.n, text: l.text, start: l.start!, end: l.end! }))
  if (!lines.length) return '这个 Part 没有逐句音频，不能听写。'
  const answers: Record<number, string[]> = {}
  for (const g of s.groups)
    for (const q of g.questions) {
      const m = q.evidence ? /^(\d+)(?:-(\d+))?$/.exec(q.evidence) : null
      if (!m) continue
      for (let n = Number(m[1]); n <= Number(m[2] ?? m[1]); n++) (answers[n] ??= []).push(q.answers)
    }
  return { unitId: `u${p.docId}`, title: unit.title, audioUrl: s.audioUrl, lines, answers }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ u?: string; n?: string; mode?: string }> }) {
  const { u, n, mode } = await searchParams
  const data = await load(u)
  return (
    <section className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <nav aria-label="当前位置" className="text-[13px] text-muted-foreground">
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
              首页
            </Link>{' '}
            /{' '}
            <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/listening">
              听力
            </Link>{' '}
            / 精听 / 听写
          </nav>
          <h1 className="text-[30px] font-medium tracking-[-0.02em]">精听 / 听写</h1>
        </div>
        {typeof data === 'string' ? (
          <p className="text-[15px] text-muted-foreground">{data}</p>
        ) : (
          <DictationView data={data} initialMode={mode === 'blank' ? 'blank' : 'full'} key={data.unitId} start={Number(n) || undefined} />
        )}
      </div>
    </section>
  )
}
