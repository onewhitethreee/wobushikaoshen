'use client'

import React, { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mergeOnLogin } from '@/practice/syncClient'
import { cn } from '@/utilities/ui'

import { PasswordInput } from './PasswordForm'

// 两种登录（012 contracts/ui.md）：验证码（009：填邮箱收验证码 → 填 6 位数字）或邮箱 + 密码；邮箱两边共用
const post = async (url: string, body: unknown) => {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    retryIn?: number
    resendIn?: number
    invite?: { amount: number; inviterRewarded: boolean }
  }
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

type Method = 'code' | 'password'
// 默认用这台设备上次成功的方式
const METHOD_KEY = 'ybz_login_method'
const readMethod = (): Method => {
  try {
    return localStorage.getItem(METHOD_KEY) === 'password' ? 'password' : 'code'
  } catch {
    return 'code'
  }
}
const saveMethod = (m: Method) => {
  try {
    localStorage.setItem(METHOD_KEY, m)
  } catch {}
}

export const LoginForm: React.FC<{ next?: string }> = ({ next }) => {
  const [method, setMethod] = useState<Method>('code')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const [merging, setMerging] = useState(false)

  // 挂载后再读，免得服务端和浏览器渲染不一致
  useEffect(() => setMethod(readMethod()), [])

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

  /** 两种方式登录成功后都一样：这台设备上未登录时做的题并入账号（009 FR-022），再跳走 */
  const finish = async (m: Method, to: string) => {
    saveMethod(m)
    setMerging(true)
    await mergeOnLogin()
    window.location.assign(to)
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
    // 通过邀请链接注册的新用户：先去"我的额度"看到奖励提示（011 contracts/ui.md）
    const inv = 'invite' in r ? r.invite : undefined
    await finish('code', inv ? `/me/credits?invited=${inv.amount}${inv.inviterRewarded ? '&both=1' : ''}` : safeNext(next))
  }

  const passwordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await post('/api/auth/password', { email, password }).catch(() => ({ ok: false, error: '网络不通，请稍后再试' }))
    if (!r.ok) {
      setBusy(false)
      setError(r.error ?? '登录失败')
      return
    }
    await finish('password', safeNext(next))
  }

  const switchTo = (m: Method) => {
    setMethod(m)
    setStep('email')
    setCode('')
    setError('')
  }

  const errorLine = (
    <p aria-live="polite" className="min-h-6 text-[13px] text-error">
      {error}
    </p>
  )

  if (merging) {
    return (
      <p aria-live="polite" className="text-[15px] text-muted-foreground">
        登录成功，正在跳转…
      </p>
    )
  }

  const tabs = (
    <div aria-label="登录方式" className="flex gap-x-7 border-b border-border" role="group">
      {(
        [
          ['code', '验证码登录'],
          ['password', '密码登录'],
        ] as const
      ).map(([k, label]) => (
        <button
          aria-pressed={method === k}
          className={cn(
            'inline-flex min-h-12 items-center text-[15px]',
            method === k ? 'font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground hover:text-foreground',
          )}
          data-testid={`login-tab-${k}`}
          key={k}
          onClick={() => switchTo(k)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )

  const emailField = (
    <>
      <label className="text-[13px] text-muted-foreground" htmlFor="login-email">
        邮箱
      </label>
      <Input
        autoComplete={method === 'password' ? 'username' : 'email'}
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
    </>
  )

  if (method === 'password') {
    return (
      <div className="flex flex-col gap-5">
        {tabs}
        <form className="flex flex-col gap-2" onSubmit={passwordLogin}>
          {emailField}
          <label className="mt-2 text-[13px] text-muted-foreground" htmlFor="login-password">
            密码
          </label>
          <PasswordInput
            autoComplete="current-password"
            data-testid="login-password"
            id="login-password"
            onChange={(e) => setPassword(e.target.value)}
            required
            value={password}
          />
          {errorLine}
          <Button data-testid="login-password-submit" disabled={busy} type="submit">
            {busy ? '登录中…' : '登录'}
          </Button>
          <button className="min-h-11 self-start text-[13px] text-muted-foreground hover:text-foreground" onClick={() => switchTo('code')} type="button">
            没设过密码？用验证码登录
          </button>
        </form>
      </div>
    )
  }

  if (step === 'email') {
    return (
      <div className="flex flex-col gap-5">
        {tabs}
        <form className="flex flex-col gap-2" onSubmit={send}>
          {emailField}
          {errorLine}
          <Button data-testid="login-send" disabled={busy || wait > 0} type="submit">
            {busy ? '发送中…' : wait > 0 ? `请 ${wait} 秒后再发` : '发送验证码'}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {tabs}
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
    </div>
  )
}
