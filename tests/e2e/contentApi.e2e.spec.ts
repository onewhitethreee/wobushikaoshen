import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { ContentApiSetting } from '../../src/payload-types'
import { EXAMPLE } from '../../src/contentApi/format'
import { login } from '../helpers/login'

// 029 内容接口：密钥只能调本接口；上传 / 更新 / 撞号 / 配图 / 每日上限 / 后台面板。
// 测试单元 sourceId 以 e2e-capi- 开头、测完删除；结束时恢复「内容接口」设置原样
const BASE = 'http://localhost:3000'
const API = `${BASE}/api/content-api`
const ADMIN = { email: 'e2e-capi-admin@example.test', password: 'e2e-capi-admin-pw' }
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let payload: Payload
let original: ContentApiSetting
let page: Page
let api: APIRequestContext
let key = ''

const unit = (sourceId: string, over: Record<string, unknown> = {}) => ({ ...structuredClone(EXAMPLE.data[0]), sourceId, ...over })
const post = (body: unknown, k = key) =>
  api.post(`${API}/units`, { headers: { Authorization: `Bearer ${k}` }, data: body as Record<string, unknown> })
const get = (path: string, k: string | null = key) => api.get(`${API}${path}`, { headers: k ? { Authorization: `Bearer ${k}` } : {} })
const admin = (method: 'get' | 'post' | 'delete', path: string) => page.request[method](`${API}${path}`, { headers: { Origin: BASE } })
const findUnit = async (sourceId: string, draft = true) =>
  (await payload.find({ collection: 'units', where: { sourceId: { equals: sourceId } }, draft, depth: 0, limit: 1, overrideAccess: true })).docs[0]
const setLimit = (dailyLimit: number) => payload.updateGlobal({ slug: 'content-api-settings', data: { dailyLimit }, overrideAccess: true })

const cleanup = async () => {
  const units = await payload.find({ collection: 'units', where: { sourceId: { like: 'e2e-capi-' } }, draft: true, depth: 0, limit: 100, overrideAccess: true })
  await payload.delete({ collection: 'units', where: { sourceId: { like: 'e2e-capi-' } }, overrideAccess: true })
  for (const name of ['e2e-capi-map.png', 'e2e-capi-bad.png']) await payload.delete({ collection: 'media', where: { alt: { equals: name } }, overrideAccess: true })
  return units.totalDocs
}

test.describe.configure({ mode: 'serial' })

