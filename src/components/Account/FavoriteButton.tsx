'use client'

import { Star } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { isFavorite, load, save, toggleFavorite } from '@/practice/store'
import { STORE_EVENT, schedulePush } from '@/practice/syncClient'
import { cn } from '@/utilities/ui'

// 收藏（009 US4、contracts/ui.md）：一次点击收藏 / 取消，存本机，已登录时随账号同步
export const FavoriteButton: React.FC<{ favKey: string; className?: string }> = ({ favKey, className }) => {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const read = () => setOn(isFavorite(load().store, favKey))
    read()
    window.addEventListener(STORE_EVENT, read)
    return () => window.removeEventListener(STORE_EVENT, read)
  }, [favKey])

  const toggle = () => {
    const { store } = load()
    const next = toggleFavorite(store, favKey)
    if (!save(store)) return
    setOn(next)
    schedulePush()
    window.dispatchEvent(new Event(STORE_EVENT)) // 同页其他收藏按钮、收藏列表跟着变
  }

  return (
    <button
      aria-label={on ? '取消收藏' : '收藏'}
      aria-pressed={on}
      className={cn('inline-flex size-11 shrink-0 items-center justify-center', on ? 'text-mark' : 'text-muted-foreground hover:text-foreground', className)}
      data-testid="fav-btn"
      onClick={toggle}
      title={on ? '取消收藏' : '收藏'}
      type="button"
    >
      <Star aria-hidden="true" className="size-6" fill={on ? 'currentColor' : 'none'} strokeWidth={1.5} />
    </button>
  )
}
