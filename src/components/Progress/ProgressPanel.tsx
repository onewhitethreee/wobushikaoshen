'use client'

import { ArrowUpRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'

import type { LookupItem } from '@/endpoints/lookup'
import { EXAM_NAME, type Cet } from '@/exam/cet'
import { listeningType, readingType } from '@/exam/typeNames'
import { progressOf, type Progress } from '@/practice/progress'
import { load } from '@/practice/store'
import { STORE_EVENT, sync } from '@/practice/syncClient'
import { fmt } from '@/practice/timer'
import { cn } from '@/utilities/ui'

import { LineChart } from './LineChart'
import { TypeBars } from './TypeBars'

// 一科的进步区块（021 contracts/ui.md）：数字行、每次正确率、整套 Band、各题型正确率。
// foldable：栏目页用，可收起、没有记录时不显示
// exam（033）：四 / 六级一条正确率曲线，听力阅读合在一起，没有 Band 和题型条
const FOLD_KEY = 'ybz:progress-fold:v1'
const NAME = { listening: '听力', reading: '阅读' }

const readFold = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(FOLD_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

const when = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const pct = (v: number) => `${Math.round(v * 100)}%`
const band = (v: number) => v.toFixed(1).replace(/\.0$/, '')

const Kpi: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex min-w-[7.5rem] flex-col gap-0.5">
    <span className="text-[13px] text-muted-foreground">{label}</span>
    <span className="text-[22px] leading-tight font-semibold">{children}</span>
  </div>
)

type Props = { foldable?: boolean } & ({ module: 'listening' | 'reading'; exam?: undefined } | { exam: Cet; module?: undefined })

export const ProgressPanel: React.FC<Props> = ({ module = 'reading', exam, foldable }) => {
  const key = exam ?? module
  const name = exam ? EXAM_NAME[exam] : NAME[module]
  const [p, setP] = useState<Progress | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [folded, setFolded] = useState(false)

  useEffect(() => {
    const names = module === 'listening' ? listeningType : readingType
    const read = () => setP(progressOf(load().store.records, module, (t) => names[t] ?? t, exam))
    read()
    if (foldable) setFolded(Boolean(readFold()[key]))
    window.addEventListener(STORE_EVENT, read)
    void sync() // 已登录时先取回其他设备的记录（同步完会触发 STORE_EVENT）
    return () => window.removeEventListener(STORE_EVENT, read)
  }, [module, exam, key, foldable])

  // 提示里的单元标题：按 20 个一批查，查不到写"已下架"
  const ids = useMemo(() => [...new Set(p?.points.map((x) => x.unitId) ?? [])].filter((id) => !(id in titles)), [p, titles])
  useEffect(() => {
    if (!ids.length) return
    let alive = true
    const batches = Array.from({ length: Math.ceil(ids.length / 20) }, (_, i) => ids.slice(i * 20, i * 20 + 20))
    void Promise.all(
      batches.map((b) =>
        fetch(`/api/practice/lookup?ids=${encodeURIComponent(b.join(','))}`)
          .then((r) => r.json() as Promise<{ items?: Record<string, LookupItem> }>)
          .then((d) => Object.fromEntries(b.map((id) => [id, d.items?.[id] && !d.items[id].gone ? (d.items[id] as { title: string }).title : '已下架'])))
          .catch(() => Object.fromEntries(b.map((id) => [id, id]))),
      ),
    ).then((parts) => alive && setTitles((t) => Object.assign({}, t, ...parts)))
    return () => {
      alive = false
    }
  }, [ids])

  if (!p) return null
  // 四 / 六级没做过就不占位置（雅思考生在 /me/progress 不会看到两块空面板）
  if (!p.count && (foldable || exam)) return null

  const toggle = () => {
    const next = !folded
    setFolded(next)
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify({ ...readFold(), [key]: next }))
    } catch {
      // 记不住只是下次展开
    }
  }

  const title = (
    <h2 className="text-[20px] font-medium">{foldable ? '我的进步' : name}</h2>
  )

  if (!p.count)
    return (
      <section className="flex flex-col gap-3 border-t border-border pt-6" data-testid={`progress-${key}`}>
        {title}
        <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-muted-foreground">
          还没有交过{name}卷。
          <Link className="inline-flex min-h-11 items-center gap-1 font-semibold text-foreground underline-offset-4 hover:underline" href={`/${key}`}>
            去练习 <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </section>
    )

  const tip = (i: number) => {
    const x = p.points[i]
    return `${when(x.at)} · ${titles[x.unitId] ?? x.unitId} · 答对 ${x.score} / ${x.total}（${pct(x.pct)}）${x.duration ? ` · 用时 ${fmt(x.duration)}` : ''}`
  }
  const arrow = p.delta === null ? '' : p.delta > 0 ? '↑ +' : p.delta < 0 ? '↓ −' : '→ '

  return (
    <section className={cn('flex flex-col gap-5', !foldable && 'border-t border-border pt-6')} data-testid={`progress-${key}`}>
      <div className="flex items-center justify-between gap-4">
        {title}
        {foldable && (
          <button
            aria-expanded={!folded}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            data-testid="progress-fold"
            onClick={toggle}
            type="button"
          >
            {folded ? '展开' : '收起'}
            <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', !folded && 'rotate-180')} />
          </button>
        )}
      </div>

      {!folded && (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-3" data-testid="progress-kpis">
            <Kpi label="交卷">{p.count} 次</Kpi>
            {p.recent !== null && (
              <Kpi label={`最近 ${Math.min(5, p.count)} 次正确率`}>
                {pct(p.recent)}
                {p.delta !== null && (
                  <span className="ml-2 text-[14px] font-normal text-muted-foreground" data-testid="progress-delta" title="与之前 5 次相比">
                    {arrow}
                    {Math.abs(p.delta)}%
                  </span>
                )}
              </Kpi>
            )}
            {p.lastBand !== null && <Kpi label="最近整套 Band">{band(p.lastBand)}</Kpi>}
            {p.secPerQ !== null && <Kpi label="平均每题用时">{fmt(p.secPerQ)}</Kpi>}
          </div>

          <LineChart
            avg={p.points.map((x) => x.avg)}
            columns={['次序', '时间', '内容', '答对', '正确率', '最近 5 次平均']}
            endLabel={pct(p.points[p.points.length - 1].avg)}
            fmtY={pct}
            label="每次正确率"
            points={p.points.map((x, i) => ({
              y: x.pct,
              tip: tip(i),
              cells: [String(p.count - p.points.length + i + 1), when(x.at), titles[x.unitId] ?? x.unitId, `${x.score} / ${x.total}`, pct(x.pct), pct(x.avg)],
            }))}
            testid="chart-accuracy"
            yMax={1}
            yTicks={[0, 0.5, 1]}
          />
          {p.truncated && <p className="-mt-3 text-[13px] text-muted-foreground">只显示最近 60 次</p>}

          {p.bands.length >= 2 && (
            <LineChart
              columns={['次序', '时间', '内容', '得分', 'Band']}
              endLabel={band(p.bands[p.bands.length - 1].band)}
              fmtY={band}
              label="整套 Band"
              points={p.bands.map((b, i) => ({
                y: b.band,
                tip: `${when(b.at)} · ${titles[b.unitId] ?? b.unitId} · ${b.score} / 40 · Band ${band(b.band)}`,
                cells: [String(i + 1), when(b.at), titles[b.unitId] ?? b.unitId, `${b.score} / 40`, band(b.band)],
              }))}
              testid="chart-band"
              yMax={9}
              yTicks={[0, 3, 6, 9]}
            />
          )}

          {!exam && p.types.length > 0 && <TypeBars rows={p.types} slug={module} />}
        </>
      )}
    </section>
  )
}