test.describe('029 内容接口', () => {
  test.beforeAll(async ({ browser }) => {
    payload = await getPayload({ config: await config })
    original = await payload.findGlobal({ slug: 'content-api-settings', overrideAccess: true, showHiddenFields: true })
    await cleanup()
    await setLimit(20)
    await payload.delete({ collection: 'users', where: { email: { equals: ADMIN.email } } })
    await payload.create({ collection: 'users', data: ADMIN })
    page = await (await browser.newContext()).newPage()
    await login({ page, user: ADMIN })
    api = await pwRequest.newContext()
  })

  test.afterAll(async () => {
    await cleanup()
    await payload.delete({ collection: 'users', where: { email: { equals: ADMIN.email } } })
    const { keyHash, keyLast4, keyCreatedAt, lastUsedAt, dailyLimit } = original
    await payload.updateGlobal({ slug: 'content-api-settings', data: { keyHash: keyHash ?? '', keyLast4, keyCreatedAt, lastUsedAt, dailyLimit }, overrideAccess: true })
    await api.dispose()
  })

  test('后台生成密钥；格式说明返回文档、示例、额度', async () => {
    expect((await api.post(`${API}/admin/key`)).status()).toBe(401)
    const r = await admin('post', '/admin/key')
    expect(r.status()).toBe(200)
    key = ((await r.json()) as { key: string }).key
    expect(key).toMatch(/^cak_/)
    const f = await get('/format')
    expect(f.status()).toBe(200)
    const body = (await f.json()) as { doc: string; example: unknown; quota: { limit: number } }
    expect(body.doc).toContain('# 内容接口格式说明')
    expect(body.example).toEqual(EXAMPLE)
    expect(body.quota.limit).toBe(20)
  })

  test('上传草稿 → 发布 → 草稿更新线上不变 → 下架后重传重新发布', async () => {
    const r = await post({ data: [unit('e2e-capi-1')] })
    expect(r.status()).toBe(201)
    const c = ((await r.json()) as { created: { status: string; updated: boolean; id: number; adminUrl: string }[] }).created[0]
    expect(c).toMatchObject({ status: 'draft', updated: false })
    expect(c.adminUrl).toBe(`${BASE}/admin/collections/units/${c.id}`)
    const doc = await findUnit('e2e-capi-1')
    expect(doc).toMatchObject({ viaApi: true, sourceTag: '每日精选', sourceUrl: EXAMPLE.data[0].sourceUrl, _status: 'draft' })
    expect((await api.get(`${BASE}/practice/u${c.id}`)).status()).toBe(404)

    expect(((await (await post({ publish: true, data: [unit('e2e-capi-1')] })).json()) as { created: { status: string }[] }).created[0].status).toBe('published')
    expect(await (await api.get(`${BASE}/practice/u${c.id}`)).text()).toContain('The Secret Life of Urban Foxes')

    const d = await post({ publish: false, data: [unit('e2e-capi-1', { title: 'E2E Changed Title' })] })
    expect(((await d.json()) as { created: unknown[] }).created[0]).toMatchObject({ status: 'published', hasDraft: true, updated: true })
    const html = await (await api.get(`${BASE}/practice/u${c.id}`)).text()
    expect(html).toContain('The Secret Life of Urban Foxes')
    expect(html).not.toContain('E2E Changed Title')
    const q = (await (await get('/units?sourceId=e2e-capi-1')).json()) as { items: unknown[] }
    expect(q.items[0]).toMatchObject({ status: 'published', hasDraft: true })

    // 站长在后台下架（改回草稿），对方 publish: true 重传 → 重新发布
    await payload.update({ collection: 'units', id: c.id, data: { _status: 'draft' }, overrideAccess: true })
    expect((await api.get(`${BASE}/practice/u${c.id}`)).status()).toBe(404)
    await post({ publish: true, data: [unit('e2e-capi-1')] })
    expect((await api.get(`${BASE}/practice/u${c.id}`)).status()).toBe(200)
  })

  test('整包拒绝：错误逐条指明项和题，不写入任何单元', async () => {
    const bad1 = unit('e2e-capi-2')
    bad1.groups[0].questions[0].evidence = '12'
    const bad2 = unit('e2e-capi-3', { sourceUrl: undefined })
    const r = await post({ data: [bad1, bad2] })
    expect(r.status()).toBe(400)
    const { errors } = (await r.json()) as { errors: string[] }
    expect(errors).toContain('第 2 项（e2e-capi-3）：缺少原文链接 sourceUrl')
    expect((await post({ data: [bad1] })).status()).toBe(400)
    expect(((await (await post({ data: [bad1] })).json()) as { errors: string[] }).errors.join('\n')).toContain('出处句号「12」不在原文里')
    expect(await findUnit('e2e-capi-2')).toBeUndefined()
    expect(await findUnit('e2e-capi-3')).toBeUndefined()
    expect((await post({ data: [unit('e2e-capi-4', { module: 'listening' })] })).status()).toBe(400)
    expect((await api.post(`${API}/units`, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, data: '{bad' })).status()).toBe(400)
  })

  test('撞上题库原有单元：拒绝且不改动；查询报不存在', async () => {
    const other = (await payload.find({ collection: 'units', where: { viaApi: { not_equals: true } }, depth: 0, limit: 1, overrideAccess: true })).docs[0]
    test.skip(!other, '本机没有题库单元')
    const r = await post({ data: [unit(other.sourceId)] })
    expect(r.status()).toBe(400)
    expect(((await r.json()) as { errors: string[] }).errors[0]).toContain('sourceId 已被题库其他内容占用')
    const after = (await payload.findByID({ collection: 'units', id: other.id, depth: 0, overrideAccess: true }))
    expect(after.updatedAt).toBe(other.updatedAt)
    const q = (await (await get(`/units?sourceId=${encodeURIComponent(other.sourceId)}`)).json()) as { items: unknown[] }
    expect(q.items[0]).toEqual({ sourceId: other.sourceId, status: 'missing' })
  })

  test('配图：PNG 入库并挂到题组；扩展名不符拒绝；写入失败不留图片', async () => {
    const withImage = unit('e2e-capi-img')
    ;(withImage.groups[2] as Record<string, unknown>).image = 'e2e-capi-map.png'
    const r = await post({ data: [withImage], files: [{ name: 'e2e-capi-map.png', data: `data:image/png;base64,${PNG.toString('base64')}` }] })
    expect(r.status()).toBe(201)
    const doc = await findUnit('e2e-capi-img')
    expect(doc.groups?.[2]?.image).toBeTruthy()

    expect((await post({ data: [withImage], files: [{ name: 'e2e-capi-map.png', data: Buffer.from('GIF89a').toString('base64') }] })).status()).toBe(400)
    const missing = await post({ data: [withImage] })
    expect(((await missing.json()) as { errors: string[] }).errors).toContain('缺少文件：e2e-capi-map.png')

    // 题型写成不存在的值：前置校验放过，写入时被拒 → 已上传的图片要删掉
    const broken = unit('e2e-capi-broken')
    ;(broken.groups[2] as Record<string, unknown>).type = 'no_such_type'
    ;(broken.groups[2] as Record<string, unknown>).image = 'e2e-capi-bad.png'
    ;(broken.groups[2] as Record<string, unknown>).options = [{ key: 'C', text: 'c' }]
    const before = (await payload.count({ collection: 'media', overrideAccess: true })).totalDocs
    const w = await post({ data: [broken], files: [{ name: 'e2e-capi-bad.png', data: PNG.toString('base64') }] })
    expect(w.status()).toBeGreaterThanOrEqual(400)
    expect((await payload.count({ collection: 'media', overrideAccess: true })).totalDocs).toBe(before)
    expect(await findUnit('e2e-capi-broken')).toBeUndefined()
  })

  test('每日上限：新建超额 429，只更新照常；上限 0 暂停', async () => {
    const { quota } = (await (await get('/format')).json()) as { quota: { used: number } }
    await setLimit(quota.used)
    try {
      const r = await post({ data: [unit('e2e-capi-5')] })
      expect(r.status()).toBe(429)
      const body = (await r.json()) as { errors: string[]; quota: { remaining: number } }
      expect(body.errors[0]).toBe('今天还能新建 0 个，本次要新建 1 个；北京时间 0 点重置')
      expect(body.quota.remaining).toBe(0)
      expect((await post({ data: [unit('e2e-capi-1')] })).status()).toBe(201)
      await setLimit(0)
      expect(((await (await post({ data: [unit('e2e-capi-5')] })).json()) as { errors: string[] }).errors).toEqual(['内容接口已暂停接收新内容'])
    } finally {
      await setLimit(20)
    }
  })

  test('密钥只能调本接口；无密钥 / 错密钥 401', async () => {
    expect((await get('/format', null)).status()).toBe(401)
    expect((await get('/format', 'cak_wrong')).status()).toBe(401)
    const auth = { Authorization: `Bearer ${key}` }
    for (const path of ['/api/members', '/api/credit-entries', '/api/globals/ai-settings', '/api/globals/content-api-settings', '/api/users']) {
      const without = await api.get(`${BASE}${path}`)
      const withKey = await api.get(`${BASE}${path}`, { headers: auth })
      expect(withKey.status(), path).toBe(without.status())
      expect(await withKey.text(), path).toBe(await without.text())
    }
    const create = await api.post(`${BASE}/api/units`, { headers: auth, data: unit('e2e-capi-x') })
    expect(create.status()).toBeGreaterThanOrEqual(400)
    expect(await findUnit('e2e-capi-x')).toBeUndefined()
  })

  test('后台面板：显示一次完整密钥；改每日上限保存后密钥仍有效；停用后 401', async () => {
    await page.goto(`${BASE}/admin/globals/content-api-settings`)
    const panel = page.getByTestId('content-api-panel')
    await expect(panel.getByTestId('content-api-key-status')).toContainText(`cak_…${key.slice(-4)}`)
    await expect(panel.getByTestId('content-api-today')).toContainText('今日已新建')
    // 管理员读设置也拿不到摘要
    const g = await page.request.get(`${BASE}/api/globals/content-api-settings`, { headers: { Origin: BASE } })
    expect(Object.keys((await g.json()) as object)).not.toContain('keyHash')

    page.once('dialog', (d) => void d.accept())
    await panel.getByTestId('content-api-generate').click()
    const shown = await panel.getByTestId('content-api-key').inputValue()
    expect(shown).toMatch(/^cak_/)
    expect((await get('/format')).status()).toBe(401)
    key = shown
    expect((await get('/format')).status()).toBe(200)
    await page.reload()
    await expect(page.getByTestId('content-api-key')).toHaveCount(0)
    await expect(page.getByTestId('content-api-key-status')).toContainText(`cak_…${key.slice(-4)}`)

    await page.locator('#field-dailyLimit').fill('7')
    await page.getByRole('button', { name: /保存|Save/ }).first().click()
    await expect.poll(async () => (await payload.findGlobal({ slug: 'content-api-settings', overrideAccess: true })).dailyLimit).toBe(7)
    expect((await get('/format')).status()).toBe(200)

    page.once('dialog', (d) => void d.accept())
    await page.getByTestId('content-api-disable').click()
    await expect(page.getByTestId('content-api-key-status')).toContainText('还没有密钥')
    expect((await get('/format')).status()).toBe(401)
  })
})
