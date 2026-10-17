'use client'

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair, X } from 'lucide-react'
import React from 'react'

import { FavoriteButton } from '@/components/Account/FavoriteButton'
import type { Answers, GroupView, ScoreItem } from '@/exam/practice'
import { cn } from '@/utilities/ui'

import { AiExplain } from './AiExplain'
import { locateLabel, resultOf, Verdict, type Question } from './QuestionGroup'

// 交卷后的解析面板（008 contracts/result-panel.md）：一次一道题，上一题 / 下一题连续翻。
// 放在页面底部的固定条里、题号条上方：电脑端（lg）常驻题目栏下方、可收起；手机端点开才出现、可关闭
/** 解析里的 **重点** 显示为粗体（导入数据用 Markdown 星号标重点） */
export const bold = (text: string) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <b className="font-semibold text-foreground" key={i}>
        {part}
      </b>
    ) : (
      part
    ),
  )

const navBtn = 'inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold hover:bg-muted disabled:pointer-events-none disabled:opacity-40'

export const ExplainPanel: React.FC<{
  unitId: string
  group: GroupView
  q: Question
  answer: Answers[number] | undefined
  items: ScoreItem[]
  /** 手机端是否弹出；电脑端始终显示 */
  open: boolean
  collapsed: boolean
  onPrev?: () => void
  onNext?: () => void
  onLocate: (target: string) => void
  onToggle: () => void
  onClose: () => void
  ref?: React.Ref<HTMLElement>
}> = ({ unitId, group, q, answer, items, open, collapsed, onPrev, onNext, onLocate, onToggle, onClose, ref }) => {
  const r = resultOf(group, q, answer, items)
  const label = locateLabel(group, q)
  const nums = q.span > 1 ? `${q.number}–${q.number + q.span - 1}` : String(q.number)
  return (
    <section
      aria-label={`第 ${nums} 题解析`}
      className={cn(
        open ? 'flex' : 'hidden lg:flex',
        'pointer-events-auto max-h-[70vh] flex-col border border-border bg-card outline-none lg:max-h-[50vh]',
      )}
      data-testid="explain-panel"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      ref={ref}
      role="region"
      tabIndex={-1}
    >
      <header className="flex items-center gap-1 border-b border-border px-3 py-1">
        <span className="pl-1 text-sm font-semibold tabular-nums">第 {nums} 题</span>
        <FavoriteButton className="mr-auto" favKey={`q:${group.key}#${q.number}`} />
        <button aria-label="上一题" className={navBtn} disabled={!onPrev} onClick={onPrev} type="button">
          <ChevronLeft aria-hidden="true" className="size-4" />
          上一题
        </button>
        <button aria-label="下一题" className={navBtn} disabled={!onNext} onClick={onNext} type="button">
          下一题
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
        <button aria-expanded={!collapsed} className={cn(navBtn, 'hidden lg:inline-flex')} onClick={onToggle} type="button">
          {collapsed ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          {collapsed ? '展开' : '收起'}
        </button>
        <button aria-label="关闭" className={cn(navBtn, 'min-w-11 justify-center lg:hidden')} onClick={onClose} type="button">
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className={cn('flex flex-col gap-2 overflow-y-auto px-4 py-3 text-sm', collapsed && 'lg:hidden')}>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Verdict ok={r.ok} text={r.verdict} />
          {r.multi && (
            <span className="tabular-nums">
              得 {r.credit} / {q.span} 分
            </span>
          )}
          <span className="min-w-0 break-words">
            <span className="text-muted-foreground">你的答案：</span>
            {r.given}
          </span>
          <span className="min-w-0 break-words">
            <span className="text-muted-foreground">答案：</span>
            <b>{r.answer}</b>
          </span>
        </p>
        {q.explanation && <p className="whitespace-pre-line text-muted-foreground">{bold(q.explanation)}</p>}
        {q.tip && (
          <p className="whitespace-pre-line text-muted-foreground">
            <b className="font-semibold text-foreground">易错点</b> {bold(q.tip)}
          </p>
        )}
        {!q.explanation && !q.tip && <p className="text-muted-foreground">这道题暂无解析</p>}
        {label && (
          <button
            className="inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-2 font-semibold text-primary-text hover:bg-muted"
            onClick={() => onLocate(label)}
            type="button"
          >
            <Crosshair aria-hidden="true" className="size-4" strokeWidth={1.5} />
            在原文中定位
          </button>
        )}
        {!r.ok && <AiExplain answer={answer} key={q.number} number={q.number} unitId={unitId} />}
      </div>
    </section>
  )
}
