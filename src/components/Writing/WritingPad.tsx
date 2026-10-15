'use client'

import React, { useEffect, useState } from 'react'

import { countWords } from '@/exam/scoring'
import { loadDrafts, saveDrafts } from '@/practice/store'
import { STORE_EVENT, schedulePush, sync } from '@/practice/syncClient'
import { cn } from '@/utilities/ui'

// 写作框：实时字数，草稿存本机（隐私模式、配额满时照常写，只是不保存）；已登录时草稿随账号同步（009）
export const WritingPad: React.FC<{ taskId: string; minWords: number }> = ({
  taskId,
  minWords,
}) => {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    setText(loadDrafts()[taskId]?.text ?? '')
    // 同步取回别的设备的草稿：本机这篇还没动过时才替换
    const onSync = () => setText((cur) => (cur === '' ? (loadDrafts()[taskId]?.text ?? '') : cur))
    window.addEventListener(STORE_EVENT, onSync)
    void sync()
    return () => window.removeEventListener(STORE_EVENT, onSync)
  }, [taskId])

  useEffect(() => {
    const t = setTimeout(() => {
      const all = loadDrafts()
      // 和已存的一样就不写：打开页面不会凭空产生一条"清空"记录
      if ((all[taskId]?.text ?? '') === text) return setSaved(true)
      all[taskId] = { text, at: Date.now() } // 清空也记下来，同步时旧草稿不会复活
      if (saveDrafts(all)) {
        setSaved(true)
        schedulePush()
      } else setSaved(false)
    }, 400)
    return () => clearTimeout(t)
  }, [text, taskId])

  const words = countWords(text)
  const short = words < minWords

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-muted-foreground" htmlFor="essay">
        在这里写（草稿自动保存在本机）
      </label>
      <textarea
        className="min-h-[360px] w-full resize-y border-[1.5px] border-input bg-background p-4 text-[16px] leading-7 outline-none focus:border-foreground"
        id="essay"
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        spellCheck={false}
        value={text}
      />
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
        <span
          className={cn('tabular-nums', short ? 'font-semibold text-warning' : 'text-success')}
          data-testid="word-count"
        >
          {words} 词{short ? ` · 还差 ${minWords - words} 词` : ' · 已达字数要求'}
        </span>
        <span className="text-muted-foreground">{saved ? '已保存在本机' : '保存中…'}</span>
      </p>
    </div>
  )
}
