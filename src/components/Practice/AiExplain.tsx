'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import { CostMark } from '@/components/Journal/CostMark'
import { Button } from '@/components/ui/button'
import { isMember } from '@/practice/syncClient'
import { answerKey, type Given } from '@/review/explainKey'

import { bold } from './ExplainPanel'

// 错题 AI 讲解（015 contracts/ui.md 解析面板一节）：解析面板和错题本里答错的题用；付过费的打开就显示
type Item = { number: number; answer: string; body: string }
type State =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'idle'; note?: string; credits?: boolean }
  | { kind: 'busy' }
  | { kind: 'done'; body: string }

const RETRY_MS = 2000
const RETRY_MAX = 60_000

// 每个单元只取一次已付费讲解；新付费的直接加进去
const unlocked = new Map<string, Promise<Item[]>>()
const loadUnlocked = (unitId: string) => {
  let p = unlocked.get(unitId)
  if (!p) {
    p = fetch(`/api/me/explanations?unitId=${encodeURIComponent(unitId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: Item[] }) => d.items)
      .catch(() => [])
    unlocked.set(unitId, p)
  }
  return p
}

const title = (answer: Given | undefined) => {
  const given = (Array.isArray(answer) ? answer.join('、') : answer?.trim()) || ''
  return given ? `为什么不是 ${given}` : '这道题怎么找答案'
}

export const AiExplain: React.FC<{ unitId: string; number: number; answer: Given | undefined }> = ({ unitId, number, answer }) => {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [live, setLive] = useState('')
  const key = answerKey(answer)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    void (async () => {
      if (!(await isMember())) return alive.current && setState({ kind: 'guest' })
      const hit = (await loadUnlocked(unitId)).find((i) => i.number === number && i.answer === key)
      if (alive.current) setState(hit ? { kind: 'done', body: hit.body } : { kind: 'idle' })
    })()
    return () => void (alive.current = false)
  }, [unitId, number, key])

  const ask = async () => {
    setState({ kind: 'busy' })
    setLive('讲解中')
    const started = Date.now()
    for (;;) {
      const res = await fetch('/api/me/explanations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ unitId, number, answer: answer ?? '' }),
      }).catch(() => null)
      if (!alive.current) return
      const d = res ? await res.json().catch(() => ({})) : {}
      // 同一题正在别的请求里生成：等它完成
      if (res?.status === 409 && Date.now() - started < RETRY_MAX) {
        await new Promise((r) => setTimeout(r, RETRY_MS))
        continue
      }
      if (res?.ok) {
        void loadUnlocked(unitId).then((items) => items.push({ number, answer: key, body: d.body }))
        setLive('讲解完成')
        return setState({ kind: 'done', body: d.body })
      }
      const note =
        res?.status === 401
          ? '请先登录'
          : d.error === 'balance'
            ? '额度不够'
            : d.error === 'rate'
              ? '操作太频繁，请稍后再试'
              : d.refunded
                ? '讲解没成功，额度已退回'
                : '讲解暂时不可用，没有扣额度'
      setLive(note)
      return setState({ kind: 'idle', note, credits: d.error === 'balance' })
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2" data-testid="ai-explain">
      <p aria-live="polite" className="sr-only">
        {live}
      </p>
      {state.kind === 'guest' && (
        <p className="text-muted-foreground">
          <Link
            className="font-semibold text-foreground underline underline-offset-4"
            href={`/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search)}`}
          >
            登录
          </Link>
          后可以让 AI 讲解你的答案
        </p>
      )}
      {(state.kind === 'idle' || state.kind === 'busy') && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button data-testid="ai-explain-ask" disabled={state.kind === 'busy'} onClick={ask} type="button" variant="outline">
            {state.kind === 'busy' ? '讲解中…' : 'AI 讲解我的答案'}
          </Button>
          <CostMark cost={{ kind: 'quota', amount: 1 }} />
        </div>
      )}
      {state.kind === 'idle' && state.note && (
        <p className="font-semibold text-warning" data-testid="ai-explain-note" role="status">
          {state.note}
          {state.credits && (
            <>
              {' '}
              <Link className="underline underline-offset-4" href="/me/credits">
                去「我的额度」领额度
              </Link>
            </>
          )}
        </p>
      )}
      {state.kind === 'done' && (
        <div className="flex flex-col gap-1" data-testid="ai-explain-body">
          <p className="font-semibold text-foreground">{title(answer)}</p>
          <p className="break-words whitespace-pre-line text-muted-foreground">{bold(state.body)}</p>
        </div>
      )}
    </div>
  )
}
