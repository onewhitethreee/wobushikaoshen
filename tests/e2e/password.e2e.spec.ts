import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { MailSetting } from '../../src/payload-types'

// 012 邮箱 + 密码登录。验证码从本机 Mailpit（ielts-mail）取；测试邮箱以 e2e-pw- 开头，测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'

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

const codeLogin = async (page: Page, email: string) => {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { method: 'DELETE' })
  await payload.delete({ collection: 'email-sends', where: { email: { equals: email } } })
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-tab-code').click()
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-send').click()
  await page.getByTestId('login-code').fill(await latestCode(email))
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test')
}

const passwordLogin = async (page: Page, email: string, password: string) => {
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-tab-password').click()
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-password-submit').click()
}

const setPassword = async (page: Page, password: string) => {
  await page.goto(`${BASE}/me/password`)
  await page.getByTestId('password-new').fill(password)
  await page.getByTestId('password-confirm').fill(password)
  await page.getByTestId('password-save').click()
}

const openMenu = (page: Page) => page.getByTestId('account-menu').locator('summary').click()

const cleanup = async () => {
  const like = { like: 'e2e-pw-' }
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
}

test.describe('邮箱 + 密码登录', () => {
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

  test('验证码登录后设密码，退出后用密码登录；登录页记住上次的方式', async ({ page }) => {
    const email = `e2e-pw-a-${Date.now()}@example.test`
    await codeLogin(page, email)
    await openMenu(page)
    await page.getByRole('link', { name: '设置密码' }).click()
    await expect(page.getByRole('heading', { name: '设置密码' })).toBeVisible()

    await page.getByTestId('password-new').fill('abc')
    await page.getByTestId('password-confirm').fill('abc')
    await page.getByTestId('password-save').click()
    await expect(page.getByText('密码至少 8 个字符')).toBeVisible()

    await setPassword(page, 'my-pass-123')
    await expect(page.getByTestId('password-done')).toHaveText('已设置，下次可以用密码登录')
    await page.reload()
    await openMenu(page)
    await expect(page.getByRole('link', { name: '修改密码' })).toBeVisible()
    await page.getByRole('button', { name: '退出' }).click()
    await expect(page.getByTestId('account-menu')).toHaveText('登录')

    await passwordLogin(page, email, 'wrong-pass-1')
    await expect(page.getByText('邮箱或密码不对')).toBeVisible()
    await page.getByTestId('login-password').fill('my-pass-123')
    await page.getByTestId('login-password-submit').click()
    await expect(page.getByTestId('account-menu')).toContainText('***@example.test')

    await openMenu(page)
    await page.getByRole('button', { name: '退出' }).click()
    // 退出后页面会自己刷新一次，等它结束再跳，否则 goto 会被打断
    await expect(page.getByTestId('account-menu')).toHaveText('登录')
    await page.goto(`${BASE}/login`)
    await expect(page.getByTestId('login-password')).toBeVisible()
  })

  test('改密码后另一台设备下线；忘记密码时用验证码登录后直接重设', async ({ browser }) => {
    const email = `e2e-pw-b-${Date.now()}@example.test`
    const a = await (await browser.newContext()).newPage()
    const b = await (await browser.newContext()).newPage()
    await codeLogin(a, email)
    await setPassword(a, 'first-pass-1')
    await expect(a.getByTestId('password-done')).toBeVisible()

    await passwordLogin(b, email, 'first-pass-1')
    await expect(b.getByTestId('account-menu')).toContainText('***@example.test')

    await setPassword(a, 'second-pass-1')
    await expect(a.getByTestId('password-done')).toHaveText('密码已修改，其他设备需要重新登录')
    await a.reload()
    await expect(a.getByTestId('account-menu')).toContainText('***@example.test')
    await b.reload()
    await expect(b.getByTestId('account-menu')).toHaveText('登录')

    await passwordLogin(b, email, 'first-pass-1')
    await expect(b.getByText('邮箱或密码不对')).toBeVisible()
    await b.getByTestId('login-password').fill('second-pass-1')
    await b.getByTestId('login-password-submit').click()
    await expect(b.getByTestId('account-menu')).toContainText('***@example.test')

    // 忘记密码：换一台设备只用验证码登录，不输旧密码直接设新的
    const c = await (await browser.newContext()).newPage()
    await codeLogin(c, email)
    await setPassword(c, 'third-pass-1')
    await expect(c.getByTestId('password-done')).toHaveText('密码已修改，其他设备需要重新登录')
    await passwordLogin(c, email, 'third-pass-1')
    await expect(c.getByTestId('account-menu')).toContainText('***@example.test')
  })
})
