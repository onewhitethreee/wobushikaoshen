import Link from 'next/link'
import React from 'react'

import { LostPaperArt } from '@/components/Illustration'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <section className="container py-16">
      <div className="mx-auto flex max-w-md animate-rise flex-col items-center gap-4 bg-muted px-6 py-10 text-center">
        <LostPaperArt className="w-40" />
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">这个页面不存在</h1>
        <p className="text-muted-foreground">链接可能写错了，回首页挑一组题做吧。</p>
        <Button asChild>
          <Link href="/">回首页</Link>
        </Button>
      </div>
    </section>
  )
}
