import React from 'react'

// 批改结果（015 contracts/ui.md 第 5 条）：写作页批改区与详情页共用
export type Review = {
  overall: number
  criteria: { key: string; band: number; reason: string }[]
  paragraphs: { index: number; comment: string }[]
  rewrites: { original: string; revised: string; why: string }[]
  lengthNote: string
}

const LABEL: Record<string, string> = {
  TA: 'Task Achievement',
  TR: 'Task Response',
  CC: 'Coherence and Cohesion',
  LR: 'Lexical Resource',
  GRA: 'Grammatical Range and Accuracy',
}
const ZH: Record<string, string> = { TA: '任务完成', TR: '任务回应', CC: '连贯与衔接', LR: '词汇', GRA: '语法' }
const band = (n: number) => n.toFixed(1)

export const ReviewResult: React.FC<{ review: Review }> = ({ review }) => (
  <div className="flex flex-col gap-8" data-testid="review-result">
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-3">
        <span className="text-sm text-muted-foreground">总分</span>
        <span className="text-[44px] leading-none font-medium tabular-nums" data-testid="review-overall">
          {band(review.overall)}
        </span>
      </p>
      {review.lengthNote && <p className="bg-warning-soft px-4 py-2.5 text-[15px] leading-7 text-warning">{review.lengthNote}</p>}
      <dl className="grid gap-px bg-border sm:grid-cols-2">
        {review.criteria.map((c) => (
          <div className="flex min-w-0 flex-col gap-1.5 bg-background p-4" key={c.key}>
            <dt className="text-[13px] leading-5 text-muted-foreground">
              {ZH[c.key]}
              <span className="block break-words">{LABEL[c.key]}</span>
            </dt>
            <dd className="flex flex-col gap-1.5">
              <span className="text-[24px] font-medium tabular-nums">{band(c.band)}</span>
              <span className="text-[14px] leading-6">{c.reason}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>

    <section className="flex flex-col gap-3">
      <h2 className="text-[18px] font-medium">逐段建议</h2>
      <ol className="flex flex-col gap-3">
        {review.paragraphs.map((p) => (
          <li className="flex gap-3 text-[15px] leading-7" key={p.index}>
            <span className="shrink-0 text-muted-foreground tabular-nums">第 {p.index} 段</span>
            <span className="min-w-0">{p.comment}</span>
          </li>
        ))}
      </ol>
    </section>

    <section className="flex flex-col gap-3">
      <h2 className="text-[18px] font-medium">可以这样改</h2>
      <ul className="flex flex-col gap-5">
        {review.rewrites.map((r, i) => (
          <li className="flex flex-col gap-1.5 text-[15px] leading-7" key={i}>
            <span className="bg-muted px-3 py-1.5 break-words text-muted-foreground">{r.original}</span>
            <span className="px-3 break-words">→ {r.revised}</span>
            {r.why && <span className="px-3 text-[14px] text-muted-foreground">{r.why}</span>}
          </li>
        ))}
      </ul>
    </section>
  </div>
)
