import React from 'react'

import { ASPECTS, levelOf, reportScore, type CetReview } from '@/review/cet'

// 034 四 / 六级批改结果（contracts/api-ui.md）：写作页批改区与详情页共用。分数 15 分制 + 档位 + 约合报道分
export type CetReviewView = {
  score: number
  cet: CetReview
  paragraphs: { index: number; comment: string }[]
  rewrites: { original: string; revised: string; why: string }[]
  lengthNote: string
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-[18px] font-medium">{title}</h2>
    {children}
  </section>
)

export const CetReviewResult: React.FC<{ review: CetReviewView }> = ({ review }) => {
  const { score, cet } = review
  return (
    <div className="flex flex-col gap-8" data-testid="cet-review-result">
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[44px] leading-none font-medium tabular-nums" data-testid="cet-review-score">
            {score} 分
          </span>
          <span className="text-[18px] font-medium">第 {levelOf(score)} 档</span>
          <span className="text-[15px] text-muted-foreground tabular-nums">约合报道分 {reportScore(score)} / 106.5</span>
        </p>
        <p className="text-[13px] text-muted-foreground">满分 15 分，AI 估分，仅供参考</p>
        <p className="text-[15px] leading-7">{cet.reason}</p>
        {review.lengthNote && <p className="bg-warning-soft px-4 py-2.5 text-[15px] leading-7 text-warning">{review.lengthNote}</p>}
      </div>

      {cet.aspects && (
        <dl className="grid gap-px bg-border sm:grid-cols-3">
          {ASPECTS.map(({ key, label }) => (
            <div className="flex min-w-0 flex-col gap-1.5 bg-background p-4" key={key}>
              <dt className="text-[13px] leading-5 text-muted-foreground">{label}</dt>
              <dd className="text-[14px] leading-6">{cet.aspects?.find((a) => a.key === key)?.comment}</dd>
            </div>
          ))}
        </dl>
      )}

      {cet.sentences && (
        <Section title="逐句对照">
          <ol className="flex flex-col gap-5">
            {cet.sentences.map((s, i) => (
              <li className="flex flex-col gap-1.5 border-b border-border pb-5 text-[15px] leading-7 last:border-0" key={i}>
                <span className="text-muted-foreground" lang="zh-CN">
                  {i + 1}. {s.zh}
                </span>
                <span className="bg-muted px-3 py-1.5 break-words">{s.mine || <span className="text-warning">没有译出</span>}</span>
                <span className={s.issue === '无问题' ? 'text-success' : 'font-semibold text-warning'}>{s.issue}</span>
                <span className="break-words" lang="en">
                  <span className="mr-2 text-[13px] text-muted-foreground">{s.optional ? '可选更好的说法' : '建议译法'}</span>
                  {s.suggestion}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {review.paragraphs.length > 0 && (
        <Section title="逐段建议">
          <ol className="flex flex-col gap-3">
            {review.paragraphs.map((p) => (
              <li className="flex gap-3 text-[15px] leading-7" key={p.index}>
                <span className="shrink-0 text-muted-foreground tabular-nums">第 {p.index} 段</span>
                <span className="min-w-0">{p.comment}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {review.rewrites.length > 0 && (
        <Section title="可以这样改">
          <ul className="flex flex-col gap-5">
            {review.rewrites.map((r, i) => (
              <li className="flex flex-col gap-1.5 text-[15px] leading-7" key={i}>
                <span className="bg-muted px-3 py-1.5 break-words text-muted-foreground">{r.original}</span>
                <span className="px-3 break-words">→ {r.revised}</span>
                {r.why && <span className="px-3 text-[14px] text-muted-foreground">{r.why}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="总体点评">
        <p className="text-[15px] leading-7">{cet.summary}</p>
      </Section>
    </div>
  )
}
