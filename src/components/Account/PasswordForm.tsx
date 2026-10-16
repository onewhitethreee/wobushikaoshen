'use client'

import React, { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkPassword } from '@/account/passwordRules'

// 设置 / 修改密码（012 contracts/ui.md）

/** 带"显示 / 隐藏"的密码框，登录框也用它 */
export const PasswordInput: React.FC<React.ComponentProps<typeof Input>> = (props) => {
  const [shown, setShown] = useState(false)
  return (
    <div className="flex">
      <Input {...props} className="h-11 flex-1 border-input" type={shown ? 'text' : 'password'} />
      <button
        aria-label={shown ? '隐藏密码' : '显示密码'}
        aria-pressed={shown}
        className="min-h-11 min-w-14 border border-l-0 border-input px-3 text-[13px] text-muted-foreground hover:text-foreground"
        onClick={() => setShown(!shown)}
        type="button"
      >
        {shown ? '隐藏' : '显示'}
      </button>
    </div>
  )
}

export const PasswordForm: React.FC = () => {
  const [me, setMe] = useState<{ email: string; passwordSet: boolean } | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/members/me', { credentials: 'include' })
      .then((r) => r.json())
      .then(
        (d: {
          user?: { email?: string; collection?: string; passwordSet?: boolean | null } | null
        }) => {
          if (d.user?.collection === 'members' && d.user.email)
            setMe({ email: d.user.email, passwordSet: Boolean(d.user.passwordSet) })
          else window.location.assign('/login?next=/me/password')
        },
      )
      .catch(() => window.location.assign('/login?next=/me/password'))
  }, [])

  if (!me) return <p className="min-h-40 text-[15px] text-muted-foreground">加载中…</p>

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setDone('')
    const local = checkPassword(password, confirm, me.email)
    if (local) return setError(local)
    setBusy(true)
    setError('')
    const res = await fetch('/api/me/password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirm }),
    }).catch(() => null)
    const data = ((await res?.json().catch(() => ({}))) ?? {}) as {
      error?: string
      firstTime?: boolean
    }
    setBusy(false)
    if (!res?.ok) return setError(res ? (data.error ?? '保存失败') : '网络不通，请稍后再试')
    setDone(data.firstTime ? '已设置，下次可以用密码登录' : '密码已修改，其他设备需要重新登录')
    setPassword('')
    setConfirm('')
    setMe({ ...me, passwordSet: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[24px] font-medium tracking-[-0.01em]">
          {me.passwordSet ? '修改密码' : '设置密码'}
        </h1>
        <p className="text-[15px] leading-[1.7] text-muted-foreground">
          设好后可以用密码登录，验证码登录也照常能用。
          {me.passwordSet && '修改后，其他设备需要重新登录。'}
        </p>
      </div>
      <form className="flex flex-col gap-2" onSubmit={save}>
        {/* 让密码管理器知道这是哪个账号的密码 */}
        <input autoComplete="username" className="hidden" readOnly value={me.email} />
        <label className="text-[13px] text-muted-foreground" htmlFor="password-new">
          新密码
        </label>
        <PasswordInput
          autoComplete="new-password"
          data-testid="password-new"
          id="password-new"
          onChange={(e) => setPassword(e.target.value)}
          required
          value={password}
        />
        <label className="mt-2 text-[13px] text-muted-foreground" htmlFor="password-confirm">
          再输一次
        </label>
        <Input
          autoComplete="new-password"
          className="h-11 border-input"
          data-testid="password-confirm"
          id="password-confirm"
          onChange={(e) => setConfirm(e.target.value)}
          required
          type="password"
          value={confirm}
        />
        <p className="text-[13px] text-muted-foreground">8–64 个字符，不能和邮箱相同。</p>
        <p aria-live="polite" className="min-h-6 text-[13px] text-error">
          {error}
        </p>
        <Button data-testid="password-save" disabled={busy} type="submit">
          {busy ? '保存中…' : '保存'}
        </Button>
        <p
          aria-live="polite"
          className="min-h-6 text-[15px] text-foreground"
          data-testid="password-done"
        >
          {done}
        </p>
      </form>
    </div>
  )
}
