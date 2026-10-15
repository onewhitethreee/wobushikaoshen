import { expect, test, type BrowserContext } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { MailSetting } from '../../src/payload-types'

// 010 开源前的攻击测试（contracts/attack-matrix.md A7、A10、A12、A13）。发信走本机 Mailpit，测试邮箱以 e2e-sec- 开头
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const EMAIL = `e2e-sec-${Date.now()}@example.test`

let payload: Payload
let original: MailSetting

const latestCode = async (to: string) => {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
    const { messages } = (await res.json()) as { messages: { ID: string }[] }
    if (messages?.[0]) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string }
      const m = /验证码是：(\d{6})/.exec(msg.Text)
      if (m) return m[1]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Mailpit 里没有发给 ${to} 的验证码`)
}

/** 走接口登录，cookie 落在 context 里 */
const loginApi = async (context: BrowserContext) => {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`, { method: 'DELETE' })
  await payload.delete({ collection: 'email-sends', where: { email: { equals: EMAIL } } })
  expect((await context.request.post(`${BASE}/api/auth/code`, { data: { email: EMAIL } })).status()).toBe(200)
  const code = await latestCode(EMAIL)
  expect((await context.request.post(`${BASE}/api/auth/verify`, { data: { email: EMAIL, code } })).status()).toBe(200)
}

const cleanup = async () => {
  const like = { like: 'e2e-sec-' }
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
}

test.describe('攻击测试', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config: await config })
    original = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
    await payload.updateGlobal({
      slug: 'mail-settings',
      overrideAccess: true,
      data: { primary: { enabled: true, host: '127.0.0.1', port: 1025, secure: 'none', fromAddress: 'noreply@example.test', fromName: '我不是考神' } },
    })
    await cleanup()
  })

  test.afterAll(async () => {
    await payload.db.updateGlobal({ slug: 'mail-settings', data: { primary: original.primary, backup: original.backup } })
    await cleanup()
  })

  test('登录 cookie：脚本读不到、跨站不自动带（A13）', async ({ context }) => {
    await loginApi(context)
    const token = (await context.cookies(BASE)).find((c) => c.name === 'payload-token')
    expect(token?.httpOnly).toBe(true)
    expect(token?.sameSite).toBe('Lax')
  })

  test('别的网站带着考生 cookie 发写请求被拒（A12）', async ({ context }) => {
    await loginApi(context)
    const body = { data: { baseRev: -1, data: {} } }
    // 浏览器同源请求会带 Origin；不带 Origin 也不带 Sec-Fetch-Site 的非浏览器请求，cookie 一律不认
    expect((await context.request.post(`${BASE}/api/me/data`, { ...body, headers: { Origin: BASE } })).status()).toBe(200)
    expect((await context.request.post(`${BASE}/api/me/data`, body)).status()).toBe(401)
    const evil = await context.request.post(`${BASE}/api/me/data`, { ...body, headers: { Origin: 'https://evil.example' } })
    expect(evil.status()).toBe(401)
  })

  test('考生进不了后台、调不了管理员接口（A7）', async ({ context, page }) => {
    await page.goto(`${BASE}/admin`)
    await expect(page).toHaveURL(/\/admin\/login/)
    await loginApi(context)
    await page.goto(`${BASE}/admin`)
    await expect(page).toHaveURL(/\/admin\/(login|unauthorized)/)
    expect((await context.request.post(`${BASE}/api/import`, { data: {} })).status()).toBe(401)
    expect((await context.request.post(`${BASE}/api/mail-settings/test`, { data: {} })).status()).toBe(403)
    expect((await context.request.get(`${BASE}/api/globals/ai-settings`)).status()).toBe(403)
  })

  test('写作草稿里的 HTML 按原文显示，不执行（A10）', async ({ page }) => {
    const task = (await payload.find({ collection: 'writing-tasks', where: { _status: { equals: 'published' } }, limit: 1 })).docs[0]
    test.skip(!task, '本机没有已发布的写作题')
    const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
    await page.goto(`${BASE}/writing/${task!.id}`)
    const box = page.locator('textarea').first()
    await box.fill(evil)
    await page.waitForTimeout(1500) // 等草稿自动保存
    await page.reload()
    await expect(page.locator('textarea').first()).toHaveValue(evil)
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
    await page.evaluate(() => localStorage.clear())
  })
})
