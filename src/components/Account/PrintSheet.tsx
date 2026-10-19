'use client'

import React from 'react'
import { createRoot } from 'react-dom/client'

import { FIXED_OPTIONS, type Answers, type Option } from '@/exam/practice'
import { TEXT_TYPES } from '@/exam/scoring'
import type { PrintBatch, PrintGroup, PrintQuestion, PrintRequestItem } from '@/practice/print'

import { bold } from '../Practice/ExplainPanel'

// 错题打印版面（018 contracts/ui.md）：只在打印时可见，样式见 globals.css 的 @media print
type Props = { batch: PrintBatch; filterLabel: string; total: number; answersOf: (groupKey: string) => Answers | undefined }

const range = (q: PrintQuestion) => (q.span > 1 ? `${q.number}–${q.number + q.span - 1}` : String(q.number))
const optionsOf = (g: PrintGroup, q: PrintQuestion): Option[] => (q.options.length ? q.options : g.options)

/** 选择题把选项文字带上：B → B. some text */
const withText = (keys: string, options: Option[]) =>
  keys
    .split(/[,，\n]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => {
      const o = options.find((x) => x.key === k)
      return o && o.text !== o.key ? `${k}. ${o.text}` : k
    })
    .join('；')

const yours = (a: Answers[number] | undefined, options: Option[]) => {
  const s = Array.isArray(a) ? a.join(',') : (a ?? '')
  return s.trim() ? withText(s, options) : '—'
}

const Group: React.FC<{ g: PrintGroup }> = ({ g }) => {
  const inContent = new Set<number>()
  const content = g.content?.split('\n').map((line, li) => (
    <p className="print-content-line" key={li}>
      {line.split(/\{\{(\d+)\}\}/).map((part, i) => {
        if (i % 2 === 0) return part
        inContent.add(Number(part))
        return <span key={i}> ({part}) ____________ </span>
      })}
    </p>
  ))
  const isText = TEXT_TYPES.includes(g.type)
  const isChoice = g.type === 'single_choice' || g.type === 'multi_choice'
  // 配对、标题等题组级选项列一次；判断题的固定选项说明里已写，不另列
  const showTable = !isChoice && !FIXED_OPTIONS[g.type] && g.options.length > 0
  const rows = g.questions.filter((q) => !inContent.has(q.number))

  return (
    <div className="print-group">
      <p className="print-instr">
        <i>{g.instructions}</i>
        {g.maxWords ? `（不超过 ${g.maxWords} 个词）` : ''}
      </p>
      {g.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="题目配图" src={g.imageUrl} />
      )}
      {showTable && (
        <dl className="print-opts">
          {g.options.map((o) => (
            <React.Fragment key={o.key}>
              <dt>{o.key}</dt>
              <dd>{o.text}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {content && <div className="print-content">{content}</div>}
      {rows.map((q) => (
        <div className="print-q" key={q.number}>
          <p>
            <b className="print-num">{range(q)}</b> {q.prompt}
            {!isChoice && <span className="print-blank">{isText ? ' ____________________' : ' ________'}</span>}
          </p>
          {isChoice && (
            <ul className="print-choices">
              {q.options.map((o) => (
                <li key={o.key}>
                  □ {o.key}. {o.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

export const PrintSheet: React.FC<Props> = ({ batch, filterLabel, total, answersOf }) => {
  const count = batch.blocks.reduce((n, b) => n + b.groups.reduce((m, g) => m + g.questions.length, 0), 0)
  const today = new Date()
  return (
    <article>
      <header className="print-head">
        <h1>错题练习</h1>
        <p>
          {[filterLabel, `共 ${count} 题`, `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {batch.skipped > 0 && <p>（{batch.skipped} 道题已下架，未打印）</p>}
        {total > count + batch.skipped && <p>（只打印了最近的 {count + batch.skipped} 道，共 {total} 道）</p>}
      </header>

      {batch.blocks.map((b) => (
        <section className="print-block" key={b.source}>
          <h2>{b.title}</h2>
          {b.excerpt?.kind === 'paragraphs' && (
            <div className="print-excerpt">
              {b.excerpt.paragraphs.map((p, i) => (
                <p key={i}>
                  {p.label && <b className="print-num">{p.label}</b>}{' '}
                  {p.sentences.map((x) => (x.mark ? <u key={x.n}>{x.text}</u> : <span key={x.n}>{x.text}</span>)).flatMap((el, j) => (j ? [' ', el] : [el]))}
                </p>
              ))}
            </div>
          )}
          {b.excerpt?.kind === 'lines' && (
            <div className="print-excerpt">
              {b.excerpt.runs.map((run, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <p>……</p>}
                  {run.map((l) => (
                    <p key={l.n}>
                      {l.speaker && <b>{l.speaker}: </b>}
                      {l.mark ? <u>{l.text}</u> : l.text}
                    </p>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}
          {b.groups.map((g) => (
            <Group g={g} key={g.groupKey} />
          ))}
        </section>
      ))}

      <section className="answers">
        <h2>答案与解析</h2>
        <ol>
          {batch.blocks.flatMap((b) =>
            b.groups.flatMap((g) =>
              g.questions.map((q) => (
                <li key={`${g.groupKey}#${q.number}`}>
                  <p>
                    <b className="print-num">{range(q)}</b> · {b.title}
                  </p>
                  <p>
                    正确答案：{withText(q.answers, optionsOf(g, q))}　你的答案：{yours(answersOf(g.groupKey)?.[q.number], optionsOf(g, q))}
                  </p>
                  {q.explanation && <p>解析：{bold(q.explanation)}</p>}
                </li>
              )),
            ),
          )}
        </ol>
      </section>
    </article>
  )
}

/** 请求打印数据 → 挂到 body 下 → 等图片 → 打印 → 清理。print 抛错时保留节点并抛出（e2e 在 print 媒体下检查版面靠这一点） */
export const printMistakes = async (opts: { items: PrintRequestItem[]; total: number; filterLabel: string; answersOf: Props['answersOf'] }) => {
  const res = await fetch('/api/practice/print', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: opts.items }),
  })
  if (!res.ok) throw new Error(`print ${res.status}`)
  const batch = (await res.json()) as PrintBatch

  document.getElementById('print-sheet')?.remove()
  const host = document.createElement('div')
  host.id = 'print-sheet'
  document.body.appendChild(host)
  const root = createRoot(host)
  await new Promise<void>((resolve) => {
    root.render(<PrintSheet answersOf={opts.answersOf} batch={batch} filterLabel={opts.filterLabel} total={opts.total} />)
    requestAnimationFrame(() => resolve())
  })
  await Promise.all(
    [...host.querySelectorAll('img')].map((img) => Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 3000))])),
  )

  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    window.removeEventListener('afterprint', cleanup)
    root.unmount()
    host.remove()
    document.documentElement.classList.remove('printing')
  }
  window.addEventListener('afterprint', cleanup)
  document.documentElement.classList.add('printing')
  window.print()
  cleanup()
}
