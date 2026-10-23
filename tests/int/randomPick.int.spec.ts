import { beforeEach, describe, expect, it } from 'vitest'

import { addRound, clearRound, drawHref, drawRow, readRound, safeScope, scopeOf, withPick } from '@/practice/randomPick'
import type { PracticeRow } from '@/sample'

// 030 栏目随机抽题：抽题规则、范围网址
const row = (i: number, done = false): PracticeRow => ({
  id: `r${i}`,
  lead: '',
  title: '',
  meta: [],
  facets: {},
  record: done ? '上次 1/1' : undefined,
  actions: [{ label: '开始练习', href: `/practice/r${i}`, cost: { kind: 'free' } }],
})
/** 依次返回 0, 1/n, 2/n …，用来遍历每一行 */
const steps = (n: number) => Array.from({ length: n }, (_, i) => () => i / n)

describe('drawRow', () => {
  it('范围为空返回 null', () => {
    expect(drawRow([], { status: '全部', round: [] })).toBeNull()
  })

  it('状态"全部"时只抽没做过的', () => {
    const rows = [row(0, true), row(1), row(2, true), row(3)]
    for (let x = 0; x < 1; x += 0.01) {
      const r = drawRow(rows, { status: '全部', round: [], rand: () => x })!
      expect(['r1', 'r3']).toContain(r.row.id)
      expect(r.allDone).toBe(false)
    }
  })

  it('全部做过时从全部里抽，并标记 allDone', () => {
    const rows = [row(0, true), row(1, true)]
    const r = drawRow(rows, { status: '全部', round: [], rand: () => 0.9 })!
    expect(r.row.id).toBe('r1')
    expect(r.allDone).toBe(true)
  })

  it('状态"未做 / 已做"时不再按做没做过二次过滤', () => {
    const done = [row(0, true), row(1, true)]
    expect(drawRow(done, { status: '已做', round: [], rand: () => 0 })!).toMatchObject({ row: { id: 'r0' }, allDone: false })
    const mixed = [row(0, true), row(1)]
    expect(drawRow(mixed, { status: '未做', round: [], rand: () => 0 })!.row.id).toBe('r0')
  })

  it('去掉本轮已抽过的；去完为空时本轮清零', () => {
    const rows = [row(0), row(1), row(2)]
    for (const rand of steps(10)) expect(drawRow(rows, { status: '全部', round: ['r0', 'r2'], rand })!.row.id).toBe('r1')
    const r = drawRow(rows, { status: '全部', round: ['r0', 'r1', 'r2'], rand: () => 0 })!
    expect(r.resetRound).toBe(true)
    expect(r.row.id).toBe('r0')
  })

  it('优先没做过与本轮去重叠加：没做过的都抽过了，清零后仍只在没做过的里抽', () => {
    const rows = [row(0, true), row(1), row(2)]
    const r = drawRow(rows, { status: '全部', round: ['r1', 'r2'], rand: () => 0.99 })!
    expect(r.resetRound).toBe(true)
    expect(r.row.id).toBe('r2')
  })

  it('每一行都能被等概率抽到', () => {
    const rows = [row(0), row(1), row(2), row(3), row(4)]
    expect(steps(5).map((rand) => drawRow(rows, { status: '全部', round: [], rand })!.row.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4'])
  })
})

describe('safeScope', () => {
  it('只认三个栏目的站内路径', () => {
    for (const s of ['/reading', '/reading?tab=type', '/listening?tab=part&part=Part%201', `/writing?${new URLSearchParams({ tab: 't2', category: '利弊型' })}`])
      expect(safeScope(s)).toBe(s)
    // 手打的中文参数统一成编码后的形式
    expect(safeScope('/writing?category=利弊型')).toBe(`/writing?${new URLSearchParams({ category: '利弊型' })}`)
    for (const s of ['https://evil.com', '//evil.com', '/\tevil.com', '/\\evil.com', '/practice/x', '/readingx', '/reading/x', '/speaking', '', undefined, null])
      expect(safeScope(s as string)).toBeNull()
  })
})

describe('网址', () => {
  it('withPick 把 pick 放在 # 前面', () => {
    const scope = '/reading?tab=type&type=判断题'
    const enc = encodeURIComponent(scope)
    expect(withPick('/practice/u1-g1', scope)).toBe(`/practice/u1-g1?pick=${enc}`)
    expect(withPick('/practice/u1?x=1', scope)).toBe(`/practice/u1?x=1&pick=${enc}`)
    expect(withPick('/writing/5#review', scope)).toBe(`/writing/5?pick=${enc}#review`)
  })

  it('drawHref 加 draw=1', () => {
    expect(drawHref('/reading')).toBe('/reading?draw=1')
    expect(drawHref('/reading?tab=type')).toBe('/reading?tab=type&draw=1')
  })

  it('scopeOf 去掉 page、focus、draw，其余顺序和编码不变', () => {
    expect(scopeOf('reading', '')).toBe('/reading')
    expect(scopeOf('reading', '?page=2&focus=u1')).toBe('/reading')
    const search = `?${new URLSearchParams({ tab: 'type', type: '判断题', status: '未做' })}`
    const scope = scopeOf('reading', search)
    expect(scope).toBe(`/reading${search}`)
    // 再抽一题回到栏目页时网址多了 draw=1，算出的范围必须一模一样（本轮记录按范围字符串分开记）
    expect(scopeOf('reading', new URL(drawHref(scope), 'http://x').search)).toBe(scope)
    const pick = new URL(withPick('/practice/u1-g1', scope), 'http://x').searchParams.get('pick')
    expect(pick).toBe(scope)
  })
})

describe('本轮记录', () => {
  beforeEach(() => sessionStorage.clear())

  it('按范围分开记，可清零，最多 500 个', () => {
    addRound('/reading', 'a')
    addRound('/reading', 'b')
    addRound('/listening', 'c')
    expect(readRound('/reading')).toEqual(['a', 'b'])
    expect(readRound('/listening')).toEqual(['c'])
    clearRound('/reading')
    expect(readRound('/reading')).toEqual([])
    for (let i = 0; i < 510; i++) addRound('/writing', `w${i}`)
    const r = readRound('/writing')
    expect(r).toHaveLength(500)
    expect(r[0]).toBe('w10')
  })

  it('存储里是坏数据时当作空', () => {
    sessionStorage.setItem('ybz_pick_round:/reading', '{bad')
    expect(readRound('/reading')).toEqual([])
  })
})
