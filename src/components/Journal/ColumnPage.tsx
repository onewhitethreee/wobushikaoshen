import { Hourglass } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import type { ColumnConfig } from '@/sample'

import { CostMark } from './CostMark'
import { PracticeBrowser } from './PracticeBrowser'
import { Sidebar } from './Sidebar'

export type ColumnQuery = Record<string, string | undefined>

// 练习、批改、模考界面上线前，点进来的人看到一句诚实的说明，而不是同一张列表
const pendingNotice = (config: ColumnConfig, q: ColumnQuery) => {
  const id = q.start ?? q.review ?? q.mock
  const row = id ? config.rows.find((r) => r.id === id) : undefined
  if (!row) return null
  if (q.review) return `「${row.title}」的 AI 批改即将开放。现在点了不会扣额度，先写着，开放后再交。`
  if (q.mock && config.slug === 'speaking') return `「${row.title}」的 AI 口语模考即将开放。现在点了不会扣额度。`
  if (config.slug === 'mock') return '模考界面正在按电脑考试 1:1 制作，上线后从这里直接进入。'
  return `「${row.title}」的练习界面正在做，上线后点这里就能直接开始。先看看别的题，或者明天再来。`
}

// 五个栏目页共用：三栏，标题区放在中栏顶部（006 FR-054）
export const ColumnPage: React.FC<{ config: ColumnConfig; loggedIn: boolean; query: ColumnQuery }> = ({
  config,
  loggedIn,
  query,
}) => {
  const notice = pendingNotice(config, query)
  const mock = config.sidebar.find((m) => m.kind === 'mock')
  const filters: Record<string, string> = {}
  for (const t of config.tabs) for (const f of t.filters) if (query[f.id]) filters[f.id] = query[f.id]!

  const header = (
    <div className="flex flex-col gap-3" key="header">
      <nav aria-label="面包屑" className="text-[13px] text-muted-foreground">
        <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
          首页
        </Link>{' '}
        / {config.title}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h1 className="text-[clamp(40px,4.4vw,60px)] leading-[1.1] font-medium tracking-[-0.02em]">{config.title}</h1>
        <CostMark cost={config.cost} label={config.costLabel} />
      </div>
      <p className="text-[15px] text-muted-foreground">{config.note}</p>
      {query.empty === '1' && (
        <p className="flex animate-reveal items-start gap-3 bg-muted px-5 py-4 text-sm" role="status">
          <Hourglass aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          题库正在准备，过几天再来看看。
        </p>
      )}
      {notice && (
        <p className="flex animate-reveal items-start gap-3 bg-muted px-5 py-4 text-sm" data-testid="pending-notice" role="status">
          <Hourglass aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {notice}
        </p>
      )}
    </div>
  )

  return (
    <PracticeBrowser
      aside={<Sidebar key="aside" loggedIn={loggedIn} modules={config.sidebar} slug={config.slug} />}
      config={config}
      header={header}
      initial={{ tab: query.tab, filters, focus: query.focus, page: Math.max(1, Math.floor(Number(query.page))) || undefined }}
      mobileHint={mock?.kind === 'mock' ? `${mock.title}请用电脑打开` : undefined}
    />
  )
}
