'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { isMember } from '@/practice/syncClient'
import { answerKey, type Given } from '@/review/explainKey'

// 答案纠错举报（031 contracts/ui.md 解析面板一节）：每道题下"答案有问题"，就地展开表单，不用弹窗
type Item = { number: number; status: 'pending' | 'approved' | 'rejected'; answerKey: string }
type Kind = 'accept' | 'wrong' | 'other'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'accept', label: '我的答案也应该算对' },
  { value: 'wrong', label: '标准答案错了' },
  { value: 'other', label: '其他' },
]

// 每个单元只取一次本人的举报；新提交的直接加进去
const loaded = new Map<string, Promise<Item[]>>()
const loadReports = (unitId: string) => {
  let p = loaded.get(unitId)
  if (!p) {
    p = fetch(`/api/me/answer-reports?unitKey=${encodeURIComponent(unitId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: Item[] }) => d.items)
      .catch(() => [])
    loaded.set(unitId, p)
  }
  return p
}

const STATUS = { pending: '已举报，审核中', approved: '举报已通过', rejected: '举报未通过' }

export const ReportAnswer: React.FC<{ unitId: string; number: number; answer: Given | undefined; answers: string }> = ({
  unitId,
  number,
  answer,
  answers,
}) => {
  const given = (Array.isArray(answer) ? answer.join('、') : answer?.trim()) || ''
  const key = answerKey(answer)
  const [member, setMember] = useState<boolean | null>(null)
  const [mine, setMine] = useState<Item | null>(null)
  const [open, setOpen] = useState(false)
  const [guestHint, setGuestHint] = useState(false)
  const [kind, setKind] = useState<Kind>(given ? 'accept' : 'wrong')
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    void (async () => {
      const ok = await isMember()
      if (!alive.current) return
      setMember(ok)
      if (!ok) return
      const items = (await loadReports(unitId)).filter((i) => i.number === number)
      // 审核中 / 已通过的那条优先；只有驳回的，看是不是同一作答
      const hit = items.find((i) => i.status !== 'rejected') ?? items.find((i) => i.answerKey === key) ?? null
      if (alive.current) setMine(hit)
    })()
    return () => void (alive.current = false)
  }, [unitId, number, key])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/me/answer-reports', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ unitId, number, kind, answer: answer ?? '', remark }),
    }).catch(() => null)
    setBusy(false)
    if (!res) return setError('网络不通，请稍后再试')
    const d = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return setError(d.error ?? '提交失败')
    const item: Item = { number, status: 'pending', answerKey: key }
    void loadReports(unitId).then((items) => items.push(item))
    setMine(item)
    setOpen(false)
    setDone(true)
  }

  if (member === null) return null
  if (mine) {
    return (
      <p className="border-t border-border pt-2 text-muted-foreground" data-testid="report-status">
        {STATUS[mine.status]}
        {done && '，审核通过后奖励额度'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2" data-testid="report">
      {!open && (
        <button
          className="inline-flex min-h-11 items-center self-start rounded-lg px-2 font-semibold text-muted-foreground underline-offset-4 hover:bg-muted hover:text-foreground hover:underline"
          data-testid="report-answer"
          onClick={() => (member ? setOpen(true) : setGuestHint(true))}
          type="button"
        >
          答案有问题
        </button>
      )}
      {guestHint && (
        <p className="text-muted-foreground" data-testid="report-guest">
          <Link
            className="font-semibold text-foreground underline underline-offset-4"
            href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
          >
            登录
          </Link>
          后可以举报，通过后奖励额度
        </p>
      )}
      {open && (
        <form className="flex flex-col gap-3" data-testid="report-form" onSubmit={submit}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">标准答案</dt>
            <dd className="min-w-0 break-words">{answers}</dd>
            <dt className="text-muted-foreground">你的作答</dt>
            <dd className="min-w-0 break-words">{given || '未作答'}</dd>
          </dl>
          <fieldset className="flex flex-col">
            <legend className="mb-1 text-muted-foreground">哪里有问题</legend>
            {KINDS.map((k) => (
              <label className="inline-flex min-h-11 items-center gap-2 has-disabled:opacity-40" key={k.value}>
                <input
                  checked={kind === k.value}
                  disabled={k.value === 'accept' && !given}
                  name={`report-kind-${number}`}
                  onChange={() => setKind(k.value)}
                  type="radio"
                  value={k.value}
                />
                {k.label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">说明（选填）</span>
            <textarea
              className="min-h-16 border border-input bg-background px-3 py-2"
              data-testid="report-remark"
              maxLength={200}
              onChange={(e) => setRemark(e.target.value)}
              value={remark}
            />
          </label>
          <p aria-live="polite" className="text-error empty:hidden" data-testid="report-error">
            {error}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button data-testid="report-submit" disabled={busy} type="submit">
              {busy ? '提交中…' : '提交'}
            </Button>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              取消
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
