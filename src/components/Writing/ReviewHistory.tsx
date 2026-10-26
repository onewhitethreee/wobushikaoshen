'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { when } from '@/components/Account/CreditsView'
import { Button } from '@/components/ui/button'

import { levelOf } from '@/review/cet'

import { CetReviewResult, type CetReviewView } from './CetReviewResult'
import { ReviewResult, type Review } from './ReviewResult'

// 批改记录（015 contracts/ui.md）：写作页底部的本题记录、「写作批改」列表页、详情页
type TaskType = keyof typeof TASK
type Exam = 'ielts' | 'cet4' | 'cet6' | null
type Row = {
  id: number
  taskId: number | null
  taskTitle: string
  taskType: TaskType | null
  exam?: Exam
  status: 'pending' | 'done'
  overall: number | null
  score?: number | null
  createdAt: string
}
type Detail = Review &
  Partial<CetReviewView> & {
    status: 'pending' | 'done' | 'failed'
    createdAt: string
    essay: string
    words: number
    task: { id: number | null; title: string; taskType: TaskType | null; exam?: Exam; removed: boolean }
  }

const TASK = { task1: 'Task 1', task2: 'Task 2', cet_writing: '写作', cet_translation: '翻译' }
const EXAM: Record<string, string> = { cet4: '四级 · ', cet6: '六级 · ' }
// 034：四 / 六级显示"11 分 · 第 4 档"，雅思显示 Band
const score = (r: Row) =>
  r.status === 'pending' ? '批改中' : typeof r.score === 'number' ? `${r.score} 分 · 第 ${levelOf(r.score)} 档` : (r.overall ?? 0).toFixed(1)
const kind = (exam: Exam | undefined, t: TaskType | null) => `${(exam && EXAM[exam]) ?? ''}${t ? `${TASK[t]} · ` : ''}`

const LoginPrompt: React.FC<{ next: string; what: string }> = ({ next, what }) => (
  <div className="flex flex-col items-start gap-3 py-6">
    <p className="text-[15px] text-muted-foreground">登录后查看{what}。</p>
    <Link
      className="inline-flex min-h-11 items-center border-[1.5px] border-foreground px-5 text-sm font-semibold hover:bg-primary hover:text-primary-foreground"
      href={`/login?next=${encodeURIComponent(next)}`}
    >
      登录
    </Link>
  </div>
)

// 请求失败（断网、服务出错）时给出重试，不再一直"加载中…"
const LoadFailed: React.FC<{ retry: () => void }> = ({ retry }) => (
  <div className="flex flex-col items-start gap-3 py-6" role="alert">
    <p className="text-[15px] text-muted-foreground">没加载出来，检查网络后重试。</p>
    <Button onClick={retry} variant="outline">
      重试
    </Button>
  </div>
)

const useList = (task: number | undefined, page: number, refresh: unknown) => {
  const [data, setData] = useState<{ docs: Row[]; totalPages: number } | null | 'guest' | 'error'>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    fetch(`/api/me/writing-reviews?page=${page}${task ? `&task=${task}` : ''}`, { credentials: 'include' })
      .then(async (r) => (r.status === 401 ? 'guest' : r.ok ? r.json() : 'error'))
      .catch(() => 'error' as const)
      .then((d) => alive && setData(d))
    return () => void (alive = false)
  }, [task, page, refresh, attempt])
  const retry = () => {
    setData(null)
    setAttempt((n) => n + 1)
  }
  return [data, retry] as const
}

