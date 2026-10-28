'use client'

import React from 'react'

import { groupNumbers, type PracticeUnit, type ScoreItem } from '@/exam/practice'
import { beatPercent, useStatsList } from '@/practice/statClient'
import { cn } from '@/utilities/ui'

// 035 成绩面板下的"本单元平均得分率 · 你超过了 X% 的考生"（contracts/ui.md、FR-015）。
// 模考整卷的每个 section 是一个来源单元，按 section 各一行；不到 20 人、失败、加载中都不显示
const partsOf = (unit: PracticeUnit, items: ScoreItem[]) => {
  const correct = new Set(items.filter((i) => i.correct).map((i) => i.number))
  if (unit.source !== 'mock') return [{ id: unit.id, label: '', score: correct.size }]
  return unit.sections.map((s) => {
    const nums = s.groups.flatMap(groupNumbers)
    return { id: s.groups[0]?.key.replace(/-g\d+$/, '') ?? '', label: s.label, score: nums.filter((n) => correct.has(n)).length }
  })
}

export const UnitStatLines: React.FC<{ unit: PracticeUnit; items: ScoreItem[]; className?: string }> = ({ unit, items, className }) => {
  const parts = partsOf(unit, items)
  const stats = useStatsList(
    parts.map((p) => p.id),
    true,
  )
  const lines = parts.flatMap((p, i) => {
    const u = stats[i]?.unit
    return u ? [{ ...p, avg: Math.round(u.avgRate * 100), beat: beatPercent(u.dist, p.score) }] : []
  })
  if (!lines.length) return null
  return (
    <div className={cn('flex flex-col gap-0.5 text-[14px] text-muted-foreground tabular-nums', className)} data-testid="unit-stat">
      {lines.map((l) => (
        <p key={l.id}>
          {l.label && <span className="font-semibold text-foreground">{l.label} </span>}
          本单元平均得分率 {l.avg}% · 你超过了 {l.beat}% 的考生
        </p>
      ))}
    </div>
  )
}
