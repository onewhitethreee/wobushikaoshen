import React from 'react'

import type { TranscriptLine } from '@/exam/practice'
import { cn } from '@/utilities/ui'

import { sentenceRange } from './PassageView'

/** "Speaker 2" → "说话人 3"；其他写法原样显示 */
const speakerName = (s: string) => s.replace(/^Speaker (\d+)$/i, (_, n) => `说话人 ${Number(n) + 1}`)

// 听力原文（导入的练习单元）：按句渲染（#s{n}），换说话人时另起一行；播报语用弱文字色。
// highlight 为 "s{n}[-m]" 时高亮出处句（"在原文中定位"）；current 为正在播放的句子（004 跟随播放），onPick 点句从该句播放
export const TranscriptView: React.FC<{ lines: TranscriptLine[]; highlight?: string; current?: number; onPick?: (n: number) => void }> = ({
  lines,
  highlight,
  current,
  onPick,
}) => {
  const range = sentenceRange(highlight)
  // 连续同一说话人的句子合成一段
  const turns: TranscriptLine[][] = []
  for (const l of lines) {
    const last = turns[turns.length - 1]
    if (last && last[0].speaker === l.speaker) last.push(l)
    else turns.push([l])
  }
  return (
    <div className="flex flex-col gap-3">
      {turns.map((t) => (
        <p key={t[0].n}>
          {t[0].speaker && <b className="mr-2 font-sans text-[12px] font-semibold text-muted-foreground">{speakerName(t[0].speaker)}</b>}
          {t.map((l) => {
            const on = range !== null && l.n >= range[0] && l.n <= range[1]
            const playing = current === l.n
            return (
              <React.Fragment key={l.n}>
                <span
                  className={cn(
                    'scroll-mt-40 rounded-sm transition-[background-color] duration-300',
                    l.announce && 'text-muted-foreground',
                    playing && 'bg-primary-soft underline decoration-mark decoration-2 underline-offset-4',
                    on && 'bg-warning-soft',
                    onPick && 'cursor-pointer hover:underline hover:decoration-border hover:underline-offset-4',
                  )}
                  data-current={playing || undefined}
                  data-highlight={on || undefined}
                  id={`s${l.n}`}
                  // 只响应点击：键盘用 ← → 按句跳转，不给几十句原文各一个 Tab 停靠点
                  {...(onPick && { title: '从这句开始播放', onClick: () => getSelection()?.isCollapsed !== false && onPick(l.n) })}
                >
                  {l.text}
                </span>{' '}
              </React.Fragment>
            )
          })}
        </p>
      ))}
    </div>
  )
}
