'use client'

import { ArrowUpRight, Check } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'

import { listeningType, readingType } from '@/exam/typeNames'
import { calendar, dailyTarget, daysLeft, doneToday, doneUnits, studyDay, weakest, type Plan } from '@/practice/plan'
import { progressOf } from '@/practice/progress'
import { load, save, setPlan, type PracticeRecord } from '@/practice/store'
import { schedulePush, STORE_EVENT, sync } from '@/practice/syncClient'
import { buildQueue, dayStart } from '@/vocab/schedule'
import { load as loadVocab, type Vocab } from '@/vocab/store'
import { cn } from '@/utilities/ui'

// 首页"今日任务"（024 contracts/ui.md）：考试倒计时、听力 / 阅读 / 背单词三项、打卡日历。只读本机数据（登录后先同步）
const TARGETS = Array.from({ length: 11 }, (_, i) => 4 + i * 0.5)
const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const NAME = { listening: '听力', reading: '阅读' } as const
const UNIT = { listening: '个 Part', reading: '篇' } as const
const band = (v: number) => v.toFixed(1).replace(/\.0$/, '')

type State = { records: PracticeRecord[]; plan?: Plan; vocab: Vocab; now: number }

const Task: React.FC<{ testid: string; done: boolean; title: string; detail: string; progress: string; href: string }> = ({ testid, done, title, detail, progress, href }) => (
  <li data-done={done} data-testid={testid}>
    <Link className="flex min-h-14 items-center gap-3 border-b border-border py-2 hover:bg-background/60" href={href}>
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center border-[1.5px]',
          done ? 'border-success bg-success text-background' : 'border-foreground',
        )}
      >
        {done && <Check aria-hidden="true" className="size-4" strokeWidth={3} />}
        <span className="sr-only">{done ? '已完成' : '未完成'}</span>
      </span>
      <span className="w-14 shrink-0 font-semibold">{title}</span>
      <span className="min-w-0 flex-1 text-[15px]">{detail}</span>
      <span className="text-[14px] text-muted-foreground tabular-nums">{progress}</span>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  </li>
)

