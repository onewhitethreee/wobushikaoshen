'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/ui'

// 我的额度（011 contracts/ui.md）：余额、邀请好友、小红书笔记换额度、流水
type Entry = { id: number; at: string; reason: string; amount: number; after: number; use?: 'review' | 'explain'; note?: string }
type Submission = { id: number; at: string; url: string; screenshot?: string; status: 'pending' | 'approved' | 'rejected'; amount?: number; reason?: string }
type Data = {
  balance: number
  totalPages: number
  entries: Entry[]
  invite: { link: string; count: number; earned: number; cap: number; capped: boolean }
  submissions: Submission[]
}

const REASON: Record<string, string> = {
  invite: '邀请奖励',
  invitee: '被邀请奖励',
  note: '小红书笔记奖励',
  spend: '使用',
  refund: '退回',
  adjust: '站长调整',
}

// 扣费 / 退回的用途，与 src/account/credits.ts 的 USES 一致（那边带服务端依赖，前端不能直接引）
const USE = { review: '写作批改', explain: '错题讲解' }

export const when = (at: string) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`)

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2 className="text-[20px] font-medium">{children}</h2>

export const CreditsView: React.FC = () => {
  const [data, setData] = useState<Data | null>(null)
  const [loggedIn, setLoggedIn] = useState(true)
  const [page, setPage] = useState(1)
  const [welcome, setWelcome] = useState('')

  const load = useCallback(async (p: number) => {
    const res = await fetch(`/api/me/credits?page=${p}`, { credentials: 'include' }).catch(() => null)
    if (res?.status === 401) return setLoggedIn(false)
    if (res?.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    void load(page)
  }, [load, page])

  // 通过邀请链接刚注册：提示一次（LoginForm 跳过来时带上参数）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const n = Number(q.get('invited'))
    if (n > 0) {
      setWelcome(q.get('both') ? `你和邀请人各得 ${n} 额度` : `你得到 ${n} 额度`)
      window.history.replaceState(null, '', '/me/credits')
    }
  }, [])

  if (!loggedIn) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-[15px] text-muted-foreground">登录后查看额度。</p>
        <Link
          className="inline-flex min-h-11 items-center border-[1.5px] border-foreground px-5 text-sm font-semibold hover:bg-primary hover:text-primary-foreground"
          href="/login?next=/me/credits"
        >
          登录
        </Link>
      </div>
    )
  }
  if (!data) return <p className="text-muted-foreground">加载中…</p>

  return (
    <div className="flex flex-col gap-12">
      {welcome && (
        <p className="bg-success-soft px-5 py-4 text-[15px] text-success" data-testid="invite-welcome" role="status">
          {welcome}
        </p>
      )}

      <div className="flex items-baseline gap-2">
        <span className="text-[56px] leading-none font-medium tabular-nums" data-testid="credit-balance">
          {data.balance}
        </span>
        <span className="text-[15px] text-muted-foreground">额度</span>
      </div>

      <Invite invite={data.invite} />
      <Notes onSubmitted={() => load(page)} submissions={data.submissions} />

      <section className="flex flex-col gap-4">
        <H2>额度明细</H2>
        {!data.entries.length ? (
          <p className="text-[15px] text-muted-foreground">还没有额度。邀请好友或发小红书笔记都能领。</p>
        ) : (
          <>
            <ul className="border-t border-border">
              {data.entries.map((e) => (
                <li className="flex items-start gap-x-6 border-b border-border py-3" data-testid="credit-entry" key={e.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">
                      {REASON[e.reason] ?? e.reason}
                      {e.use && ` · ${USE[e.use]}`}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {when(e.at)}
                      {e.note ? ` · ${e.note}` : ''}
                    </span>
                  </span>
                  <span className="ml-auto flex flex-col items-end">
                    <span className={cn('text-[17px] font-medium tabular-nums', e.amount > 0 ? 'text-success' : 'text-error')}>{signed(e.amount)}</span>
                    <span className="text-[13px] text-muted-foreground tabular-nums">余额 {e.after}</span>
                  </span>
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
        )}
      </section>
    </div>
  )
}

const Invite: React.FC<{ invite: Data['invite'] }> = ({ invite }) => {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard?.writeText(invite.link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <section className="flex flex-col gap-3">
      <H2>邀请好友</H2>
      <p className="text-[15px] text-muted-foreground">好友打开你的链接、用新邮箱注册后，你们都能得到额度。</p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="邀请链接"
          className="h-11 min-w-0 flex-[1_1_240px] border border-input bg-background px-3 text-[15px]"
          data-testid="invite-link"
          onFocus={(e) => e.target.select()}
          readOnly
          value={invite.link}
        />
        <Button className="h-11" data-testid="invite-copy" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <p className="text-[13px] text-muted-foreground" data-testid="invite-stats">
        已邀请 {invite.count} 人，得到 {invite.earned} 额度
        {invite.capped && `。邀请奖励已达上限（${invite.cap} 次），好友注册仍能得到额度`}
      </p>
    </section>
  )
}

const STATUS = { pending: '审核中', approved: '已通过', rejected: '未通过' } as const

const Notes: React.FC<{ submissions: Submission[]; onSubmitted: () => void }> = ({ submissions, onSubmitted }) => {
  const [text, setText] = useState('')
  const [remark, setRemark] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (!file) return setPreview('')
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return setError('请附上笔记截图')
    setBusy(true)
    setError('')
    const body = new FormData()
    // Payload 的 multipart 约定：普通字段放进 _payload（JSON），文件放 file
    body.set('_payload', JSON.stringify({ text, remark }))
    body.set('file', file)
    const res = await fetch('/api/me/notes', { method: 'POST', credentials: 'include', body }).catch(() => null)
    setBusy(false)
    if (!res) return setError('网络不通，请稍后再试')
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? '提交失败')
    setText('')
    setRemark('')
    setFile(null)
    setFormKey(formKey + 1)
    onSubmitted()
  }

  return (
    <section className="flex flex-col gap-3">
      <H2>小红书笔记换额度</H2>
      <p className="text-[15px] text-muted-foreground">在小红书发一篇介绍本站的笔记，提交链接和截图，审核通过后发放额度。</p>
      <form className="flex flex-col gap-2" key={formKey} onSubmit={submit}>
        <label className="text-[13px] text-muted-foreground" htmlFor="note-text">
          笔记链接（可以直接粘贴 App 里复制的分享文字）
        </label>
        <textarea
          className="min-h-20 border border-input bg-background px-3 py-2 text-[15px]"
          data-testid="note-text"
          id="note-text"
          onChange={(e) => setText(e.target.value)}
          required
          value={text}
        />
        <label className="text-[13px] text-muted-foreground" htmlFor="note-file">
          笔记截图（不超过 5MB）
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="min-h-11 text-[15px] file:mr-3 file:min-h-11 file:border-[1.5px] file:border-foreground file:bg-background file:px-4"
          data-testid="note-file"
          id="note-file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          type="file"
        />
        {preview && <img alt="截图预览" className="max-h-60 w-auto self-start border border-border" src={preview} />}
        <label className="text-[13px] text-muted-foreground" htmlFor="note-remark">
          附言（可选）
        </label>
        <input
          className="h-11 border border-input bg-background px-3 text-[15px]"
          id="note-remark"
          maxLength={200}
          onChange={(e) => setRemark(e.target.value)}
          value={remark}
        />
        <p aria-live="polite" className="min-h-6 text-[13px] text-error" data-testid="note-error">
          {error}
        </p>
        <Button className="self-start" data-testid="note-submit" disabled={busy} type="submit">
          {busy ? '提交中…' : '提交审核'}
        </Button>
      </form>

      {submissions.length > 0 && (
        <ul className="mt-2 border-t border-border">
          {submissions.map((s) => (
            <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3" data-testid="note-row" key={s.id}>
              {s.screenshot && (
                <a href={s.screenshot} rel="noreferrer" target="_blank">
                  <img alt="笔记截图" className="size-14 border border-border object-cover" src={s.screenshot} />
                </a>
              )}
              <span className="min-w-0 flex-[1_1_200px]">
                <a className="block truncate text-[15px] underline underline-offset-4" href={s.url} rel="noreferrer" target="_blank">
                  {s.url}
                </a>
                <span className="text-[13px] text-muted-foreground">{when(s.at)}</span>
              </span>
              <span
                className={cn(
                  'text-[13px] font-medium',
                  s.status === 'approved' ? 'text-success' : s.status === 'rejected' ? 'text-error' : 'text-muted-foreground',
                )}
                data-testid="note-status"
              >
                {STATUS[s.status]}
                {s.status === 'approved' && s.amount ? ` +${s.amount}` : ''}
                {s.status === 'rejected' && s.reason ? `：${s.reason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
