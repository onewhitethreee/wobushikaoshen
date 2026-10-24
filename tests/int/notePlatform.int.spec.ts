// @vitest-environment node
// 032 笔记换额度的平台设置：平台名与文案替换、通用链接识别、设置校验、提交接口三种模式、切换设置不影响余额
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { balance, getPlatform, grant } from '@/account/credits'
import { noteText, platformName } from '@/account/notePlatform'
import { parseLink } from '@/account/xhs'
import { notesEndpoint } from '@/endpoints/notes'
import type { Member } from '@/payload-types'

describe('platformName / noteText', () => {
  it('三种模式', () => {
    expect(platformName({ noteMode: 'off' })).toBeNull()
    expect(platformName({ noteMode: 'xhs' })).toBe('小红书')
    expect(platformName({})).toBe('小红书')
    expect(platformName({ noteMode: 'other', notePlatform: ' 抖音 ' })).toBe('抖音')
    expect(platformName({ noteMode: 'other', notePlatform: '  ' })).toBeNull()
  })

  it('替换平台名', () => {
    expect(noteText('发小红书笔记', '抖音')).toBe('发抖音笔记')
    expect(noteText('发小红书笔记，小红书', '小红书')).toBe('发小红书笔记，小红书')
  })
})

describe('parseLink', () => {
  it('取第一个 https 链接，去掉末尾标点；去重键忽略参数、锚点、末尾斜杠、大小写', () => {
    const a = parseLink('看看 https://www.douyin.com/video/123?share=abc。')
    expect(a).toEqual({ url: 'https://www.douyin.com/video/123?share=abc', key: 'link:www.douyin.com/video/123' })
    expect(parseLink('https://WWW.Douyin.com/video/123/#x')?.key).toBe('link:www.douyin.com/video/123')
  })

  it('不是 https 或没有链接', () => {
    expect(parseLink('http://www.douyin.com/video/123')).toBeNull()
    expect(parseLink('没有链接')).toBeNull()
    expect(parseLink('https://')).toBeNull()
    expect(parseLink(42)).toBeNull()
  })
})

let payload: Payload
const PREFIX = 'e2e-noteplat-'
let n = 0
const XHS = 'https://www.xiaohongshu.com/explore/0123456789abcdef01234567'
// 1x1 透明 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

const mk = () =>
  payload.create({ collection: 'members', overrideAccess: true, data: { email: `${PREFIX}${Date.now()}-${n++}@example.test`, password: 'x'.repeat(32) } })
const setMode = (noteMode: 'xhs' | 'other' | 'off', notePlatform?: string) =>
  payload.updateGlobal({ slug: 'credit-settings', overrideAccess: true, data: { noteMode, notePlatform } })
// 不带 body：addDataAndFileToRequest 原样保留预先放好的 data / file
const submit = async (m: Member, text: string) => {
  const req = {
    payload,
    user: { ...m, collection: 'members' },
    headers: new Headers(),
    data: { text },
    file: { data: PNG, mimetype: 'image/png', name: 'a.png', size: PNG.length },
  } as unknown as PayloadRequest
  const res = (await notesEndpoint.handler(req)) as Response
  return { status: res.status, body: (await res.json()) as { id?: number; error?: string } }
}
const submissions = async (m: Member) =>
  (await payload.find({ collection: 'note-submissions', overrideAccess: true, where: { member: { equals: m.id } } })).docs
const cleanup = async () => {
  const ms = await payload.find({ collection: 'members', overrideAccess: true, limit: 1000, where: { email: { like: PREFIX } } })
  const ids = ms.docs.map((m) => m.id)
  if (ids.length) {
    await payload.delete({ collection: 'note-submissions', overrideAccess: true, where: { member: { in: ids } } })
    await payload.delete({ collection: 'note-screenshots', overrideAccess: true, where: { member: { in: ids } } })
  }
  await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: PREFIX } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
})
afterAll(async () => {
  // 改回默认，不存原值（同 e2e）
  await setMode('xhs')
  await cleanup()
})

describe('设置校验', () => {
  it('其他平台必须填名称', async () => {
    await expect(setMode('other', '  ')).rejects.toThrow()
    await setMode('other', ' 抖音 ')
    expect(await getPlatform(payload)).toBe('抖音')
    await setMode('xhs')
  })
})

describe('提交接口', () => {
  it('关闭时拒绝，不创建提交', async () => {
    await setMode('off')
    const m = await mk()
    const r = await submit(m, XHS)
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('暂不开放')
    expect(await submissions(m)).toHaveLength(0)
  })

  it('其他平台：任意 https 链接，按规范化链接去重，记下平台', async () => {
    await setMode('other', '抖音')
    const m = await mk()
    const url = `https://www.douyin.com/video/${PREFIX}${Date.now()}`
    expect((await submit(m, `${url}?share=1`)).status).toBe(201)
    expect((await submit(m, `${url.toUpperCase().replace('HTTPS', 'https')}/?share=2`)).status).toBe(409)
    expect((await submit(m, '没有链接')).body.error).toBe('没找到链接')
    const [s] = await submissions(m)
    expect(s.platform).toBe('抖音')
  })

  it('小红书：只认小红书链接，记下平台', async () => {
    await setMode('xhs')
    const m = await mk()
    const r = await submit(m, 'https://www.douyin.com/video/1')
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('没找到小红书笔记链接')
    const id = Date.now().toString(16).padStart(24, '0').slice(-24)
    expect((await submit(m, `https://www.xiaohongshu.com/explore/${id}`)).status).toBe(201)
    expect((await submissions(m))[0].platform).toBe('小红书')
  })

  it('来回切换设置，余额不变（SC-004）', async () => {
    const m = await mk()
    await grant(payload, { memberId: m.id, amount: 7, reason: 'adjust', note: 't' })
    const before = await balance(payload, m.id)
    await setMode('off')
    await setMode('other', '抖音')
    await setMode('xhs')
    expect(await balance(payload, m.id)).toBe(before)
  })
})
