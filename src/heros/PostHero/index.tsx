import { formatDateTime } from 'src/utilities/formatDateTime'
import Link from 'next/link'
import React from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { seasonLabel, SUBJECTS } from '@/content/jijing'
import { formatAuthors } from '@/utilities/formatAuthors'

// 文章页头：和 /jijing 列表同一套纸面排版（面包屑、墨色标题、一行元信息），头图放在标题下面，不压字
export const PostHero: React.FC<{
  post: Post
}> = ({ post }) => {
  const { column, heroImage, populatedAuthors, publishedAt, season, subjects, title } = post
  const jijing = column === 'jijing'
  const authors = populatedAuthors?.length ? formatAuthors(populatedAuthors) : ''
  const meta = [
    jijing && season ? seasonLabel(season) : '',
    ...(subjects ?? []).map((s) => SUBJECTS.find((x) => x.value === s)?.label ?? ''),
    authors,
  ].filter(Boolean)

  return (
    <header className="container pt-10 md:pt-14">
      <div className="mx-auto flex max-w-[48rem] flex-col gap-3">
        <nav aria-label="当前位置" className="text-[13px] text-muted-foreground">
          <Link className="inline-flex min-h-11 items-center hover:text-foreground" href="/">
            首页
          </Link>{' '}
          /{' '}
          <Link className="inline-flex min-h-11 items-center hover:text-foreground" href={jijing ? '/jijing' : '/posts'}>
            {jijing ? '机经' : '备考文章'}
          </Link>
        </nav>
        <h1 className="text-[clamp(30px,4vw,48px)] leading-tight font-medium tracking-[-0.02em] text-balance">{title}</h1>
        <p className="text-[13px] text-muted-foreground">
          {publishedAt && <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>}
          {meta.map((m) => ` · ${m}`).join('')}
        </p>
        {heroImage && typeof heroImage !== 'string' && (
          <Media className="mt-4" imgClassName="h-auto w-full" priority resource={heroImage} />
        )}
      </div>
    </header>
  )
}
