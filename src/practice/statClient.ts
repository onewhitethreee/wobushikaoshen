// 035 题目作答统计：交卷后匿名上传作答（research R5）。不等待、不报错，失败只少一条统计（FR-005）
import React from 'react'

import type { PracticeRecord } from './store'

const DEVICE_KEY = 'ybz:device'

/** 本机随机设备号，未登录时用来判断是不是第一次做（research R3）；本机存储不可用时返回 null */
export const deviceId = (): string | null => {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** units：随机模考由浏览器抽的 7 个单元 id，服务端靠它把作答拆回来源单元 */
export const postStat = (record: PracticeRecord, units?: number[]) => {
  if (!record.answers) return
  try {
    fetch('/api/stats/attempts', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: record.unitId, at: record.at, answers: record.answers, device: deviceId(), ...(units ? { units } : {}) }),
    }).catch(() => {})
  } catch {}
}

export type UnitStats = {
  unit: { people: number; avgRate: number; dist: Record<number, number> } | null
  questions: Record<number, { people: number; rate: number; avg?: number; span?: number }>
}

// 同一单元只取一次（解析面板每题、成绩面板共用）；失败记 null，不重试
const loaded = new Map<string, Promise<UnitStats | null>>()
const fetchStats = (unitId: string) => {
  let p = loaded.get(unitId)
  if (!p) {
    p = fetch(`/api/stats/unit?id=${encodeURIComponent(unitId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<UnitStats>) : null))
      .catch(() => null)
    loaded.set(unitId, p)
  }
  return p
}

/** 一次取几个单元（模考按来源单元）；没数据、失败、加载中都是 null，调用方什么都不显示（FR-019） */
export const useStatsList = (unitIds: string[], enabled: boolean) => {
  const key = unitIds.join('|')
  // 记下数据属于哪组单元：换了单元、新数据还没回来时不显示上一组的数字
  const [state, setState] = React.useState<{ key: string; stats: (UnitStats | null)[] }>({ key: '', stats: [] })
  React.useEffect(() => {
    if (!enabled || !key) return
    let live = true
    Promise.all(key.split('|').map(fetchStats)).then((stats) => live && setState({ key, stats }))
    return () => {
      live = false
    }
  }, [key, enabled])
  return enabled && state.key === key ? state.stats : []
}

/** 交卷后才取（enabled） */
export const useUnitStats = (unitId: string | undefined, enabled: boolean) => useStatsList(unitId ? [unitId] : [], enabled)[0] ?? null

/** "你超过了 X% 的考生"：得分低于本次的人数 / 总人数，四舍五入 */
export const beatPercent = (dist: Record<number, number>, score: number) => {
  let total = 0
  let below = 0
  for (const [s, n] of Object.entries(dist)) {
    total += n
    if (Number(s) < score) below += n
  }
  return total ? Math.round((below / total) * 100) : 0
}
