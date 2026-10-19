'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'

import { cn } from '@/utilities/ui'

// 各题型正确率横条（021 research R2）：升序，最弱一条用 warning（sun 在浅色背景上对比度只有 1.58:1），条尾写百分比和题数
type Row = { label: string; correct: number; total: number }

export const TypeBars: React.FC<{ rows: Row[]; slug: 'listening' | 'reading' }> = ({ rows, slug }) => {
  const [table, setTable] = useState(false)
  const href = (label: string) => `/${slug}?tab=type&type=${encodeURIComponent(label)}&status=${encodeURIComponent('未做')}`
  const pct = (r: Row) => Math.round((r.correct / r.total) * 100)
  const weakest = rows[0]

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-[14px] font-medium">各题型正确率</figcaption>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li
            className="grid min-h-8 grid-cols-[5.5em_1fr_auto] items-center gap-3 text-[14px]"
            data-testid="type-bar"
            key={r.label}
            title={`${r.label} · 答对 ${r.correct} / ${r.total}`}
          >
            <span className="truncate">{r.label}</span>
            <span className="relative block h-3">
              <span
                className={cn('absolute inset-y-0 left-0', rows.length > 1 && r === weakest ? 'bg-warning' : 'bg-mark')}
                style={{ width: `max(${pct(r)}%, 2px)` }}
              />
            </span>
            <span className="text-right text-[13px] text-muted-foreground tabular-nums">
              <b className="font-semibold text-foreground">{pct(r)}%</b> · {r.total} 题{r.total < 5 ? '（题少，仅供参考）' : ''}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {rows.length > 1 ? (
          <Link className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline" href={href(weakest.label)}>
            {weakest.label}最弱，去练没做过的
            <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
          </Link>
        ) : (
          <span />
        )}
        <button className="inline-flex min-h-11 items-center text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setTable((t) => !t)} type="button">
          {table ? '收起数据表' : '查看数据表'}
        </button>
      </div>
      {table && (
        <table className="w-full text-left text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-1.5 font-normal" scope="col">题型</th>
              <th className="px-2 py-1.5 font-normal" scope="col">答对</th>
              <th className="px-2 py-1.5 font-normal" scope="col">题数</th>
              <th className="px-2 py-1.5 font-normal" scope="col">正确率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-b border-border" key={r.label}>
                <td className="px-2 py-1.5">{r.label}</td>
                <td className="px-2 py-1.5">{r.correct}</td>
                <td className="px-2 py-1.5">{r.total}</td>
                <td className="px-2 py-1.5">{pct(r)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}
