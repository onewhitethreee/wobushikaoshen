// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { paperLabel } from '@/exam/cet'
import { validateUnit, validateWritingTask, type UnitData } from '@/exam/validate'
import { importPackage } from '@/import/importPackage'
import { doneUnits } from '@/practice/plan'
import { progressOf } from '@/practice/progress'
import { safeScope } from '@/practice/randomPick'
import type { PracticeRecord } from '@/practice/store'
import config from '@/payload.config'

// 033 四 / 六级：校验放宽与收紧、导入扩展字段（导入部分需要本地数据库）
const FIX = path.resolve(__dirname, '../fixtures/cet')
const pack = (kind: string) => fs.readFileSync(path.join(FIX, kind, 'import.json'), 'utf8')
const reader = (kind: string) => async (p: string) => {
  const f = path.join(FIX, kind, p)
  if (!fs.existsSync(f)) return null
  const data = fs.readFileSync(f)
  return { data, size: data.length }
}

const reading = (patch: Partial<UnitData> = {}): UnitData => ({
  module: 'reading',
  part: 4,
  title: 'Some people have said aging…',
  exam: 'cet4',
  paper: '2024-06-1',
  sourceType: 'repost',
  sourceSets: '四级 2024-06',
  passage: [{ label: '', sentences: [{ n: 0, text: 'Aging is a mindset.' }] }],
  groups: [{ type: 'single_choice', questions: [{ number: 51, options: [{ key: 'A' }, { key: 'B' }], answers: 'A', evidence: '0' }] }],
  ...patch,
})

describe('paperLabel', () => {
  it('年-月-套 → 中文', () => {
    expect(paperLabel('2024-06-1')).toBe('2024 年 6 月 第 1 套')
    expect(paperLabel('2015-12-3')).toBe('2015 年 12 月 第 3 套')
    expect(paperLabel('other')).toBe('other')
  })
})

describe('validateUnit（四 / 六级）', () => {
  it('四 / 六级阅读允许 Part 4，不允许 Part 5', () => {
    expect(validateUnit(reading())).toEqual([])
    expect(validateUnit(reading({ part: 5 })).join()).toContain('part 必须是 1–4')
  })
  it('四 / 六级听力只到 Part 3', () => {
    const l = reading({ module: 'listening', part: 4, audio: 1, transcript: [{ n: 0, text: 'Hi.' }] })
    expect(validateUnit(l).join()).toContain('part 必须是 1–3')
  })
  it('四 / 六级必须有 paper', () => {
    expect(validateUnit(reading({ paper: '' })).join()).toContain('paper')
  })
  it('雅思阅读仍限 1–3', () => {
    expect(validateUnit(reading({ exam: undefined, paper: undefined })).join()).toContain('part 必须是 1–3')
  })
})

describe('validateWritingTask（四 / 六级）', () => {
  const base = { title: '四合院', prompt: '翻译', sourceType: 'repost', sourceSets: '四级 2024-06' }
  it('翻译题字数可空', () => {
    expect(validateWritingTask({ ...base, taskType: 'cet_translation', exam: 'cet6', paper: '2024-06-1' })).toEqual([])
  })
  it('四 / 六级题型要求 exam 和 paper', () => {
    expect(validateWritingTask({ ...base, taskType: 'cet_writing', exam: 'cet4' }).join()).toContain('paper')
    expect(validateWritingTask({ ...base, taskType: 'cet_writing', exam: 'ielts', paper: '2024-06-1' }).join()).toContain('cet4 或 cet6')
  })
  it('雅思题型不能标成四 / 六级', () => {
    expect(validateWritingTask({ ...base, taskType: 'task2', exam: 'cet4' }).join()).toContain('只能用于雅思')
    expect(validateWritingTask({ ...base, taskType: 'task2', exam: 'ielts' })).toEqual([])
  })
})

describe('随机抽题范围', () => {
  it('认四 / 六级栏目', () => {
    expect(safeScope('/cet4?subject=%E9%98%85%E8%AF%BB')).toBe('/cet4?subject=%E9%98%85%E8%AF%BB')
    expect(safeScope('/cet6')).toBe('/cet6')
    expect(safeScope('/cet5')).toBeNull()
  })
})

