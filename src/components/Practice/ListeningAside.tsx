import { Eye, EyeOff } from 'lucide-react'
import React from 'react'

import type { Section } from '@/exam/practice'

import { TranscriptView } from './TranscriptView'
import { TranslationButton, useTranslation } from './Translation'

const MapImage: React.FC<{ src: string }> = ({ src }) => (
  <a className="block" href={src} rel="noreferrer" target="_blank" title="点开看大图">
    {/* 媒体直连原地址，不走 next/image 的服务端转发 */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="题目配图" className="w-auto max-w-full rounded-xl border border-border" loading="lazy" src={src} />
  </a>
)

// 听力左栏（008 research R6）：交卷前放各题组说明和配图，交卷后放原文，配图折叠在原文上方；原文可隐藏
export const ListeningAside: React.FC<{
  section: Section
  submitted: boolean
  highlight?: string
  /** 026 同义替换的原文说法 */
  marks?: string[]
  transcriptHidden: boolean
  onToggleTranscript: () => void
  /** 004：正在播放的句子、点句播放、跟随暂停时的"回到当前句" */
  current?: number
  onPick?: (n: number) => void
  onResume?: () => void
}> = ({ section, submitted, highlight, marks, transcriptHidden, onToggleTranscript, current, onPick, onResume }) => {
  const images = section.groups.flatMap((g) => (g.imageUrl ? [g.imageUrl] : []))
  // 033 四 / 六级：交卷后原文可切换显示每段译文
  const [showZh, toggleZh] = useTranslation()
  const hasZh = Boolean(section.transcriptTranslations?.length) && Array.isArray(section.transcript)

  if (!submitted) {
    const notes = section.groups.filter((g) => g.instructions || g.imageUrl)
    if (!notes.length) return <p className="py-6 text-sm text-muted-foreground">交卷后这里显示原文</p>
    return (
      <div className="flex flex-col gap-6 py-2" data-hl="n">
        {notes.map((g) => (
          <div className="flex flex-col gap-3" key={g.key}>
            {g.instructions && <p className="text-sm italic text-muted-foreground">{g.instructions}</p>}
            {g.imageUrl && <MapImage src={g.imageUrl} />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      {onResume && !transcriptHidden && (
        <button
          className="sticky top-2 z-10 -mb-11 inline-flex min-h-11 items-center self-end bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/88"
          onClick={onResume}
          type="button"
        >
          回到当前句
        </button>
      )}
      {section.transcript && (
        <button
          aria-expanded={!transcriptHidden}
          className="inline-flex min-h-11 items-center gap-2 self-start border-[1.5px] border-foreground px-5 text-sm font-semibold hover:bg-primary hover:text-primary-foreground"
          onClick={onToggleTranscript}
          type="button"
        >
          {transcriptHidden ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
          {transcriptHidden ? '显示原文' : '隐藏原文'}
        </button>
      )}
      {images.length > 0 && (
        <details className="rounded-xl border border-border">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">查看地图 / 配图</summary>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {images.map((src) => (
              <MapImage key={src} src={src} />
            ))}
          </div>
        </details>
      )}
      {hasZh && !transcriptHidden && <TranslationButton on={showZh} onToggle={toggleZh} />}
      {transcriptHidden ? null : section.transcript ? (
        <div className="text-[15px] leading-7 whitespace-pre-line" data-hl="t">
          {typeof section.transcript === 'string' ? (
            section.transcript
          ) : (
            <TranscriptView
              current={current}
              highlight={highlight}
              lines={section.transcript}
              marks={marks}
              onPick={onPick}
              translations={showZh ? section.transcriptTranslations : undefined}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">这个 Part 暂无原文。</p>
      )}
    </div>
  )
}