// 写作页批改区底部：本题历次批改，没有记录（或未登录）时不显示
export const TaskReviews: React.FC<{ taskId: number; refresh: unknown }> = ({ taskId, refresh }) => {
  const [data] = useList(taskId, 1, refresh)
  if (!data || data === 'guest' || data === 'error' || !data.docs.length) return null
  return (
    <section className="flex flex-col gap-2" data-testid="task-reviews">
      <h2 className="text-[18px] font-medium">批改记录</h2>
      <ul className="border-t border-border">
        {data.docs.map((r) => (
          <li className="border-b border-border" key={r.id}>
            <Link className="flex min-h-11 items-center gap-4 py-2 hover:bg-muted" href={`/me/reviews/${r.id}`}>
              <span className="text-[15px] text-muted-foreground">{when(r.createdAt)}</span>
              <span className="ml-auto text-[17px] font-medium tabular-nums">{score(r)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.totalPages > 1 && (
        <Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href="/me/reviews">
          查看全部
        </Link>
      )}
    </section>
  )
}

// /me/reviews：全部批改
export const ReviewList: React.FC = () => {
  const [page, setPage] = useState(1)
  const [data, retry] = useList(undefined, page, null)
  if (data === 'guest') return <LoginPrompt next="/me/reviews" what="批改记录" />
  if (data === 'error') return <LoadFailed retry={retry} />
  if (!data) return <p className="text-muted-foreground">加载中…</p>
  if (!data.docs.length)
    return (
      <p className="text-[15px] text-muted-foreground">
        还没有批改过作文。去
        <Link className="underline underline-offset-4" href="/writing">
          写作
        </Link>
        写一篇，写完点“AI 批改”。
      </p>
    )
  return (
    <>
      <ul className="border-t border-border">
        {data.docs.map((r) => (
          <li className="border-b border-border" data-testid="review-row" key={r.id}>
            <Link className="flex min-h-11 items-start gap-x-6 py-3 hover:bg-muted" href={`/me/reviews/${r.id}`}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] break-words">{r.taskTitle || '原题已下架'}</span>
                <span className="text-[13px] text-muted-foreground">
                  {kind(r.exam, r.taskType)}
                  {when(r.createdAt)}
                </span>
              </span>
              <span className="text-[17px] font-medium tabular-nums">{score(r)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.totalPages > 1 && (
        <div className="flex items-center gap-4 text-sm">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)} variant="outline">
            ← 上一页
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} / {data.totalPages}
          </span>
          <Button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} variant="outline">
            下一页 →
          </Button>
        </div>
      )}
    </>
  )
}

// /me/reviews/<id>：一次批改的全部内容，作文是提交时的快照
export const ReviewDetail: React.FC<{ id: string }> = ({ id }) => {
  const [data, setData] = useState<Detail | null | 'guest' | 'missing' | 'error'>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    fetch(`/api/me/writing-reviews/${id}`, { credentials: 'include' })
      .then(async (r) => (r.status === 401 ? 'guest' : r.status === 404 ? 'missing' : r.ok ? r.json() : 'error'))
      .catch(() => 'error' as const)
      .then((d) => alive && setData(d))
    return () => void (alive = false)
  }, [id, attempt])

  // 还在批改时每 5 秒再取一次，批改完自动显示结果
  const pending = typeof data === 'object' && data?.status === 'pending'
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setAttempt((n) => n + 1), 5000)
    return () => clearTimeout(t)
  }, [pending, data])

  if (data === 'guest') return <LoginPrompt next={`/me/reviews/${id}`} what="这次批改" />
  if (data === 'error')
    return (
      <LoadFailed
        retry={() => {
          setData(null)
          setAttempt((n) => n + 1)
        }}
      />
    )
  if (data === 'missing') return <p className="text-[15px] text-muted-foreground" data-testid="review-missing">没有这条批改。</p>
  if (!data) return <p className="text-muted-foreground">加载中…</p>
  if (data.status === 'failed') return <p className="text-[15px] text-muted-foreground">这次批改没成功，额度已退回。</p>

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-medium tracking-[-0.02em] break-words">
          {data.task.removed || !data.task.id ? (
            <>
              {data.task.title} <span className="text-[15px] text-muted-foreground">（原题已下架）</span>
            </>
          ) : (
            <Link className="underline-offset-4 hover:underline" href={`/writing/${data.task.id}`}>
              {data.task.title}
            </Link>
          )}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {kind(data.task.exam, data.task.taskType)}
          {when(data.createdAt)} 提交 · {data.words} 词
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-medium">{data.task.taskType === 'cet_translation' ? '译文' : '作文'}</h2>
        <p className="border-l-2 border-border pl-4 text-[15px] leading-7 break-words whitespace-pre-wrap" data-testid="review-essay">
          {data.essay}
        </p>
      </section>
      {data.status === 'pending' ? <p className="text-[15px] text-muted-foreground" role="status">还在批改，完成后会自动显示结果。</p> : typeof data.score === 'number' && data.cet ? (
        <CetReviewResult review={data as CetReviewView} />
      ) : (
        <ReviewResult review={data} />
      )}
    </div>
  )
}
