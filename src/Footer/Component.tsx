import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'

import pkg from '../../package.json'

// 公开仓库（AGPL-3.0 第 13 条：通过网络提供服务时要让用户能拿到源代码）；版本号即 GitHub Release 的 tag
const REPO = 'https://github.com/onewhitethreee/wobushikaoshen'

const COLUMNS = [
  { href: '/listening', label: '听力' },
  { href: '/reading', label: '阅读' },
  { href: '/writing', label: '写作' },
  { href: '/speaking', label: '口语' },
  { href: '/mock', label: '模考' },
  { href: '/jijing', label: '机经' },
  { href: '/posts', label: '备考文章' },
]

const linkClass = 'inline-flex min-h-11 items-center hover:text-foreground hover:underline underline-offset-4'

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <nav aria-label={title} className="flex min-w-[120px] flex-col">
    <h2 className="mb-1 text-[13px] font-semibold text-foreground">{title}</h2>
    {children}
  </nav>
)

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()

  const navItems = footerData?.navItems || []
  const email = footerData?.contactEmail

  return (
    <footer className="mt-auto border-t border-border" data-testid="site-footer">
      <div className="container flex flex-col gap-8 py-10 text-[13px] text-muted-foreground">
        <div className="flex flex-wrap gap-x-16 gap-y-6">
          <Group title="栏目">
            <ul className="grid grid-cols-2 gap-x-8">
              {COLUMNS.map((c) => (
                <li key={c.href}>
                  <Link className={linkClass} href={c.href}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Group>
          <Group title="帮助">
            <Link className={linkClass} href="/help">
              使用说明与常见问题
            </Link>
            <Link className={linkClass} href="/#quota">
              领额度
            </Link>
            {email && (
              <a className={linkClass} data-testid="footer-email" href={`mailto:${email}`}>
                反馈与投诉：{email}
              </a>
            )}
          </Group>
          <Group title="关于">
            <a className={linkClass} href={REPO} rel="noreferrer" target="_blank">
              源代码（AGPL-3.0）
            </a>
            <a className={linkClass} data-testid="footer-version" href={`${REPO}/releases`} rel="noreferrer" target="_blank">
              更新日志 · v{pkg.version}
            </a>
            {navItems.map(({ link }, i) => (
              <CMSLink className={linkClass} key={i} {...link} />
            ))}
          </Group>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3 border-t border-border pt-6">
          <p>
            题目整理自网络公开资料。词典数据来自{' '}
            <a className="underline underline-offset-4 hover:text-foreground" href="https://github.com/skywind3000/ECDICT" rel="noreferrer" target="_blank">
              ECDICT
            </a>
            （MIT 许可）。
          </p>
          <span className="flex items-center gap-2">
            <span aria-hidden="true">主题</span>
            <ThemeSelector />
          </span>
        </div>
      </div>
    </footer>
  )
}
