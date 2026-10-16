import Link from 'next/link'
import React from 'react'

import { LostPaperArt } from '@/components/Illustration'
import { Button } from '@/components/ui/button'

// 链接无效、套题不存在或已下线（FR-004）
export default function NotFound() {
  return (
    <section className="container py-16">
      <div className="mx-auto flex max-w-md animate-rise flex-col items-center gap-4 bg-muted px-6 py-10 text-center">
        <LostPaperArt className="w-40" />
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">没找到这组题</h1>
        <p className="text-muted-foreground">链接可能写错了，或者这组题已下架。</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="soft">
            <Link href="/listening">去听力</Link>
          </Button>
          <Button asChild variant="soft">
            <Link href="/reading">去阅读</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
