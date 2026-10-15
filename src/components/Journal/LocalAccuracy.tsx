'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { parseUnitId } from '@/exam/practice'
import type { QuestionType } from '@/exam/scoring'
import { EmptyChartArt } from '@/components/Illustration'
import { accuracyByType, load } from '@/practice/store'
import { STORE_EVENT } from '@/practice/syncClient'

type Row = { label: string; percent: number; href: string }

// 侧栏"我的正确率"：读本机记录，按栏目的题型短名汇总（FR-052、FR-053）
export const LocalAccuracy: React.FC<{ slug: 'listening' | 'reading'; typeNames: Record<QuestionType, string> }> = ({ slug, typeNames }) => {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const read = () => {
      const { store } = load()
      const m = slug === 'listening' ? 'l' : 'r'
      store.records = store.records.filter((r) => {
        const p = parseUnitId(r.unitId)
        return (r.module ?? (p?.kind === 'test' ? p.module : undefined)) === m
      })
      setRows(
        accuracyByType(store, (t) => typeNames[t] ?? t).map((s) => ({
          label: s.label,
          percent: Math.round((s.correct / s.total) * 100),
          href: `/${slug}?tab=type&type=${encodeURIComponent(s.label)}&status=${encodeURIComponent('未做')}`,
        })),
      )
    }
    read()
    window.addEventListener(STORE_EVENT, read)
    return () => window.removeEventListener(STORE_EVENT, read)
  }, [slug, typeNames])

  if (!rows.length)
    return (
      <div className="flex items-center gap-4">
        <EmptyChartArt className="w-24 shrink-0" />
        <p className="text-sm text-muted-foreground">做完第一组题，这里会按题型显示你的正确率，告诉你先补哪一块。</p>
      </div>
    )

  const lowest = Math.min(...rows.map((r) => r.percent))
  const weakest = rows.find((r) => r.percent === lowest)!
  return (
    <>
      <ul className="flex flex-col" data-testid="local-accuracy">
        {rows.map((r) => {
          const weak = r === weakest
          return (
            <li key={r.label}>
              <Link
                className="-mx-2 grid min-h-11 grid-cols-[88px_1fr_44px] items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
                href={r.href}
                title={`只看没做过的${r.label}`}
              >
                <span>{r.label}</span>
                <span className="relative block h-1.5 overflow-hidden bg-border">
                  <span
                    className={`absolute inset-y-0 left-0 origin-left animate-[grow_.8s_var(--ease-out-expo)_backwards] ${weak ? 'bg-sun' : 'bg-mark'}`}
                    style={{ width: `${r.percent}%` }}
                  />
                </span>
                <span className={`text-right tabular-nums ${weak ? 'font-bold text-warning' : ''}`}>{r.percent}%</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {rows.length > 1 && (
        <Link className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline underline-offset-4" href={weakest.href}>
          {weakest.label}最弱，去练没做过的
          <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
        </Link>
      )}
      <p className="mt-2 text-xs text-muted-foreground">记录保存在本机，换设备或清缓存会丢失</p>
    </>
  )
}
