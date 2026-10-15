'use client'

import React, { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mergeOnLogin } from '@/practice/syncClient'

// 两步登录（009 contracts/ui.md）：填邮箱收验证码 → 填 6 位数字
const post = async (url: string, body: unknown) => {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; retryIn?: number; resendIn?: number }
  return { ok: res.ok, status: res.status, ...data }
}

/** 只跳本站页面，防止被拿来跳到别的网站（按浏览器的规则解析，/\t/evil.com 之类也拦得住） */
export const safeNext = (next?: string) => {
  if (!next?.startsWith('/')) return '/'
  try {
    const u = new URL(next, window.location.origin)
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : '/'
  } catch {
    return '/'
  }
}

export const LoginForm: React.FC<{ next?: string }> = ({ next }) => {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    const r = await post('/api/auth/code', { email }).catch(() => ({ ok: false, error: '网络不通，请稍后再试', retryIn: undefined, resendIn: undefined }))
    setBusy(false)
    if (r.ok) {
      setStep('code')
      setWait(r.resendIn ?? 60)
    } else {
      setError(r.error ?? '发送失败')
      if (r.retryIn && r.retryIn <= 60) setWait(r.retryIn)
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await post('/api/auth/verify', { email, code }).catch(() => ({ ok: false, error: '网络不通，请稍后再试' }))
    if (!r.ok) {
      setBusy(false)
      setError(r.error ?? '登录失败')
      return
    }
    // 这台设备上未登录时做的题并入账号（FR-022），再回到原来的页面
    setMerging(true)
    await mergeOnLogin()
    window.location.assign(safeNext(next))
  }

  const errorLine = (
    <p aria-live="polite" className="min-h-6 text-[13px] text-error">
      {error}
    </p>
  )

  if (merging) {
    return (
      <p aria-live="polite" className="text-[15px] text-muted-foreground">
        登录成功，正在合并这台设备上的做题记录…
      </p>
    )
  }

  if (step === 'email') {
    return (
      <form className="flex flex-col gap-2" onSubmit={send}>
        <label className="text-[13px] text-muted-foreground" htmlFor="login-email">
          邮箱
        </label>
        <Input
          autoComplete="email"
          className="h-11 border-input"
          data-testid="login-email"
          id="login-email"
          inputMode="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        {errorLine}
        <Button data-testid="login-send" disabled={busy || wait > 0} type="submit">
          {busy ? '发送中…' : wait > 0 ? `请 ${wait} 秒后再发` : '发送验证码'}
        </Button>
      </form>
    )
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={verify}>
      <p className="text-[13px] text-muted-foreground">
        验证码已发到 <span className="text-foreground">{email}</span>，10 分钟内有效。没收到请查看垃圾邮件。
      </p>
      <label className="text-[13px] text-muted-foreground" htmlFor="login-code">
        6 位验证码
      </label>
      <Input
        autoComplete="one-time-code"
        autoFocus
        className="h-11 border-input tracking-[0.3em] tabular-nums"
        data-testid="login-code"
        id="login-code"
        inputMode="numeric"
        maxLength={6}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        pattern="\d{6}"
        required
        value={code}
      />
      {errorLine}
      <Button data-testid="login-submit" disabled={busy || code.length !== 6} type="submit">
        {busy ? '登录中…' : '登录'}
      </Button>
      <div className="flex flex-wrap gap-x-4 text-[13px]">
        <button
          className="min-h-11 text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground"
          disabled={busy || wait > 0}
          onClick={() => send()}
          type="button"
        >
          {wait > 0 ? `重新发送（${wait}）` : '重新发送'}
        </button>
        <button
          className="min-h-11 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setStep('email')
            setCode('')
            setError('')
          }}
          type="button"
        >
          换个邮箱
        </button>
      </div>
    </form>
  )
}
