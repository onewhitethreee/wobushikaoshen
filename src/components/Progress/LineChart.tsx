'use client'

import React, { useEffect, useRef, useState } from 'react'

// 折线图（021 research R1–R3）：手写 SVG。有 avg 时为"每次一个灰点 + 墨色平均线"，没有时为单系列墨色折线。
// 悬停吸附到最近一次、每个点可用键盘聚焦，提示框只是补充，"查看数据表"给出全部数值
export type ChartPoint = { y: number; tip: string; cells: string[] }

const H = 200
const M = { top: 14, right: 64, bottom: 28, left: 44 }

export const LineChart: React.FC<{
  testid: string
  label: string
  points: ChartPoint[]
  avg?: number[]
  yMax: number
  yTicks: number[]
  fmtY: (v: number) => string
  endLabel?: string
  columns: string[]
}> = ({ testid, label, points, avg, yMax, yTicks, fmtY, endLabel, columns }) => {
  const box = useRef<HTMLDivElement>(null)
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const [w, setW] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = points.length
  const plotW = w - M.left - M.right
  const plotH = H - M.top - M.bottom
  const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const y = (v: number) => M.top + plotH - (Math.min(Math.max(v, 0), yMax) / yMax) * plotH
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const series = avg ?? points.map((p) => p.y)
  const lastY = y(series[n - 1] ?? 0)

  // 鼠标移动、触屏点一下都吸附到最近的一次（触屏轻点通常不触发 pointermove）
  const nearest = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const px = e.clientX - r.left
    setActive(n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round(((px - M.left) / plotW) * (n - 1)))))
  }
  const onKey = (i: number) => (e: React.KeyboardEvent) => {
    const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null
    if (to === null || to < 0 || to >= n) return
    e.preventDefault()
    dots.current[to]?.focus()
  }

  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active) - 110, 0), w - 220)

  return (
    <figure className="flex flex-col gap-2" data-testid={testid}>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[14px]">
        <span className="font-medium">{label}</span>
        {avg && (
          <span aria-hidden="true" className="flex items-center gap-4 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <svg className="size-2.5" viewBox="0 0 10 10">
                <circle cx="5" cy="5" fill="var(--muted-foreground)" r="4" />
              </svg>
              每次
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-2.5 w-4" viewBox="0 0 16 10">
                <path d="M1 5H15" stroke="var(--foreground)" strokeLinecap="round" strokeWidth="2" />
              </svg>
              最近 5 次平均
            </span>
          </span>
        )}
      </figcaption>

      <div className="relative" ref={box}>
        {/* role="group"：里面的数据点可以聚焦，role="img" 会让读屏把它们当装饰（audit P1） */}
        <svg aria-label={label} className="block w-full overflow-visible" height={H} role="group" width={w}>
          {yTicks.map((t) => (
            <g key={t}>
              <line stroke="var(--border)" strokeWidth="1" x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="fill-muted-foreground text-[11px] tabular-nums" dominantBaseline="middle" textAnchor="end" x={M.left - 8} y={y(t)}>
                {fmtY(t)}
              </text>
            </g>
          ))}
          <text className="fill-muted-foreground text-[11px]" x={M.left} y={H - 6}>
            第 1 次
          </text>
          {n > 1 && (
            <text className="fill-muted-foreground text-[11px]" textAnchor="end" x={M.left + plotW} y={H - 6}>
              第 {n} 次
            </text>
          )}

          {active !== null && <line stroke="var(--muted-foreground)" strokeWidth="1" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} />}

          {avg ? (
            <>
              {points.map((p, i) => (
                <circle cx={x(i)} cy={y(p.y)} fill="var(--muted-foreground)" key={i} r={active === i ? 5 : 4} stroke="var(--background)" strokeWidth="2" />
              ))}
              {n > 1 && <path d={line(avg)} fill="none" stroke="var(--foreground)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />}
            </>
          ) : (
            <>
              {n > 1 && <path d={line(series)} fill="none" stroke="var(--foreground)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />}
              {points.map((p, i) => (
                <circle cx={x(i)} cy={y(p.y)} fill="var(--foreground)" key={i} r={active === i ? 5 : 4} stroke="var(--background)" strokeWidth="2" />
              ))}
            </>
          )}
          {endLabel && (
            <text className="fill-foreground text-[13px] font-semibold" dominantBaseline="middle" x={x(n - 1) + 10} y={lastY}>
              {endLabel}
            </text>
          )}

          <rect
            fill="transparent"
            height={plotH}
            onPointerDown={nearest}
            // 触屏抬手后浏览器会立刻发 pointerleave，不清掉提示，留到下一次点
            onPointerLeave={(e) => e.pointerType !== 'touch' && setActive(null)}
            onPointerMove={nearest}
            width={plotW + 24}
            x={M.left - 12}
            y={M.top}
          />
          {points.map((p, i) => (
            <circle
              aria-label={p.tip}
              className="cursor-pointer outline-none focus-visible:stroke-foreground"
              cx={x(i)}
              cy={y(p.y)}
              data-testid="chart-point"
              fill="transparent"
              key={i}
              onBlur={() => setActive(null)}
              onFocus={() => setActive(i)}
              onKeyDown={onKey(i)}
              onPointerEnter={() => setActive(i)}
              r="12"
              ref={(el) => {
                dots.current[i] = el
              }}
              strokeWidth="2"
              tabIndex={0}
            />
          ))}
        </svg>
        {active !== null && points[active] && (
          <p
            className="pointer-events-none absolute top-0 w-[220px] border border-border bg-background px-3 py-2 text-[13px] leading-5 shadow-sm"
            data-testid="chart-tip"
            role="tooltip"
            style={{ left: tipLeft }}
          >
            {points[active].tip}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button className="inline-flex min-h-11 items-center text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setTable((t) => !t)} type="button">
          {table ? '收起数据表' : '查看数据表'}
        </button>
      </div>
      {table && (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {columns.map((c) => (
                  <th className="px-2 py-1.5 font-normal" key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr className="border-b border-border" key={i}>
                  {p.cells.map((c, j) => (
                    <td className="px-2 py-1.5" key={j}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
