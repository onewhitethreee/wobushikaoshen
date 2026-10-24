'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { CostMark } from '@/components/Journal/CostMark'
import { Button } from '@/components/ui/button'
import { countWords } from '@/exam/scoring'

import { TaskReviews } from './ReviewHistory'
import { ReviewResult, type Review } from './ReviewResult'
import { WritingPad } from './WritingPad'

// 写作页的作答区 + AI 批改（015 contracts/ui.md 写作页一节）：写作框、按钮、确认、进行中轮询、结果
type State =
  | { kind: 'idle'; note?: React.ReactNode }
  | { kind: 'confirm'; balance: number }
  | { kind: 'pending'; id: number }
  | { kind: 'done'; review: Review; reused: boolean }

// 与 src/review/writing.ts 的 LIMITS 一致（那边带服务端依赖，前端不能直接引）
const LIMITS = { task1: { min: 50, max: 1000 }, task2: { min: 80, max: 1000 } }
const POLL_MS = 2000

// 平台关闭时括号里不提笔记（032 contracts/ui.md）
const creditsLink = (notePlatform: string | null) => (
  <Link className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4" href="/me/credits">
    去「我的额度」领额度（{notePlatform ? `邀请好友、发${notePlatform}笔记` : '邀请好友、兑换码'}）
  </Link>
)

export const ReviewPanel: React.FC<{
  taskId: number
  taskType: 'task1' | 'task2'
  minWords: number
  reviewable: boolean
  notePlatform?: string | null
}> = ({ taskId, taskType, minWords, reviewable, notePlatform = '小红书' }) => {
  // 只在点按钮时读，用 ref：打字不重渲染面板（用 state 时快速输入会触发 React 嵌套更新上限、丢字）
  const text = useRef('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [live, setLive] = useState('')
  const alive = useRef(true)
  // 开发模式 StrictMode 会卸载再挂载一次，挂载时要重新置 true
  useEffect(() => {
    alive.current = true
    return () => void (alive.current = false)
  }, [])

  const fail = useCallback((note: React.ReactNode, say: string) => {
    setState({ kind: 'idle', note })
    setLive(say)
  }, [])

  // 轮询这次批改，直到完成或失败
  useEffect(() => {
    if (state.kind !== 'pending') return
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const res = await fetch(`/api/me/writing-reviews/${state.id}`, { credentials: 'include' }).catch(() => null)
      if (!alive.current) return
      const d = res?.ok ? await res.json() : null
      if (d?.status === 'done') {
        setState({ kind: 'done', review: d, reused: false })
        setLive(`批改完成，总分 ${d.overall}`)
      } else if (d?.status === 'failed') fail('批改没成功，额度已退回', '批改没成功，额度已退回')
      else timer = setTimeout(tick, POLL_MS)
    }
    timer = setTimeout(tick, POLL_MS)
    return () => clearTimeout(timer)
  }, [state, fail])

  const start = async () => {
    const words = countWords(text.current)
    const { min, max } = LIMITS[taskType]
    if (words < min) return fail(`至少写 ${min} 词再批改（现在 ${words} 词）`, '')
    if (words > max) return fail(`作文超过 ${max} 词，删减后再批改（现在 ${words} 词）`, '')
    const res = await fetch('/api/me/credits', { credentials: 'include' }).catch(() => null)
    if (res?.status === 401) {
      // 草稿已存在本机，登录回来还在
      window.location.assign(`/login?next=${encodeURIComponent(`/writing/${taskId}#review`)}`)
      return
    }
    if (!res?.ok) return fail('网络不太好，稍后再试', '')
    setState({ kind: 'confirm', balance: (await res.json()).balance })
  }

  const submit = async () => {
    setLive('开始批改')
    const res = await fetch('/api/me/writing-reviews', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, essay: text.current }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    if (res?.status === 202) return setState({ kind: 'pending', id: d.id })
    if (res?.status === 200 && d.reused) {
      if (d.status === 'pending') return setState({ kind: 'pending', id: d.id })
      const r = await fetch(`/api/me/writing-reviews/${d.id}`, { credentials: 'include' }).then((x) => x.json())
      setLive('这篇和上次批改的一样，显示上次的结果')
      return setState({ kind: 'done', review: r, reused: true })
    }
    if (res?.status === 401) return window.location.assign(`/login?next=${encodeURIComponent(`/writing/${taskId}#review`)}`)
    if (d.error === 'balance') return setState({ kind: 'confirm', balance: 0 })
    if (d.error === 'words') return fail(`至少写 ${d.min} 词、最多 ${d.max} 词再批改（现在 ${d.words} 词）`, '')
    if (d.error === 'too_long') return fail(`作文太长，最多 ${d.max} 个字符`, '')
    if (d.error === 'rate') return fail('操作太频繁，请稍后再试', '操作太频繁，请稍后再试')
    if (d.error === 'not_reviewable') return fail('这道题暂时不能批改', '这道题暂时不能批改')
    fail('批改暂时不可用，没有扣额度', '批改暂时不可用')
  }

  const pending = state.kind === 'pending'

  return (
    <>
      <WritingPad minWords={minWords} onText={(t) => void (text.current = t)} readOnly={pending} taskId={String(taskId)} />
      <div className="flex scroll-mt-24 flex-col gap-4 border-t border-border pt-4" id="review">
        <p aria-live="polite" className="sr-only">
          {live}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button data-testid="review-start" disabled={!reviewable || pending || state.kind === 'confirm'} onClick={start} type="button">
            {pending ? '批改中…' : 'AI 批改'}
          </Button>
          <CostMark cost={{ kind: 'quota', amount: 1 }} label="批改" />
        </div>

        {!reviewable && <p className="text-sm text-muted-foreground">这道题暂时不能批改</p>}
        {pending && <p className="text-sm text-muted-foreground">大约 30 秒，可以离开这个页面，批完会出现在批改记录里</p>}
        {state.kind === 'idle' && state.note && (
          <p className="text-sm font-semibold text-warning" data-testid="review-note" role="status">
            {state.note}
          </p>
        )}

        {state.kind === 'confirm' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-warning-soft px-4 py-2.5" data-testid="review-confirm" role="alert">
            {state.balance > 0 ? (
              <>
                <p className="font-semibold tabular-nums">批改这篇作文要用 1 额度，你现在有 {state.balance} 额度</p>
                <div className="ml-auto flex gap-2">
                  <Button onClick={() => setState({ kind: 'idle' })} type="button" variant="outline">
                    再改改
                  </Button>
                  <Button data-testid="review-submit" onClick={submit} type="button">
                    批改
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold">额度不够</p>
                {creditsLink(notePlatform)}
                <Button className="ml-auto" onClick={() => setState({ kind: 'idle' })} type="button" variant="outline">
                  知道了
                </Button>
              </>
            )}
          </div>
        )}

        {state.kind === 'done' && (
          <>
            {state.reused && <p className="text-sm text-muted-foreground">这篇和上次批改的一样，下面是上次的结果，没有扣额度</p>}
            <ReviewResult review={state.review} />
          </>
        )}

        <TaskReviews refresh={state} taskId={taskId} />
      </div>
    </>
  )
}
