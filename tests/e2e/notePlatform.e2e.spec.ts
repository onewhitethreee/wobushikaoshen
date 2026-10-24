import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'

// 032 笔记换额度的平台设置：关闭 / 换成抖音时前台各页不再出现"小红书"（SC-001、SC-002），抖音链接能提交；默认小红书时文案不变。
// 测试账号以 e2e-noteplat- 开头，测完删除；设置改回默认的小红书（不存"原值"：用例失败时 worker 重启会重跑 beforeAll，存下的是改过的值）
const BASE = 'http://localhost:3000'
const EMAIL = `e2e-noteplat-${Date.now()}@example.test`
const PASSWORD = 'e2e-noteplat-pass-1'
// 发笔记这类引导；"笔记"本身可能出现在别的地方，只查引导句式
const NOTE_HINT = /笔记换额度|发.{0,6}笔记/

let payload: Payload
let writingId: number | undefined

const setMode = (noteMode: 'xhs' | 'other' | 'off', notePlatform?: string) =>
  payload.updateGlobal({ slug: 'credit-settings', overrideAccess: true, data: { noteMode, notePlatform } })

const memberContext = async (browser: { newContext: () => Promise<BrowserContext> }) => {
  const ctx = await browser.newContext()
  const res = await ctx.request.post(`${BASE}/api/auth/password`, { data: { email: EMAIL, password: PASSWORD } })
  expect(res.ok()).toBe(true)
  return ctx
}

const pages = () => ['/', '/listening', '/reading', '/writing', ...(writingId ? [`/writing/${writingId}`] : []), '/help', '/me/credits']

const textOf = async (page: Page, path: string) => {
  await page.goto(`${BASE}${path}`)
  if (path === '/me/credits') await expect(page.getByTestId('credit-balance')).toBeVisible()
  return page.locator('body').innerText()
}

test.describe('笔记平台设置', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: 'e2e-noteplat-' } } })
    await payload.create({ collection: 'members', overrideAccess: true, data: { email: EMAIL, password: PASSWORD, passwordSet: true } })
    writingId = (await payload.find({ collection: 'writing-tasks', limit: 1, depth: 0, where: { _status: { equals: 'published' } } })).docs[0]?.id
  })

  test.afterAll(async () => {
    await setMode('xhs')
    const m = (await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: EMAIL } } })).docs[0]
    if (m) {
      await payload.delete({ collection: 'note-submissions', overrideAccess: true, where: { member: { equals: m.id } } })
      await payload.delete({ collection: 'note-screenshots', overrideAccess: true, where: { member: { equals: m.id } } })
    }
    await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: 'e2e-noteplat-' } } })
  })

  test('关闭：各页没有小红书、没有发笔记引导', async ({ browser }) => {
    test.setTimeout(180_000)
    await setMode('off')
    const ctx = await memberContext(browser)
    const page = await ctx.newPage()
    for (const path of pages()) {
      const text = await textOf(page, path)
      expect(text, path).not.toContain('小红书')
      expect(text, path).not.toMatch(NOTE_HINT)
    }
    await expect(page.getByTestId('note-text')).toHaveCount(0)
    await ctx.close()
  })

  test('换成抖音：各页没有小红书，引导写抖音；抖音链接能提交', async ({ browser }) => {
    test.setTimeout(180_000)
    await setMode('other', '抖音')
    const ctx = await memberContext(browser)
    const page = await ctx.newPage()
    for (const path of pages()) {
      const text = await textOf(page, path)
      expect(text, path).not.toContain('小红书')
      if (['/', '/help', '/me/credits'].includes(path)) expect(text, path).toContain('抖音')
    }

    // 已在 /me/credits
    const png = test.info().outputPath('note.png')
    await sharp({ create: { width: 40, height: 40, channels: 3, background: '#4a7' } }).png().toFile(png)
    await page.getByTestId('note-text').fill(`看看 https://www.douyin.com/video/e2e${Date.now()}?share=1`)
    await page.getByTestId('note-file').setInputFiles(png)
    await page.getByTestId('note-submit').click()
    await expect(page.getByTestId('note-status').first()).toHaveText('审核中')
    await ctx.close()
  })

  test('默认小红书：文案和原来一样', async ({ page }) => {
    await setMode('xhs')
    expect(await textOf(page, '/help')).toContain('发一篇小红书笔记，在「我的额度」提交链接和截图，审核通过后发额度。')
    expect(await textOf(page, '/help')).toContain('好友在微信 / 小红书里打开链接')
    expect(await textOf(page, '/')).toContain('发一篇小红书备考笔记')
    // 额度卡片只在写作、口语栏目的侧栏里；听力侧栏是提示卡
    expect(await textOf(page, '/writing')).toContain('发小红书备考笔记，审核通过后发放')
    expect(await textOf(page, '/listening')).toContain('发小红书笔记、邀请好友都能领。')
  })
})
