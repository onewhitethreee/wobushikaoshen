'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { doneUnits, drawPaper, SLOTS, type Pool } from '@/exam/mock'
import { activeAttempt, attemptId, RANDOM_NO } from '@/practice/mockAttempt'
import { load } from '@/practice/store'
import { sync } from '@/practice/syncClient'

// 随机一场：在浏览器里抽题（要看本机 / 账号的做题记录，优先没做过的），抽好后带上 7 个单元 id 打开考试页。
// 有进行中的随机一场就回到那一场；?a= 看某一场成绩时用那一场存下的单元
export const RandomDraw: React.FC<{ pool: Pool; view?: number }> = ({ pool, view }) => {
  const router = useRouter()
  const [empty, setEmpty] = useState(false)

  const drawn = useRef(false)

  useEffect(() => {
    // 只抽一次（开发模式 effect 跑两遍会抽出两套）
    if (drawn.current) return
    drawn.current = true
    const go = (units: number[], a?: number) => router.replace(`/mock/random?u=${units.join(',')}${a ? `&a=${a}` : ''}`)
    const draw = () => {
      const { store } = load()
      if (view) {
        const a = store.mocks[attemptId({ no: RANDOM_NO, startedAt: view })]
        if (a?.units) return go(a.units, view)
      }
      const act = activeAttempt(store.mocks)
      if (act?.no === RANDOM_NO && act.units) return go(act.units)
      const picked = drawPaper(pool, doneUnits(store.records))
      if (!picked) return setEmpty(true)
      go(SLOTS.map((s) => picked[s.key]))
    }
    // 已登录时先取回账号上的做题记录，再按记录抽
    void sync().finally(draw)
  }, [pool, view, router])

  return (
    <div className="container py-10" role="status">
      {empty ? '题库还不够组一场模考。' : '正在抽题…'}
    </div>
  )
}