describe('做题记录按考试分开（R3）', () => {
  const rec = (at: number, extra: Partial<PracticeRecord> = {}): PracticeRecord => ({ unitId: `u${at}`, module: 'r', at, score: 1, total: 2, items: [], ...extra })
  const rs = [rec(1), rec(2, { exam: 'cet4' }), rec(3, { exam: 'cet4', module: 'l' }), rec(4, { exam: 'cet6' })]
  const name = (t: string) => t
  it('雅思曲线不含四 / 六级', () => {
    expect(progressOf(rs, 'reading', name).points.map((p) => p.at)).toEqual([1])
  })
  it('四级曲线只含四级，听力阅读合在一起', () => {
    expect(progressOf(rs, 'reading', name, 'cet4').points.map((p) => p.at)).toEqual([2, 3])
    expect(progressOf(rs, 'reading', name, 'cet4').bands).toEqual([])
  })
  it('备考计划不计四 / 六级', () => {
    expect([...doneUnits(rs, 'reading')]).toEqual(['u1'])
  })
})

describe('importPackage（四 / 六级）', () => {
  let payload: Payload
  let req: PayloadRequest
  const IDS = { units: 'fixture-cet4-', 'writing-tasks': 'fixture-cet4-' } as const
  const clean = async () => {
    for (const [collection, prefix] of Object.entries(IDS))
      await payload.delete({ collection: collection as 'units', where: { sourceId: { like: prefix } } })
    await payload.delete({ collection: 'media', where: { alt: { like: 'fixture-cet4-' } } })
  }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
    await clean()
  })
  afterAll(clean)

  it('阅读、听力、写作包通过校验并存下扩展字段', async () => {
    for (const kind of ['reading', 'listening', 'writing']) {
      const r = await importPackage(req, pack(kind), reader(kind))
      expect(r.body.ok ? r.body.ok : r.body.errors, kind).toBe(true)
    }
    const units = (await payload.find({ collection: 'units', where: { sourceId: { like: 'fixture-cet4-' } }, draft: true, limit: 10 })).docs
    expect(units).toHaveLength(5)
    const r1 = units.find((u) => u.sourceId === 'fixture-cet4-2024-06-1-a')!
    expect(r1).toMatchObject({ exam: 'cet4', paper: '2024-06-1', part: 1 })
    expect((r1.passage as { translation?: string }[])[0].translation).toBeTruthy()
    const la = units.find((u) => u.module === 'listening')!
    expect(la.transcriptTranslations).toHaveLength(2)
    expect((la.transcript as { p?: number }[])[1].p).toBe(0)

    const ws = (await payload.find({ collection: 'writing-tasks', where: { sourceId: { like: 'fixture-cet4-' } }, draft: true, limit: 10 })).docs
    const w = ws.find((x) => x.taskType === 'cet_writing')!
    expect(w).toMatchObject({ exam: 'cet4', paper: '2024-06-1', minWords: 120, maxWords: 180 })
    expect(w.sampleAnswer).toBeTruthy()
    expect(w.modelAnswerZh).toBeTruthy()
    expect(w.analysis).toBeTruthy()
    const t = ws.find((x) => x.taskType === 'cet_translation')!
    expect(t.minWords ?? null).toBeNull()
  })

  it('能发布：题号到 55 也通过字段校验（四 / 六级阅读 26–55）', async () => {
    const r = await payload.update({ collection: 'units', where: { sourceId: { like: 'fixture-cet4-' } }, data: { _status: 'published' } })
    expect(r.errors).toEqual([])
    expect(r.docs).toHaveLength(5)
  })

  it('再导一次全部是更新', async () => {
    for (const kind of ['reading', 'writing']) {
      const r = await importPackage(req, pack(kind), reader(kind))
      expect(r.body.ok && r.body.created.every((c) => c.updated)).toBe(true)
    }
  })
})
