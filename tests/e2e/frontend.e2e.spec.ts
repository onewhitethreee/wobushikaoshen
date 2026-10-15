import { test, expect } from '@playwright/test'

// 001 前台验收：导航 6 项、中文、无商标与模板文案、手机无横向滚动
const BASE = 'http://localhost:3000'
const ROUTES = ['/', '/listening', '/reading', '/writing', '/speaking', '/mock', '/posts', '/search']
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
})