export const TodayPlan: React.FC<{ totals: { listening: number; reading: number } }> = ({ totals }) => {
  const [st, setSt] = useState<State | null>(null)
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState('')
  const [target, setTarget] = useState(6.5)
  const [error, setError] = useState('')

  useEffect(() => {
    const read = () => {
      const { store } = load()
      setSt({ records: store.records, plan: store.plan, vocab: loadVocab(), now: Date.now() })
    }
    read()
    window.addEventListener(STORE_EVENT, read)
    void sync()
    return () => window.removeEventListener(STORE_EVENT, read)
  }, [])

  // 两科的进度、题量和日历只在数据变化时算一次（audit P3）
  const stats = useMemo(() => {
    if (!st) return null
    const days = st.plan?.examDate ? daysLeft(st.plan.examDate, st.now) : 1
    const per = (m: 'listening' | 'reading') => {
      const names = m === 'listening' ? listeningType : readingType
      const p = progressOf(st.records, m, (t) => names[t] ?? t)
      return {
        goal: dailyTarget(Math.max(0, totals[m] - doneUnits(st.records, m).size), days, m),
        done: doneToday(st.records, m, st.now),
        weak: weakest(p.types),
        lastBand: p.lastBand,
      }
    }
    return { listening: per('listening'), reading: per('reading'), cal: calendar(st.records, st.vocab.words, st.now) }
  }, [st, totals])

  if (!st || !stats) return null
  const { plan, vocab, now } = st
  const today = studyDay(now)
  const active = plan?.examDate ? plan : undefined
  const left = active?.examDate ? daysLeft(active.examDate, now) : null
  const past = left !== null && left < 0

  const write = (examDate: string | null) => {
    const { store } = load()
    setPlan(store, examDate, target, Date.now())
    if (save(store)) schedulePush()
    setSt({ ...st, plan: store.plan, now: Date.now() })
    setEditing(false)
    setError('')
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('请选择考试日期')
    if (daysLeft(date, now) < 0) return setError('日期不能早于今天')
    write(date)
  }
  const startEdit = () => {
    setDate(active?.examDate ?? '')
    setTarget(active?.target ?? 6.5)
    setEditing(true)
  }

  const form = (
    <form className="flex flex-wrap items-end gap-3" noValidate onSubmit={submit}>
      <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
        考试日期
        <input
          className="min-h-11 border border-input bg-background px-3 text-[15px] text-foreground"
          data-testid="plan-date"
          min={today}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          value={date}
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
        目标分
        <select className="min-h-11 border border-input bg-background px-3 text-[15px] text-foreground" data-testid="plan-target" onChange={(e) => setTarget(Number(e.target.value))} value={target}>
          {TARGETS.map((t) => (
            <option key={t} value={t}>
              {band(t)}
            </option>
          ))}
        </select>
      </label>
      <button className="min-h-11 bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/88" data-testid="plan-save" type="submit">
        保存
      </button>
      {active && (
        <button className="min-h-11 px-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" data-testid="plan-clear" onClick={() => write(null)} type="button">
          清除计划
        </button>
      )}
      {error && (
        <p className="basis-full text-[14px] text-error" data-testid="plan-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )

  const cal = stats.cal
  const lastBand = stats.listening.lastBand ?? stats.reading.lastBand

  const task = (m: 'listening' | 'reading') => {
    const { goal, done, weak } = stats[m]
    if (!goal)
      return <Task detail="题都做过了，复习错题" done={done > 0} href="/me/mistakes" key={m} progress={`${done} / 1`} testid={`task-${m}`} title={NAME[m]} />
    return (
      <Task
        detail={`做 ${goal} ${UNIT[m]} · ${weak ? `优先 ${weak}` : '各题型都做'}`}
        done={done >= goal}
        href={weak ? `/${m}?tab=type&type=${encodeURIComponent(weak)}&status=${encodeURIComponent('未做')}` : `/${m}`}
        key={m}
        progress={`${done} / ${goal}`}
        testid={`task-${m}`}
        title={NAME[m]}
      />
    )
  }

  const queue = buildQueue(vocab.words, vocab.vocab, now)
  const remaining = queue.due.length + queue.fresh.length
  const start = dayStart(now)
  const reviewed = Object.values(vocab.words).filter((w) => w.on && (w.card?.last_review ?? 0) >= start).length
  const hasWords = Object.values(vocab.words).some((w) => w.on)
  const vocabTask = hasWords ? (
    <Task
      detail={remaining ? `今天还有 ${remaining} 个` : '今天的词背完了'}
      done={remaining === 0 && reviewed > 0}
      href="/me/review"
      progress={`已背 ${reviewed}`}
      testid="task-vocab"
      title="背单词"
    />
  ) : (
    <Task detail="单词本还是空的，做题时双击生词加入" done={false} href="/me/words" progress="" testid="task-vocab" title="背单词" />
  )

  return (
    <section className="flex flex-col gap-5 border border-border p-[clamp(16px,3vw,32px)]" data-testid="today-plan">
      {!active || past || editing ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-[22px] font-medium">今日任务</h2>
          <p className="text-[15px] text-muted-foreground">
            {past ? '考试已经过去了。下一次考试定了吗？' : '填上考试日期，每天给你排好听力、阅读的题量，和背单词合在一起。'}
          </p>
          {form}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="text-[22px] font-medium" data-testid="plan-countdown">
              {left === 0 ? '今天考试，加油' : `距离考试还有 ${left} 天`} · 目标 {band(active.target)} 分
            </h2>
            <div className="flex items-center gap-4 text-[14px] text-muted-foreground">
              {lastBand !== null && <span>最近整套 Band {band(lastBand)}</span>}
              <button className="min-h-11 underline underline-offset-4 hover:text-foreground" data-testid="plan-edit" onClick={startEdit} type="button">
                修改
              </button>
            </div>
          </div>
          {left !== 0 && (
            <>
              <ul className="border-t border-border">
                {task('listening')}
                {task('reading')}
                {vocabTask}
              </ul>
              {(['listening', 'reading'] as const).every((m) => stats[m].done >= Math.max(stats[m].goal, 1)) &&
                (!hasWords || (remaining === 0 && reviewed > 0)) && <p className="text-[15px] font-semibold text-success">今天的任务都完成了。</p>}
            </>
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <p className="flex items-baseline gap-3 text-[14px]">
          <span className="font-semibold">打卡</span>
          {cal.streak > 0 && (
            <span className="text-muted-foreground" data-testid="plan-streak">
              连续 {cal.streak} 天
            </span>
          )}
        </p>
        <div className="grid max-w-[22rem] grid-cols-7 gap-1" data-testid="plan-calendar" role="list">
          {WEEK.map((w) => (
            <span aria-hidden="true" className="text-center text-[12px] text-muted-foreground" key={w}>
              {w}
            </span>
          ))}
          {Array.from({ length: (new Date(`${cal.days[0].date}T12:00`).getDay() + 6) % 7 }, (_, i) => (
            <span aria-hidden="true" key={`pad${i}`} />
          ))}
          {cal.days.map((d) => (
            <span
              aria-label={`${Number(d.date.slice(5, 7))} 月 ${Number(d.date.slice(8))} 日，${d.active ? '已打卡' : '未打卡'}`}
              className={cn('aspect-square', d.active ? 'bg-mark' : 'bg-muted', d.today && 'outline-2 outline-offset-1 outline-foreground')}
              data-active={d.active}
              data-today={d.today}
              key={d.date}
              role="listitem"
              title={d.date}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
