'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { cn } from '@/utilities/ui'

export type NavItem = { href: string; label: string }

export const defaultNav: NavItem[] = [
  { href: '/', label: '首页' },
  { href: '/listening', label: '听力' },
  { href: '/reading', label: '阅读' },
  { href: '/writing', label: '写作' },
  { href: '/speaking', label: '口语' },
  { href: '/mock', label: '模考' },
  // 033：四 / 六级独立栏目，/cet6 也高亮这一项
  { href: '/cet4', label: '四六级' },
]

export const HeaderNav: React.FC<{ items: NavItem[] }> = ({ items }) => {
  const raw = usePathname()
  // 练习页高亮所属栏目：/practice/t1-l2 → 听力，/practice/t1-r → 阅读
  const practice = /^\/practice\/(?:t\d+|latest)-([lr])/.exec(raw)
  const pathname = practice ? (practice[1] === 'l' ? '/listening' : '/reading') : raw.replace(/^\/cet6/, '/cet4')

  return (
    <nav
      aria-label="主导航"
      className="order-last -mx-1 w-full overflow-x-auto whitespace-nowrap pb-2 md:order-none md:w-auto md:flex-1 md:pb-0"
    >
      <ul className="flex gap-1 px-1 md:gap-3">
        {items.map(({ href, label }) => {
          const current = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 min-w-11 items-center justify-center gap-2 px-3 text-[15px]',
                  current ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground hover:underline underline-offset-4',
                )}
                href={href}
              >
                {current && <span aria-hidden="true" className="size-2 bg-mark" />}
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
