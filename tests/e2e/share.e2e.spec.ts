import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

// 025 成绩分享卡片。登录那条走本机 Mailpit，邮箱以 e2e-share- 开头，测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const EMAIL = `e2e-share-${Date.now()}@example.test`
let payload: Payload

const submitReading = async (page: Page) => {
  await page.goto(`${BASE}/practice/latest-r1`)
  test.skip(page.url().includes('empty=1'), '本机没有阅读单元')
  await page.getByRole('button', { name: '交卷', exact: true }).click()
  const confirm = page.getByRole('button', { name: '仍然交卷' })
  if (await confirm.isVisible()) await confirm.click()
  await expect(page.getByTestId('result-bar')).toBeVisible()
}

const latestCode = async (to: string) => {
  for (let i = 0; i < 20; i++) {
    const { messages } = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] }
    if (messages?.[0]) {
      const m = /验证码是：(\d{6})/.exec(((await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string }).Text)
      if (m) return m[1]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('没有验证码')
}

test.beforeAll(async () => {
  payload = await getPayload({ config: await config })
})
test.afterAll(async () => {
  const like = { like: 'e2e-share-' }
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
})

test.describe('025 成绩分享卡片', () => {
  test('未登录：预览 1080 × 1440、二维码指向首页、保存下载、Esc 关闭；深色主题图片相同', async ({ browser }) => {
    const shots: string[] = []
    for (const theme of ['light', 'dark']) {
      const page = await (await browser.newContext()).newPage()
      await page.addInitScript((t) => localStorage.setItem('payload-theme', t), theme)
      await submitReading(page)
      await page.getByTestId('share-open').click()
      const img = page.getByTestId('share-image')
      await expect(img).toBeVisible()
      expect(await img.evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight])).toEqual([1080, 1440])
      await expect(img).toHaveAttribute('data-qr', `${BASE}/`)
      await expect(page.getByTestId('share-invite')).toHaveCount(0)
      shots.push((await img.getAttribute('src'))!)

      if (theme === 'light') {
        const dl = page.waitForEvent('download')
        await page.getByTestId('share-save').click()
        expect((await dl).suggestedFilename()).toMatch(/^我不是考神-成绩-\d{8}\.png$/)
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('share-dialog')).not.toBeVisible()
        await expect(page.getByTestId('share-open')).toBeFocused()
      }
      await page.context().close()
    }
    // 两次用时可能差几秒，整图不一定逐像素相同；比较背景：深色主题下也是米白
    const corner = async (src: string) => {
      const page = await (await browser.newContext()).newPage()
      const px = await page.evaluate(async (s) => {
        const img = new Image()
        img.src = s
        await img.decode()
        const c = document.createElement('canvas')
        c.width = 4
        c.height = 4
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        return Array.from(ctx.getImageData(1, 1, 1, 1).data)
      }, src)
      await page.context().close()
      return px
    }
    expect(await corner(shots[1])).toEqual(await corner(shots[0]))
    expect(await corner(shots[0])).toEqual([0xfc, 0xf7, 0xec, 255])
  })

  test('已登录：默认带邀请码，取消后指向首页', async ({ page }) => {
    test.setTimeout(90_000)
    await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`, { method: 'DELETE' })
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-email').fill(EMAIL)
    await page.getByTestId('login-send').click()
    await page.getByTestId('login-code').fill(await latestCode(EMAIL))
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 })

    await submitReading(page)
    await page.getByTestId('share-open').click()
    const invite = page.getByTestId('share-invite')
    await expect(invite).toBeChecked()
    const img = page.getByTestId('share-image')
    await expect(img).toHaveAttribute('data-qr', /\/i\/[A-Z0-9]{8}$/)
    await invite.uncheck()
    await expect(img).toHaveAttribute('data-qr', `${BASE}/`)
  })
})
