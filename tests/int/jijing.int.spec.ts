import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { isSeason, seasonLabel, seasonOf } from '@/content/jijing'

// 027 机经栏目：题季计算、显示、保存时自动填与校验
describe('题季', () => {
  it('1–4 月 → 01，5–8 月 → 05，9–12 月 → 09', () => {
    expect(['2026-01-01', '2026-04-30', '2026-05-01', '2026-08-31', '2026-09-01', '2026-12-31'].map((d) => seasonOf(new Date(`${d}T12:00`)))).toEqual([
      '2026-01',
      '2026-01',
      '2026-05',
      '2026-05',
      '2026-09',
      '2026-09',
    ])
  })
  it('显示与校验', () => {
    expect(seasonLabel('2026-09')).toBe('2026 年 9–12 月')
    expect(seasonLabel('2027-01')).toBe('2027 年 1–4 月')
    expect(['2026-01', '2026-05', '2026-09'].every(isSeason)).toBe(true)
    expect(['2026-03', '26-01', '', null].some(isSeason)).toBe(false)
  })
})

describe('保存机经', () => {
  let payload: Payload
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })
  afterAll(async () => {
    await payload.delete({ collection: 'posts', context: { disableRevalidate: true }, where: { title: { like: 'e2e-jijing-int' } } })
  })

  it('题季为空时按发布日期自动填；不合法时发布报错', async () => {
    const doc = await payload.create({
      collection: 'posts',
      data: { title: 'e2e-jijing-int-a', column: 'jijing', publishedAt: '2026-10-19T08:00:00.000Z', _status: 'draft' } as never,
      draft: true,
    })
    expect(doc.season).toBe('2026-09')
    await expect(
      // 草稿保存时 Payload 不校验字段，发布时才校验
      payload.create({ collection: 'posts', data: { title: 'e2e-jijing-int-b', column: 'jijing', season: '2026-03', _status: 'published' } as never }),
    ).rejects.toThrow(/题季/)
  })
})
