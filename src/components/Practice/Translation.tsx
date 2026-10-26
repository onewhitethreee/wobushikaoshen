'use client'

import { Languages, type LucideIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { cn } from '@/utilities/ui'

// 033 四 / 六级练习页的开关（译文、听力隐藏题干）：偏好记在本机，同一个键的几处开关保持一致
const usePref = (key: string, fallback: boolean): [boolean, () => void] => {
  const [on, setOn] = useState(fallback)
  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem(key)
        setOn(v === null ? fallback : v === '1')
      } catch {
        // 读不到按默认
      }
    }
    read()
    window.addEventListener(key, read)
    return () => window.removeEventListener(key, read)
  }, [key, fallback])
  const toggle = () => {
    const next = !on
    setOn(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      // 记不住只是下次要再点一次
    }
    window.dispatchEvent(new Event(key))
  }
  return [on, toggle]
}

/** 译文开关，默认关 */
export const useTranslation = () => usePref('ybz:cet-translation:v1', false)
/** 四 / 六级听力隐藏题干，默认隐藏（试卷上只印选项，题干在录音里） */
export const useHideStem = () => usePref('ybz:cet-hide-stem:v1', true)

export const TranslationButton: React.FC<{ on: boolean; onToggle: () => void; className?: string; label?: string; testId?: string; icon?: LucideIcon }> = ({
  on,
  onToggle,
  className,
  label = '显示译文',
  testId = 'translation-toggle',
  icon: Icon = Languages,
}) => (
  <button
    aria-pressed={on}
    className={cn(
      'inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold underline-offset-4 hover:underline',
      className,
    )}
    data-hl-skip=""
    data-testid={testId}
    onClick={onToggle}
    type="button"
  >
    <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
    {label}
  </button>
)

/** 译文段：不参与高亮偏移（data-hl-skip）和取词（data-no-lookup） */
export const TranslationText: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <span
    className={cn('block text-[14px] leading-[1.7] text-muted-foreground', className)}
    data-hl-skip=""
    data-no-lookup=""
    data-testid="translation"
    lang="zh-CN"
  >
    {text}
  </span>
)
