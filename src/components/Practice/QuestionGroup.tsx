'use client'

import { Check, ChevronRight, X } from 'lucide-react'
import React from 'react'

import type { Answers, GroupView, Option, ScoreItem } from '@/exam/practice'
import { answerLines, countWords, expandOptional, scoreMulti, TEXT_TYPES } from '@/exam/scoring'
import { cn } from '@/utilities/ui'

// 一个题组：按题型分三类交互（research R5）——填写、选一个、选 N 个。交卷后逐题显示一行结果，解析在 ExplainPanel。
export type Question = GroupView['questions'][number]

type Props = {
  group: GroupView
  answers: Answers
  onAnswer: (number: number, value: string | string[]) => void
  submitted: boolean
  items?: ScoreItem[]
  /** 交卷后点结果行：打开解析面板到这道题（锚点题号） */
  onExplain?: (number: number) => void
  /** 听力两栏：配图放在左栏，题目栏不再显示 */
  hideMedia?: boolean
  /** 033 四 / 六级听力：隐藏题干，只留选项 */
  hidePrompt?: boolean
}

/** 选项状态：作答中只分选中 / 未选；交卷后正确选项标绿，选错的标红 */
type Mark = 'on' | 'off' | 'right' | 'wrong'
const markOf = (on: boolean, key: string, correct?: string[]): Mark => {
  if (correct) {
    if (correct.some((c) => c.toLowerCase() === key.toLowerCase())) return 'right'
    if (on) return 'wrong'
    return 'off'
  }
  return on ? 'on' : 'off'
}

const choiceBtn = (m: Mark) =>
  cn(
    'flex min-h-11 min-w-11 items-center rounded-xl border px-3 text-left text-sm pointer-fine:select-text',
    m === 'on' && 'animate-pop border-primary bg-primary-soft font-semibold text-primary-text',
    m === 'right' && 'border-success/60 bg-success-soft font-semibold text-success',
    m === 'wrong' && 'border-error/60 bg-error-soft font-semibold text-error',
    m === 'off' && 'border-border bg-card hover:border-primary/50 hover:bg-primary-soft/40',
  )

/** 014：在选项按钮里拖选文字（准备高亮）时，松开鼠标不算选中这个选项（research R6） */
const selecting = (el: Element) => {
  const s = window.getSelection()
  return Boolean(s && !s.isCollapsed && s.anchorNode && el.contains(s.anchorNode))
}

/** 选项字母小方块：跟随选项状态变色 */
const KeyBadge: React.FC<{ k: string; m: Mark }> = ({ k, m }) => (
  <span
    className={cn(
      'mr-2.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-xs font-bold',
      m === 'on' && 'bg-primary text-primary-foreground',
      m === 'right' && 'bg-success text-background',
      m === 'wrong' && 'bg-error text-background',
      m === 'off' && 'bg-muted text-muted-foreground',
    )}
  >
    {k}
  </span>
)

export const accepted = (q: Question) =>
  answerLines(q.answers)
    .flatMap((a) => expandOptional(a).sort((x, y) => x.length - y.length))
    .join(' / ')

export const locateLabel = (g: GroupView, q: Question): string | undefined => {
  if (q.evidence) return `s${q.evidence}`
  if (g.type === 'matching_information') return answerLines(q.answers)[0]
  if (g.type === 'matching_headings') return /paragraph\s+([A-Z])\b/i.exec(q.prompt ?? '')?.[1]?.toUpperCase()
}

/** 正确答案的显示文字；交卷后光标停在作答位上也显示它 */
const answerText = (group: GroupView, q: Question) => (group.type === 'multi_choice' ? answerLines(q.answers).join(' / ') : accepted(q))

