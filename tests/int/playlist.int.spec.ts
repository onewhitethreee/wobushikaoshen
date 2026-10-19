import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { playlistEndpoint, type RadioItem } from '@/endpoints/playlist'

// 022 连播列表：用本机已导入的听力单元（research R2）。没有听力单元时跳过
let payload: Payload
let units: { id: number; part: number; sourceTag?: string | null }[] = []

const call = async (params: Record<string, string>) => {
  const res = (await playlistEndpoint.handler({ payload, searchParams: new URLSearchParams(params) } as unknown as PayloadRequest)) as Response
  return { status: res.status, body: (await res.json()) as { items?: RadioItem[]; error?: string } }
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'units',
    where: { and: [{ module: { equals: 'listening' } }, { _status: { equals: 'published' } }] },
    sort: ['sourceTag', 'part', 'id'],
    depth: 0,
    limit: 3,
  })
  units = res.docs
})

describe('GET /api/listening/playlist', () => {
  it('start 包含自身，按 Part、id 升序，同一题集标签，最多 10 项', async () => {
    if (units.length < 2) return
    const { status, body } = await call({ start: `u${units[0].id}` })
    expect(status).toBe(200)
    const items = body.items!
    expect(items[0].id).toBe(`u${units[0].id}`)
    expect(items.length).toBeLessThanOrEqual(10)
    for (let i = 1; i < items.length; i++) {
      const [a, b] = [items[i - 1], items[i]]
      expect(a.part < b.part || (a.part === b.part && Number(a.id.slice(1)) < Number(b.id.slice(1)))).toBe(true)
      expect(b.tag).toBe(items[0].tag)
    }
    expect(items[0].audioUrl).toBeTruthy()
  })

  it('after 不含自身；题组按所在单元；不传参数从第一个开始', async () => {
    if (units.length < 2) return
    const start = await call({ start: `u${units[0].id}` })
    const after = await call({ after: `u${units[0].id}` })
    expect(after.body.items![0].id).toBe(start.body.items![1].id)
    expect((await call({ start: `u${units[0].id}-g1` })).body.items![0].id).toBe(`u${units[0].id}`)
    expect((await call({})).body.items![0].id).toBe(`u${units[0].id}`)
  })

  it('参数不对 400，不存在 404', async () => {
    expect((await call({ start: 'bad' })).status).toBe(400)
    expect((await call({ start: 'u1', after: 'u2' })).status).toBe(400)
    expect((await call({ start: 't1-r1' })).status).toBe(400)
    expect((await call({ start: 'u999999999' })).status).toBe(404)
  })
})
