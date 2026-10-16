import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border">
      <div className="container py-8 flex flex-wrap items-center gap-x-10 gap-y-3 justify-between text-[13px] text-muted-foreground">
        <p>
          题目整理自网络公开资料。词典数据来自{' '}
          <a className="underline underline-offset-4 hover:text-foreground" href="https://github.com/skywind3000/ECDICT" rel="noreferrer" target="_blank">
            ECDICT
          </a>
          （MIT 许可）。
        </p>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {navItems.map(({ link }, i) => {
            return <CMSLink className="hover:text-foreground hover:underline underline-offset-4" key={i} {...link} />
          })}
          <span className="flex items-center gap-2">
            <span aria-hidden="true">主题</span>
            <ThemeSelector />
          </span>
        </div>
      </div>
    </footer>
  )
}
