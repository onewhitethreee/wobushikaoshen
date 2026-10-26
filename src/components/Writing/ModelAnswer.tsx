'use client'

import { ChevronDown } from 'lucide-react'
import React, { useState } from 'react'

import { bold } from '@/components/Practice/ExplainPanel'
import { cn } from '@/utilities/ui'

// 033 四 / 六级写作、翻译：范文、范文译文、解析，点开才显示（先自己写）。解析支持 **粗体**、"## " 小标题和换行
const Lines: React.FC<{ text: string; lang?: string }> = ({ text, lang }) => (
  <div className="flex flex-col gap-3 text-[16px] leading-7" lang={lang}>
    {text
      .split('\n')
      .filter((l) => l.trim())
      .map((l, i) =>
        // 解析里用 "## " 开头的行当小标题
        l.startsWith('## ') ? (
          <h3 className="pt-2 text-[15px] font-semibold" key={i}>
            {bold(l.slice(3))}
          </h3>
        ) : (
          <p key={i}>{bold(l)}</p>
        ),
      )}
  </div>
)

export const ModelAnswer: React.FC<{ answer?: string | null; answerZh?: string | null; analysis?: string | null }> = ({ answer, answerZh, analysis }) => {
  const [open, setOpen] = useState(false)
  if (!answer && !analysis) return null
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <button
        aria-controls="model-answer"
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-semibold underline-offset-4 hover:underline"
        data-testid="model-answer-toggle"
        onClick={() => setOpen(!open)}
        type="button"
      >
        看范文和解析
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex flex-col gap-6" data-testid="model-answer" id="model-answer">
          {answer && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[17px] font-medium">范文</h2>
              <Lines lang="en" text={answer} />
            </section>
          )}
          {answerZh && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[17px] font-medium">范文译文</h2>
              <div className="text-muted-foreground">
                <Lines text={answerZh} />
              </div>
            </section>
          )}
          {analysis && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[17px] font-medium">解析</h2>
              <Lines text={analysis} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
