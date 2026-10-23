import { test, expect } from '@playwright/test'

import pkg from '../../package.json' with { type: 'json' }

// 001 前台验收：导航 6 项、中文、无商标与模板文案、手机无横向滚动
const BASE = 'http://localhost:3000'
const ROUTES = ['/', '/listening', '/reading', '/writing', '/speaking', '/mock', '/posts', '/search', '/help']
const NAV = ['首页', '听力', '阅读', '写作', '口语', '模考']

test.describe('前台', () => {
  for (const route of ROUTES) {
    test(`${route} 中文、无商标和模板文案`, async ({ page }) => {
      const res = await page.goto(BASE + route)
      expect(res?.status()).toBe(200)
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('zh-CN')
      const nav = page.getByRole('navigation', { name: '主导航' })
      for (const label of NAV) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible()
      const html = await page.content()
      expect(html).not.toMatch(/ielts/i)
      expect(html).not.toContain('Payload Website Template')
    })

    test(`${route} 375px 无横向滚动`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(BASE + route)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    })
  }

  test('页脚：栏目导航、使用说明、领额度、源代码与版本号', async ({ page }) => {
    await page.goto(`${BASE}/help`)
    const footer = page.getByTestId('site-footer')
    for (const [name, href] of [
      ['听力', '/listening'], ['阅读', '/reading'], ['写作', '/writing'], ['口语', '/speaking'],
      ['模考', '/mock'], ['机经', '/jijing'], ['备考文章', '/posts'],
      ['使用说明与常见问题', '/help'], ['领额度', '/#quota'],
    ])
      await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
    await expect(footer.getByRole('link', { name: '源代码（AGPL-3.0）' })).toHaveAttribute('href', /github\.com\/onewhitethreee\/wobushikaoshen$/)
    await expect(page.getByTestId('footer-version')).toHaveText(`更新日志 · v${pkg.version}`)
    await expect(page.getByTestId('footer-version')).toHaveAttribute('href', /\/releases$/)
    await expect(page.getByTestId('help-faq')).toContainText('好友注册了，邀请却没算上？')
  })

  test('可安装到主屏幕：清单、图标、主题色，没有 service worker（019）', async ({ page, request }) => {
    await page.goto('http://localhost:3000/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    const res = await request.get(`http://localhost:3000${href}`)
    expect(res.status()).toBe(200)
    const m = (await res.json()) as { name: string; icons: { src: string }[] }
    expect(m.name).toBe('我不是考神')
    for (const icon of m.icons) {
      const r = await request.get(`http://localhost:3000${icon.src}`)
      expect(r.status()).toBe(200)
      expect(r.headers()['content-type']).toContain('image/png')
    }
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', '我不是考神')
    const colors = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => [e.getAttribute('media'), e.getAttribute('content')]))
    expect(colors).toEqual([
      ['(prefers-color-scheme: light)', '#fcf7ec'],
      ['(prefers-color-scheme: dark)', '#13110e'],
    ])
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
  })
})
