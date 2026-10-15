'use client'

import { ArrowUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/ui'

// 直接进最新一套的 Part 1 / Passage 1（服务端重定向）。没有 JS 时表单提交到听力入口。
const options = [
  { value: '/practice/latest-l1', label: '听力 Part 1', minutes: 6 },
  { value: '/practice/latest-r1', label: '阅读 Passage 1', minutes: 20 },
]

export const StartForm: React.FC<{ className?: string }> = ({ className }) => {
  const router = useRouter()
  const [target, setTarget] = useState(options[0].value)
  const current = options.find((o) => o.value === target) ?? options[0]

  return (
    <form
      action="/practice/latest-l1"
      className={cn('flex flex-col gap-3', className)}
      onSubmit={(e) => {
        e.preventDefault()
        router.push(target)
      }}
    >
      {/* 方块单选：选中为 2px 近黑描边 */}
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-sm text-muted-foreground">先做哪一科</legend>
        {options.map((o) => {
          const on = o.value === target
          return (
            <label
              className={cn(
                'flex min-h-16 cursor-pointer flex-col justify-center px-4 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                on ? 'bg-background ring-2 ring-foreground ring-inset' : 'ring-1 ring-input ring-inset hover:ring-foreground',
              )}
              key={o.value}
            >
              <input checked={on} className="sr-only" name="start" onChange={() => setTarget(o.value)} type="radio" value={o.value} />
              <span className="font-semibold">{o.label}</span>
              <span className="text-[13px] text-muted-foreground">约 {o.minutes} 分钟</span>
            </label>
          )
        })}
      </fieldset>
      <Button className="justify-between" size="lg" type="submit">
        <span>开始做题</span>
        <span className="inline-flex items-center gap-3 text-sm font-normal">
          免费 · 约 {current.minutes} 分钟
          <ArrowUpRight aria-hidden="true" strokeWidth={2} />
        </span>
      </Button>
      <p className="text-[13px] text-muted-foreground">不用登录 · 不收集手机号 · 没有广告</p>
    </form>
  )
}
