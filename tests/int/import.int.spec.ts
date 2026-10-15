import fs from 'node:fs'
import path from 'node:path'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { importPackage } from '@/import/importPackage'

// 007 T011：kind "unit" 导入、再次导入按 sourceId 更新、待确认被拒、publish 直接发布（需要本地数据库）
const PACK = path.resolve(__dirname, '../fixtures/unit-pack/import.json')
const IDS = ['fixture-r-1', 'fixture-r-2']
const noFiles = async () => null

let payload: Payload
let req: PayloadRequest

const manifest = (patch: (m: { publish?: boolean; data: Record<string, unknown>[] }) => void = () => {}) => {
  const m = JSON.parse(fs.readFileSync(PACK, 'utf8'))
  patch(m)
  return JSON.stringify(m)
}
const clean = () => payload.delete({ collection: 'units', where: { sourceId: { in: IDS } } })
const count = async () => (await payload.find({ collection: 'units', where: { sourceId: { in: IDS } }, draft: true, limit: 10 })).docs

describe('importPackage（练习单元）', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
    await clean()
  })
  afterAll(clean)

  it('导入为草稿，前台查询不到', async () => {
    const r = await importPackage(req, manifest(), noFiles)
    expect(r.body.ok).toBe(true)
    expect(await count()).toHaveLength(2)
    const published = await payload.find({ collection: 'units', where: { sourceId: { in: IDS }, _status: { equals: 'published' } } })
    expect(published.totalDocs).toBe(0)
  })

  it('再次导入按 sourceId 更新：总数与 id 不变', async () => {
    const before = (await count()).map((d) => d.id).sort()
    const r = await importPackage(req, manifest((m) => ((m.data[0] as { title: string }).title = 'Fixture Bees v2')), noFiles)
    expect(r.body.ok && r.body.created.every((c) => c.updated)).toBe(true)
    const after = await count()
    expect(after.map((d) => d.id).sort()).toEqual(before)
    expect(after.find((d) => d.sourceId === 'fixture-r-1')?.title).toBe('Fixture Bees v2')
  })

  it('后台批量发布 / 取消发布（只带 _status）：校验看完整文档，待确认数不被清零', async () => {
    const where = { sourceId: { equals: 'fixture-r-1' } }
    const pub = await payload.update({ collection: 'units', where, data: { _status: 'published' } })
    expect(pub.errors).toEqual([])
    expect(pub.docs[0]._status).toBe('published')
    // 草稿里把一题改成待确认，再批量取消发布：pendingCount 仍按完整文档统计
    const doc = (await count()).find((d) => d.sourceId === 'fixture-r-1')!
    const groups = structuredClone(doc.groups)!
    groups[0].questions![0].answerStatus = 'pending'
    await payload.update({ collection: 'units', id: doc.id, data: { groups, _status: 'draft' } })
    await payload.update({ collection: 'units', where, data: { _status: 'draft' } })
    expect((await count()).find((d) => d.sourceId === 'fixture-r-1')?.pendingCount).toBe(1)
  })

  it('含待确认的题整包拒绝', async () => {
    const r = await importPackage(
      req,
      manifest((m) => {
        const g = (m.data[0] as { groups: { questions: { answerStatus?: string }[] }[] }).groups[0]
        g.questions[0].answerStatus = 'pending'
      }),
      noFiles,
    )
    expect(r.status).toBe(400)
    expect(!r.body.ok && r.body.errors.join()).toContain('待确认')
  })

  it('publish: true 直接发布', async () => {
    const r = await importPackage(req, manifest((m) => (m.publish = true)), noFiles)
    expect(r.body.ok).toBe(true)
    const published = await payload.find({ collection: 'units', where: { sourceId: { in: IDS }, _status: { equals: 'published' } } })
    expect(published.totalDocs).toBe(2)
  })
})
