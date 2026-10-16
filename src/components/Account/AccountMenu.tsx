'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { ChevronDown } from 'lucide-react'

import { clearLocal } from '@/practice/syncClient'

// 页头账号入口（009 contracts/ui.md）：未登录显示"登录"，已登录显示脱敏邮箱和菜单
const mask = (email: string) => {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

export const AccountMenu: React.FC = () => {
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [passwordSet, setPasswordSet] = useState(false)
  const menu = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    fetch('/api/members/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { user?: { email?: string; collection?: string; passwordSet?: boolean | null } | null }) => {
        setEmail(d.user?.collection === 'members' && d.user.email ? d.user.email : null)
        setPasswordSet(Boolean(d.user?.passwordSet))
      })
      .catch(() => setEmail(null))
  }, [])

  // 菜单里点了链接就收起
  useEffect(() => {
    if (menu.current) menu.current.open = false
  }, [pathname])

  const logout = async () => {
    await fetch('/api/members/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    clearLocal()
    window.location.assign(pathname || '/')
  }

  if (email === undefined) return <span aria-hidden="true" className="min-h-11 min-w-11" />

  if (!email) {
    const next = pathname && pathname !== '/login' ? `?next=${encodeURIComponent(pathname)}` : ''
    return (
      <Link
        className="inline-flex min-h-11 min-w-11 items-center text-muted-foreground hover:text-foreground"
        data-testid="account-menu"
        href={`/login${next}`}
      >
        登录
      </Link>
    )
  }

  return (
    <details className="relative" data-testid="account-menu" ref={menu}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        {mask(email)}
        <ChevronDown aria-hidden="true" className="size-4" strokeWidth={1.5} />
      </summary>
      <ul className="absolute right-0 z-30 mt-1 min-w-40 border border-border bg-background py-1 text-sm">
        <li>
          <Link className="flex min-h-11 items-center px-4 hover:bg-muted" href="/me/mistakes">
            错题本
          </Link>
        </li>
        <li>
          <Link className="flex min-h-11 items-center px-4 hover:bg-muted" href="/me/favorites">
            我的收藏
          </Link>
        </li>
        <li>
          <Link className="flex min-h-11 items-center px-4 hover:bg-muted" href="/me/words">
            单词本
          </Link>
        </li>
        <li>
          <Link className="flex min-h-11 items-center px-4 hover:bg-muted" href="/me/review">
            背单词
          </Link>
        </li>
        <li>
          <Link className="flex min-h-11 items-center px-4 hover:bg-muted" href="/me/credits">
            我的额度
          </Link>
        </li>
        <li>
          <Link className="flex min-h-11 items-center px-4 hover:bg-muted" href="/me/password">
            {passwordSet ? '修改密码' : '设置密码'}
          </Link>
        </li>
        <li className="border-t border-border">
          <button className="flex min-h-11 w-full items-center px-4 text-left hover:bg-muted" onClick={logout} type="button">
            退出
          </button>
        </li>
      </ul>
    </details>
  )
}