/** 一道题交卷后的结果：结果行和解析面板共用 */
export const resultOf = (group: GroupView, q: Question, answer: Answers[number] | undefined, items: ScoreItem[]) => {
  const multi = group.type === 'multi_choice'
  const credit = multi ? scoreMulti(Array.isArray(answer) ? answer : [], q.answers) : 0
  const ok = multi ? credit === q.span : Boolean(items.find((i) => i.number === q.number)?.correct)
  return {
    multi,
    credit,
    ok,
    verdict: ok ? '正确' : multi && credit > 0 ? '部分正确' : '错误',
    given: (Array.isArray(answer) ? answer.join('、') : answer?.trim()) || '未作答',
    answer: answerText(group, q),
  }
}

export const Verdict: React.FC<{ ok: boolean; text: string }> = ({ ok, text }) => (
  <span className={cn('inline-flex items-center gap-1.5 font-semibold', ok ? 'text-success' : 'text-error')}>
    <span className={cn('flex size-5 items-center justify-center rounded-full text-background', ok ? 'bg-success' : 'bg-error')}>
      {ok ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : <X aria-hidden="true" className="size-3.5" strokeWidth={3} />}
    </span>
    {text}
  </span>
)

// 交卷后题目下的一行结果（008 FR-001），点开解析面板
const ResultLine: React.FC<{ group: GroupView; q: Question; answer: Answers[number] | undefined; items: ScoreItem[]; onExplain?: (n: number) => void }> = ({
  group,
  q,
  answer,
  items,
  onExplain,
}) => {
  const r = resultOf(group, q, answer, items)
  return (
    <button
      aria-label={`第 ${q.number} 题${r.verdict}，查看解析`}
      className={cn(
        'mt-3 flex min-h-11 w-full animate-reveal flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3.5 py-2 text-left text-sm hover:ring-2 hover:ring-primary/25',
        r.ok ? 'border border-border' : 'bg-error-soft',
      )}
      data-hl-skip
      data-testid={`feedback-${q.number}`}
      onClick={() => onExplain?.(q.number)}
      type="button"
    >
      <Verdict ok={r.ok} text={r.verdict} />
      {r.multi && <span className="tabular-nums">得 {r.credit} / {q.span} 分</span>}
      <span className="min-w-0 break-words">
        <span className="text-muted-foreground">你的答案：</span>
        {r.given}
      </span>
      <span className="min-w-0 break-words">
        <span className="text-muted-foreground">答案：</span>
        <b>{r.answer}</b>
      </span>
      <span className="ml-auto inline-flex items-center gap-0.5 text-[13px] font-semibold text-primary-text">
        解析
        <ChevronRight aria-hidden="true" className="size-4" />
      </span>
    </button>
  )
}

const Blank: React.FC<{
  group: GroupView
  n: number
  value: string
  onAnswer: Props['onAnswer']
  submitted: boolean
  correct?: boolean
}> = ({
  group,
  n,
  value,
  onAnswer,
  submitted,
  correct,
}) => {
  const over = group.maxWords && value.trim() && countWords(value, Boolean(group.numberAllowed)) > group.maxWords
  return (
    <span className="inline-flex max-w-full flex-col align-baseline" data-q={n}>
      <span className="inline-flex max-w-full items-baseline gap-1.5">
        <span className="font-sans text-xs text-muted-foreground tabular-nums">{n}</span>
        <input
          aria-invalid={over ? true : undefined}
          aria-label={`第 ${n} 题`}
          autoCapitalize="off"
          autoComplete="off"
          className={cn(
            'min-h-11 w-36 max-w-full min-w-0 scroll-mt-40 border px-2.5 font-sans text-[15px] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15',
            !submitted && (value ? 'border-foreground bg-primary-soft/40' : 'border-input bg-card'),
            submitted && (correct ? 'border-success bg-card' : 'border-error bg-error-soft'),
          )}
          id={`q-${n}`}
          onChange={(e) => onAnswer(n, e.target.value)}
          readOnly={submitted}
          title={submitted ? `答案：${answerOf(group, n)}` : undefined}
          spellCheck={false}
          value={value}
        />
        {submitted &&
          (correct ? (
            <Check aria-label="正确" className="size-4 shrink-0 text-success" strokeWidth={3} />
          ) : (
            <X aria-label="错误" className="size-4 shrink-0 text-error" strokeWidth={3} />
          ))}
      </span>
      {over && <span data-hl-skip className="animate-reveal font-sans text-xs font-semibold text-error">超过 {group.maxWords} 个词</span>}
    </span>
  )
}

