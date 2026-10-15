import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { UserPlus } from 'lucide-react'
import { AccountMenu } from '@/components/Account/AccountMenu'
import { defaultNav, HeaderNav, type NavItem } from './Nav'

// 导航读后台 Header 设置；后台还没填时用默认的 6 项
export async function Header() {
  const header = await getCachedGlobal('header', 1)()
  const items: NavItem[] = (header?.navItems ?? []).flatMap(({ link }) => {
    const ref = link.reference?.value
    const href =
      link.type === 'reference' && typeof ref === 'object' && ref?.slug
        ? `${link.reference?.relationTo === 'pages' ? '' : `/${link.reference?.relationTo}`}/${ref.slug}`
        : link.url
    return href && link.label ? [{ href, label: link.label }] : []
  })

  return (
    <header className="border-b border-border">
      <div className="container flex flex-wrap items-center gap-x-6 md:gap-x-10 min-h-16">
        <Link className="group flex items-center gap-2.5 py-3" href="/">
          <LogoMark />
          <span className="text-2xl font-medium tracking-[-0.02em]">我不是考神</span>
          <span className="hidden bg-muted px-2 py-0.5 text-[12px] text-muted-foreground sm:inline">学术类</span>
        </Link>
        <HeaderNav items={items.length ? items : defaultNav} />
        <div className="ml-auto flex items-center gap-2 text-sm sm:gap-4">
          <AccountMenu />
          <Link
            className="inline-flex min-h-11 items-center gap-1.5 bg-muted px-4 hover:bg-primary hover:text-primary-foreground"
            href="/#quota"
          >
            <UserPlus aria-hidden="true" className="size-4" strokeWidth={1.5} />
            领额度
          </Link>
        </div>
      </div>
    </header>
  )
}

// 站标：斜放的学士帽 + 明黄流苏（与 public/logo.svg 同形；帽身跟随文字色，深色模式自动反白）
const LogoMark: React.FC = () => (
  <svg aria-hidden="true" className="size-9 shrink-0 transition-transform duration-300 group-hover:-rotate-6" viewBox="10 8 84 84">
    <g transform="rotate(-12 50 50)">
      <polygon fill="currentColor" points="50,24 86,38 50,52 14,38" />
      <path d="M32 47 L50 54 L68 47 L68 62 Q50 72 32 62 Z" fill="currentColor" />
      <path d="M50 38 L82 39 L82 58" fill="none" stroke="var(--sun)" strokeLinejoin="round" strokeWidth="3" />
      <rect fill="var(--sun)" height="10" width="6" x="79" y="57" />
    </g>
  </svg>
)
