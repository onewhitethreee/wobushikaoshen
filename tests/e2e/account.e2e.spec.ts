import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { MailSetting } from '../../src/payload-types'

// 009 登录与同步。发信走本机 Mailpit（docker 容器 ielts-mail，SMTP 1025、接口 8025），测试邮箱都以 e2e- 开头，测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const EMAIL = `e2e-login-${Date.now()}@example.test`

let payload: Payload
let original: MailSetting

/** 从 Mailpit 取发给 to 的最新一封验证码 */
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

const clearMailpit = (to: string) =>
  fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`, { method: 'DELETE' })

export const login = async (page: Page, email: string) => {
  await clearMailpit(email)
  // 同一邮箱 60 秒内只能发一次：测试里连续登录多次，先清掉这个邮箱的发信记录
  await payload.delete({ collection: 'email-sends', where: { email: { equals: email } } })
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-send').click()
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.getByTestId('login-code').fill(await latestCode(email))
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 })
}

const cleanup = async () => {
  const like = { like: 'e2e-login-' }
  const members = await payload.find({ collection: 'members', where: { email: like }, limit: 100 })
  const ids = members.docs.map((m) => m.id)
  if (ids.length) await payload.delete({ collection: 'member-data' as never, where: { member: { in: ids } } }).catch(() => {})
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
}

test.describe('邮箱验证码登录', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config: await config })
    original = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
    await payload.updateGlobal({
      slug: 'mail-settings',
      overrideAccess: true,
      data: {
        primary: { enabled: true, host: '127.0.0.1', port: 1025, secure: 'none', fromAddress: 'noreply@example.test', fromName: '我不是考神' },
      },
    })
    await cleanup()
  })

  test.afterAll(async () => {
    await payload.db.updateGlobal({ slug: 'mail-settings', data: { primary: original.primary, backup: original.backup } })
    await cleanup()
  })

  test('填邮箱收验证码登录，退出后回到未登录', async ({ page }) => {
    await login(page, EMAIL)
    await page.getByTestId('account-menu').locator('summary').click()
    await page.getByRole('button', { name: '退出' }).click()
    await expect(page.getByTestId('account-menu')).toHaveText('登录', { timeout: 15_000 })
  })

  test('验证码填错提示，60 秒内不能重发', async ({ page }) => {
    const email = `e2e-login-wrong-${Date.now()}@example.test`
    await clearMailpit(email)
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-send').click()
    const code = await latestCode(email)
    await page.getByTestId('login-code').fill(code === '000000' ? '111111' : '000000')
    await page.getByTestId('login-submit').click()
    await expect(page.getByText('验证码不对')).toBeVisible()
    await expect(page.getByRole('button', { name: /重新发送（\d+）/ })).toBeDisabled()
  })

  test('邮箱格式不对时不发信', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-email').fill('not-an-email')
    await page.getByTestId('login-send').click()
    await expect(page.getByTestId('login-code')).toHaveCount(0)
  })

  test('不登录也能做题交卷，全程不要求登录', async ({ page }) => {
    await page.goto(`${BASE}/practice/latest-l1`)
    test.skip(page.url().includes('empty=1'), '本机没有听力单元')
    await expect(page.getByTestId('account-menu')).toHaveText('登录')
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('button', { name: '交卷' }).last().click()
    await expect(page.getByText(/\d+ \/ \d+|正确率|得分/).first()).toBeVisible()
    expect(page.url()).not.toContain('/login')
  })

  test('首次登录合并本机记录，两台设备互相同步，退出清空本机', async ({ browser }) => {
    test.setTimeout(180_000)
    const email = `e2e-login-sync-${Date.now()}@example.test`
    const submit = async (page: Page, path: string) => {
      await page.goto(`${BASE}${path}`)
      await page.getByRole('button', { name: '交卷' }).click()
      await page.getByRole('button', { name: '交卷' }).last().click()
      await expect(page.getByRole('button', { name: '再做一遍' }).first()).toBeVisible()
    }
    const records = (page: Page) =>
      page.evaluate(`JSON.parse(localStorage.getItem('ybz:practice:v1') || '{"records":[]}').records.length`) as Promise<number>

    const a = await (await browser.newContext()).newPage()
    await a.goto(`${BASE}/practice/latest-l1`)
    test.skip(a.url().includes('empty=1'), '本机没有听力单元')
    // 未登录时在设备 A 做 2 次
    await submit(a, '/practice/latest-l1')
    await submit(a, '/practice/latest-r1')
    expect(await records(a)).toBe(2)
    await login(a, email)

    // 设备 B 登录同一账号，看到 A 的 2 条
    const b = await (await browser.newContext()).newPage()
    await login(b, email)
    await b.goto(`${BASE}/listening`)
    await expect.poll(() => records(b), { timeout: 15_000 }).toBe(2)

    // B 再做 1 次，A 刷新后看到 3 条
    await submit(b, '/practice/latest-l1')
    await expect.poll(async () => {
      await b.waitForTimeout(2500) // 等防抖推送
      return records(b)
    }).toBe(3)
    await a.goto(`${BASE}/listening`)
    await expect.poll(() => records(a), { timeout: 15_000 }).toBe(3)

    // A 退出：本机清空；再登录恢复
    await a.getByTestId('account-menu').locator('summary').click()
    await a.getByRole('button', { name: '退出' }).click()
    await expect(a.getByTestId('account-menu')).toHaveText('登录', { timeout: 15_000 })
    expect(await a.evaluate(`localStorage.getItem('ybz:practice:v1')`)).toBeNull()
    await login(a, email)
    await a.goto(`${BASE}/listening`)
    await expect.poll(() => records(a), { timeout: 15_000 }).toBe(3)
  })
})