const answerOf = (group: GroupView, n: number) => {
  const q = group.questions.find((x) => x.number === n)
  return q ? answerText(group, q) : ''
}

const RadioRow: React.FC<{
  n: number
  options: Option[]
  value: string | undefined
  onPick: (k: string) => void
  submitted: boolean
  keysOnly: boolean
  correct?: string[]
}> = ({ n, options, value, onPick, submitted, keysOnly, correct }) => (
  <div aria-label={`第 ${n} 题`} className={cn('flex gap-1.5', keysOnly ? 'flex-wrap' : 'flex-col')} role="radiogroup">
    {options.map((o) => {
      const on = value === o.key
      const m = markOf(on, o.key, correct)
      return (
        <button
          aria-checked={on}
          aria-disabled={submitted || undefined}
          className={choiceBtn(m)}
          data-key={o.key}
          key={o.key}
          onClick={(e) => !submitted && !selecting(e.currentTarget) && onPick(o.key)}
          role="radio"
          type="button"
        >
          {keysOnly ? (
            <span className="w-full text-center font-semibold">{o.key}</span>
          ) : (
            <>
              <KeyBadge k={o.key} m={m} />
              {o.text}
            </>
          )}
        </button>
      )
    })}
  </div>
)

export const QuestionGroup: React.FC<Props> = ({ group, answers, onAnswer, submitted, items = [], onExplain, hideMedia, hidePrompt }) => {
  const isText = TEXT_TYPES.includes(group.type) && group.options.length === 0
  const isMulti = group.type === 'multi_choice'
  const showTable = !isText && !isMulti && group.type !== 'single_choice' && !['tfng', 'ynng'].includes(group.type)
  const correctOf = (n: number) => items.find((i) => i.number === n)?.correct
  const str = (n: number) => (typeof answers[n] === 'string' ? (answers[n] as string) : '')

  // 正文里的 {{n}}：填写类换成输入框，选择类换成带题号的作答位
  const inContent = new Set<number>()
  const content = group.content?.split('\n').map((line, li) => (
    <p className="min-h-7" key={li}>
      {line.split(/\{\{(\d+)\}\}/).map((part, i) => {
        if (i % 2 === 0) return part
        const n = Number(part)
        inContent.add(n)
        if (isText) return <Blank correct={correctOf(n)} group={group} key={i} n={n} onAnswer={onAnswer} submitted={submitted} value={str(n)} />
        return (
          <span className="mx-1 inline-flex min-w-14 items-baseline gap-1.5 rounded-md bg-muted px-2 font-sans text-sm" key={i}>
            <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
            <b data-hl-skip>{str(n)}</b>
          </span>
        )
      })}
    </p>
  ))

  const rowQuestions = isText ? group.questions.filter((q) => !inContent.has(q.number)) : group.questions

  return (
    <section className="border-t border-border pt-6 pb-8" data-group={group.key}>
      <p className="mb-3 text-sm italic text-muted-foreground">{group.instructions}</p>

      {group.imageUrl && !hideMedia && (
        <a className="mb-4 block" href={group.imageUrl} rel="noreferrer" target="_blank" title="点开看大图">
          {/* 媒体直连原地址，不走 next/image 的服务端转发 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="题目配图" className="max-h-[420px] w-auto max-w-full rounded-xl border border-border transition-transform duration-300 hover:scale-[1.01]" loading="lazy" src={group.imageUrl} />
        </a>
      )}

      {showTable && group.options.length > 0 && (
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl bg-muted px-4 py-3 text-sm">
          {group.options.map((o) => (
            <React.Fragment key={o.key}>
              <dt className="font-bold text-primary-text">{o.key}</dt>
              <dd>{o.text}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      {content && <div className="mb-2 flex flex-col gap-1.5 text-[15px] leading-8">{content}</div>}

      {isText && submitted && inContent.size > 0 && (
        <ol className="mt-3 flex flex-col gap-2" data-hl-skip>
          {group.questions
            .filter((q) => inContent.has(q.number))
            .map((q) => (
              <li className="text-sm" key={q.number}>
                <span className="font-semibold tabular-nums">第 {q.number} 题</span>
                <ResultLine answer={answers[q.number]} group={group} items={items} onExplain={onExplain} q={q} />
              </li>
            ))}
        </ol>
      )}

      <ol className="flex flex-col">
        {rowQuestions.map((q) => {
          const nums = q.span > 1 ? `${q.number}–${q.number + q.span - 1}` : String(q.number)
          return (
            <li
              className="scroll-mt-40 border-t border-paper-rule py-3 first:border-t-0"
              data-q={q.number}
              id={isText ? undefined : `q-${q.number}`}
              key={q.number}
              title={submitted && !isText ? `答案：${answerText(group, q)}` : undefined}
            >
              <div className="mb-2 flex gap-3">
                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border border-input px-1.5 text-[13px] font-bold tabular-nums">{nums}</span>
                <div className="min-w-0 flex-1">
                  {/* hidden 而不是不渲染：文字留在页面里，高亮偏移不变（033 四 / 六级听力隐藏题干） */}
                  {q.prompt && (
                    <p className="whitespace-pre-line" hidden={hidePrompt}>
                      {q.prompt}
                    </p>
                  )}
                  {isMulti && <p className="mt-1 inline-flex bg-primary-soft px-2.5 py-0.5 text-[12px] font-semibold text-primary-text">选 {q.span} 项</p>}
                </div>
              </div>
              {isText ? (
                <Blank correct={correctOf(q.number)} group={group} n={q.number} onAnswer={onAnswer} submitted={submitted} value={str(q.number)} />
              ) : isMulti ? (
                <MultiChoice
                  correct={submitted ? answerLines(q.answers) : undefined}
                  onChange={(v) => onAnswer(q.number, v)}
                  options={group.options.length ? group.options : q.options}
                  span={q.span}
                  submitted={submitted}
                  value={Array.isArray(answers[q.number]) ? (answers[q.number] as string[]) : []}
                />
              ) : (
                <RadioRow
                  correct={submitted ? answerLines(q.answers) : undefined}
                  keysOnly={group.type !== 'single_choice'}
                  n={q.number}
                  onPick={(k) => onAnswer(q.number, k)}
                  options={group.type === 'single_choice' ? q.options : group.options}
                  submitted={submitted}
                  value={str(q.number) || undefined}
                />
              )}
              {submitted && <ResultLine answer={answers[q.number]} group={group} items={items} onExplain={onExplain} q={q} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const MultiChoice: React.FC<{
  options: Option[]
  span: number
  value: string[]
  onChange: (v: string[]) => void
  submitted: boolean
  correct?: string[]
}> = ({ options, span, value, onChange, submitted, correct }) => {
  const full = value.length >= span
  return (
    <div className="flex flex-col gap-1.5" role="group">
      {options.map((o) => {
        const on = value.includes(o.key)
        const blocked = submitted || (full && !on)
        const m = markOf(on, o.key, correct)
        return (
          <button
            aria-checked={on}
            aria-disabled={blocked || undefined}
            className={cn(choiceBtn(m), blocked && m === 'off' && 'text-muted-foreground')}
            data-key={o.key}
            key={o.key}
            onClick={(e) => {
              if (submitted || selecting(e.currentTarget)) return
              if (on) onChange(value.filter((k) => k !== o.key))
              else if (!full) onChange([...value, o.key])
            }}
            role="checkbox"
            type="button"
          >
            <KeyBadge k={o.key} m={m} />
            {o.text}
          </button>
        )
      })}
    </div>
  )
}
