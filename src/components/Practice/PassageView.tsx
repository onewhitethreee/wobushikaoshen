import React from 'react'

import type { Section } from '@/exam/practice'
import { cn } from '@/utilities/ui'

/** "s10-16" / "s7" → [10, 16] / [7, 7]；段落字母返回 null */
export const sentenceRange = (target?: string): [number, number] | null => {
  const m = /^s(\d+)(?:-(\d+))?$/.exec(target ?? '')
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null
}

// 阅读原文：段落带字母锚点 #para-{label}；导入的单元按句渲染（#s{n}）。
// 交卷后"在原文中定位"：highlight 是段落字母（高亮整段）或 "s{n}[-m]"（高亮这些句子）
export const PassageView: React.FC<{ passage: NonNullable<Section['passage']>; highlight?: string }> = ({ passage, highlight }) => {
  const range = sentenceRange(highlight)
  return (
    <article className="bg-muted px-4 py-6 sm:px-7">
      {passage.title && <h2 className="mb-4 font-bold tracking-tight text-[26px] leading-snug text-balance">{passage.title}</h2>}
      {passage.imageUrl && (
        <a className="mb-4 block" href={passage.imageUrl} rel="noreferrer" target="_blank" title="点开看大图">
          {/* 媒体直连原地址，不走 next/image 的服务端转发 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="文章配图" className="max-h-[360px] w-auto max-w-full rounded-xl border border-border" loading="lazy" src={passage.imageUrl} />
        </a>
      )}
      <div className="flex max-w-[68ch] flex-col gap-1 text-[16px] leading-[1.75]">
        {passage.paragraphs.map((p, i) => (
          <p
            className={cn(
              'scroll-mt-24 -mx-2.5 rounded-lg px-2.5 py-1.5 transition-[background-color] duration-500',
              p.label && p.label === highlight && 'bg-warning-soft',
            )}
            data-highlight={p.label === highlight || undefined}
            id={p.label ? `para-${p.label}` : undefined}
            key={i}
          >
            {p.label && (
              <b className="mr-2 inline-flex size-6 items-center justify-center bg-muted align-[2px] font-sans text-[12px] text-foreground">
                {p.label}
              </b>
            )}
            {p.sentences?.length
              ? p.sentences.map((s) => {
                  const on = range !== null && s.n >= range[0] && s.n <= range[1]
                  return (
                    <React.Fragment key={s.n}>
                      <span
                        className={cn('scroll-mt-24 transition-[background-color] duration-500', on && 'bg-warning-soft')}
                        data-highlight={on || undefined}
                        id={`s${s.n}`}
                      >
                        {s.text}
                      </span>{' '}
                    </React.Fragment>
                  )
                })
              : p.text}
          </p>
        ))}
      </div>
    </article>
  )
}
