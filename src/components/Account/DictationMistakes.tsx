'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import type { LookupItem } from '@/endpoints/lookup'
import type { DictEntry } from '@/practice/store'

// 错题本"听写"分组（023 contracts/ui.md）：原句、我写的、所在 Part、再听写
const when = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const DictationMistakes: React.FC<{ entries: DictEntry[]; state: 'wrong' | 'mastered' }> = ({ entries, state }) => {
  const [titles, setTitles] = useState<Record<string, string>>({})
  const ids = [...new Set(entries.map((e) => e.unitId))].filter((id) => !(id in titles)).slice(0, 20).join(',')

  useEffect(() => {
    if (!ids) return
    fetch(`/api/practice/lookup?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((d: { items?: Record<string, LookupItem> }) =>
        setTitles((cur) => ({
          ...cur,
          ...Object.fromEntries(ids.split(',').map((id) => [id, d.items?.[id] && !d.items[id].gone ? (d.items[id] as { title: string }).title : '已下架'])),
        })),
      )
      .catch(() => {})
  }, [ids])

  if (!entries.length)
    return (
      <p className="py-10 text-[15px] text-muted-foreground">
        {state === 'wrong' ? '听写时写错的句子会出现在这里。交卷后在听力音频条点"精听 / 听写"开始。' : '听写错过、后来写对的句子会出现在这里。'}
      </p>
    )

  return (
    <ul className="border-t border-border">
      {entries.map((e) => (
        <li className="flex flex-col gap-2 border-b border-border py-4" data-testid="dict-row" key={`${e.unitId}#${e.n}#${e.mode}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">
              {titles[e.unitId] ?? '…'} · {e.mode === 'blank' ? '挖空' : '整句'} · {when(e.at)}
            </span>
            <Link
              className="inline-flex min-h-11 items-center gap-1 border-[1.5px] border-foreground px-4 text-sm font-semibold hover:bg-primary hover:text-primary-foreground"
              href={`/listening/dictation?u=${e.unitId}&n=${e.n}${e.mode === 'blank' ? '&mode=blank' : ''}`}
            >
              再听写 <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <p className="text-[16px] leading-7">{e.text}</p>
          <p className="text-[14px] text-muted-foreground">
            我写的：<span className="text-foreground">{e.input || '（空）'}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}
