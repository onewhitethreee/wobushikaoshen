'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { activeAttempt, next, RANDOM_NO } from '@/practice/mockAttempt'
import { load, save, saveAttempt } from '@/practice/store'
import { schedulePush } from '@/practice/syncClient'

// 028：卷子或其中某个单元已下架。正在考这张卷子的那场无法继续，记为放弃（spec 边界情况）
export const MockGone: React.FC<{ no: number }> = ({ no }) => {
  const [stopped, setStopped] = useState(false)
  useEffect(() => {
    const { store } = load()
    const a = activeAttempt(store.mocks)
    if (a?.no !== no) return
    saveAttempt(store, next(a, 'abandoned'))
    save(store)
    schedulePush()
    setStopped(true)
  }, [no])
  return (
    <div className="container py-10">
      <div className="flex max-w-xl flex-col items-start gap-3" role="status">
        <h1 className="text-[22px] font-medium">{no === RANDOM_NO ? '抽到的题有已下架的' : '这张卷子已下架'}</h1>
        {stopped && <p className="text-muted-foreground">你正在考的这一场无法继续，已结束，不留成绩。</p>}
        <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={no === RANDOM_NO ? '/mock/random' : '/mock'}>
          {no === RANDOM_NO ? '重新抽一场' : '换一张卷子'}
        </Link>
      </div>
    </div>
  )
}
