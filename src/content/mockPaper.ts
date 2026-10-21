// 028 模考考试页取数：一张卷子（固定卷或随机一场）→ 听力、阅读两个 PracticeUnit（data-model「考试中的题目视图」）
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { listeningDefaults, readingDefaults } from '@/exam/bandScaleDefaults'
import { checkPaper, fitsSlot, SLOTS, type Pool } from '@/exam/mock'
import { groupNumbers, type PracticeUnit } from '@/exam/practice'
import { RANDOM_NO } from '@/practice/mockAttempt'
import type { MockPaper, Unit } from '@/payload-types'

import { getPracticeUnit } from './practiceUnit'

export type MockPaperView = { no: number; title: string; version: string; units: number[]; l: PracticeUnit; r: PracticeUnit }

const idOf = (v: number | { id: number } | null | undefined) => (typeof v === 'object' && v ? v.id : v)

/** 7 个单元（按 l1–l4、r1–r3）拼成两科；任一未发布、或位置 / 题号不合规 → null */
const build = async (no: number, title: string, ids: number[]): Promise<MockPaperView | null> => {
  const payload = await getPayload({ config: configPromise })
  const units = await Promise.all(ids.map((id) => getPracticeUnit(`u${id}`)))
  if (units.some((u) => !u)) return null
  const errors = checkPaper(
    SLOTS.map((s, i) => ({
      slot: s.key,
      module: units[i]!.module,
      part: Number(/\d+/.exec(units[i]!.sections[0].label)?.[0]),
      numbers: units[i]!.sections.flatMap((x) => x.groups.flatMap(groupNumbers)),
    })),
  )
  if (errors.length) return null

  const g = await payload.findGlobal({ slug: 'band-scales' })
  const scale = (rows: { min: number; max: number; band: number }[] | null | undefined, fallback: typeof listeningDefaults) =>
    rows?.length ? rows.map(({ min, max, band }) => ({ min, max, band })) : fallback
  const version = units.map((u) => u!.version).join('|')

  const make = (module: 'listening' | 'reading'): PracticeUnit => {
    const isL = module === 'listening'
    return {
      id: `m${no}-${isL ? 'l' : 'r'}`,
      docId: no,
      source: 'mock',
      version,
      module,
      title: `${title} · ${isL ? '听力' : '阅读'}`,
      whole: true,
      sections: SLOTS.map((s, i) => (s.module === module ? units[i]!.sections[0] : null)).filter((s) => s !== null),
      bandScale: isL ? scale(g.listening, listeningDefaults) : scale(g.reading, readingDefaults),
    }
  }
  return { no, title, version, units: ids, l: make('listening'), r: make('reading') }
}

/** 固定卷：卷子未发布、或任一单元未发布 → null（FR-024） */
export const getMockPaper = async (no: number): Promise<MockPaperView | null> => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'mock-papers',
    where: { and: [{ no: { equals: no } }, { _status: { equals: 'published' } }] },
    depth: 0,
    limit: 1,
  })
  const paper = res.docs[0] as MockPaper | undefined
  if (!paper) return null
  return build(no, paper.title, SLOTS.map((s) => idOf(paper[s.key]) as number))
}

/** 随机一场：浏览器抽好的 7 个单元 id */
export const getRandomPaper = (ids: number[]) => (ids.length === 7 ? build(RANDOM_NO, '随机模考', ids) : Promise.resolve(null))

/** 随机一场的候选：每个位置的已发布单元 id（题号合规的才算） */
export const getRandomPool = async (): Promise<Pool> => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'units',
    where: { _status: { equals: 'published' } },
    select: { module: true, part: true, summary: true },
    depth: 0,
    pagination: false,
  })
  const pool = Object.fromEntries(SLOTS.map((s) => [s.key, [] as number[]])) as Pool
  for (const u of res.docs as Unit[]) {
    const s = SLOTS.find((x) => x.module === u.module && x.part === u.part)
    if (s && fitsSlot(u.module, u.part, u.summary as { count?: number; range?: string }[])) pool[s.key].push(u.id)
  }
  return pool
}

/** 卷子是否存在（含草稿 / 已下架），区分"没有这张卷子"和"已下架" */
export const mockPaperExists = async (no: number) => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.count({ collection: 'mock-papers', where: { no: { equals: no } } })
  return res.totalDocs > 0
}
