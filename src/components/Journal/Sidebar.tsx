import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { noteText } from '@/account/notePlatform'
import { listeningType, readingType } from '@/content/columns'
import type { ColumnSlug, SidebarModule } from '@/sample'

import { LocalAccuracy } from './LocalAccuracy'
import { QuotaBalance } from './QuotaBalance'

// 右栏（006 FR-054）：模考 = 明黄卡，额度 / 提示 = 米色卡，正确率不加底
const sand = 'bg-muted px-5 py-5'

// 提示卡里提到发笔记的那句：平台关闭时去掉，否则换成当前平台名（032 contracts/ui.md）
const noteBody = (body: string, platform: string | null) =>
  platform ? noteText(body, platform) : body.replace('发小红书笔记、邀请好友都能领。', '邀请好友就能领。')

export const Sidebar: React.FC<{ modules: SidebarModule[]; notePlatform?: string | null; slug: ColumnSlug }> = ({
  modules,
  notePlatform = '小红书',
  slug,
}) => (
  <>
    {modules.map((m, i) => {
      if (m.kind === 'mock') {
        return (
          <section className="bg-sun px-6 py-6 text-sun-foreground" key={i}>
            <h2 className="mb-1 text-2xl leading-snug font-medium tracking-[-0.02em]">{m.title}</h2>
            <p className="mb-4 text-sm">{m.meta}</p>
            <Link
              className="hidden min-h-12 items-center justify-between bg-background px-4 font-semibold text-foreground hover:bg-primary hover:text-primary-foreground lg:flex"
              href={m.href}
            >
              进入模考
              <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
            </Link>
            <p className="mt-2.5 text-[13px]">音频只播放一次，请用电脑打开</p>
          </section>
        )
      }

      if (m.kind === 'accuracy') {
        return (
          <section key={i}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[22px] font-medium tracking-[-0.01em]">我的正确率</h2>
            </div>
            {(slug === 'listening' || slug === 'reading') && (
              <LocalAccuracy slug={slug} typeNames={slug === 'listening' ? listeningType : readingType} />
            )}
          </section>
        )
      }

      if (m.kind === 'quota') {
        return (
          <section className={sand} key={i}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">我的额度</h2>
            </div>
            <QuotaBalance />
            <ul className="flex flex-col text-sm text-muted-foreground">
              {notePlatform && (
                <li className="flex items-center gap-2 border-t border-border py-2.5">{noteText('发小红书备考笔记，审核通过后发放', notePlatform)}</li>
              )}
              <li className="flex items-center gap-2 border-t border-border py-2.5">邀请好友注册后发放</li>
              <li className="flex items-center gap-2 border-t border-border py-2.5">购买：即将开放</li>
            </ul>
          </section>
        )
      }

      return (
        <section className={`${sand} text-sm text-muted-foreground`} key={i}>
          <h2 className="mb-1.5 text-[17px] font-semibold text-foreground">{m.title}</h2>
          <p>{noteBody(m.body, notePlatform)}</p>
          {m.link && (
            <Link className="mt-2 inline-flex min-h-11 items-center gap-1 font-semibold text-foreground underline underline-offset-4" href={m.link.href}>
              {m.link.label}
              <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
            </Link>
          )}
        </section>
      )
    })}
  </>
)
