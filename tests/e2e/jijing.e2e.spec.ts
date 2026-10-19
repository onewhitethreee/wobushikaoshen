import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

// 027 机经栏目：用 payload 建三篇 e2e 文章（两篇机经、一篇备考文章），测完删除
const BASE = 'http://localhost:3000'
let payload: Payload

// 发布的文章正文必填：给一段最小的富文本
const content = {
  root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textFormat: 0, children: [{ type: 'text', text: 'e2e', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }] },
}
const make = (title: string, extra: object) =>
  payload.create({ collection: 'posts', context: { disableRevalidate: true }, data: { title, slug: title, content, _status: 'published', ...extra } as never })

test.beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await payload.delete({ collection: 'posts', context: { disableRevalidate: true }, where: { title: { like: 'e2e-jijing-' } } })
  await make('e2e-jijing-autumn', { column: 'jijing', subjects: ['speaking', 'writing'], publishedAt: '2026-10-10T08:00:00.000Z' })
  await make('e2e-jijing-summer', { column: 'jijing', subjects: ['listening'], publishedAt: '2026-06-01T08:00:00.000Z' })
  await make('e2e-jijing-article', { column: 'article', publishedAt: '2026-10-11T08:00:00.000Z' })
})
test.afterAll(async () => {
  await payload.delete({ collection: 'posts', context: { disableRevalidate: true }, where: { title: { like: 'e2e-jijing-' } } })
})

test.describe('027 机经栏目', () => {
  test('/jijing 按题季分组、按科目筛选，元数据与站点地图', async ({ page, request }) => {
    await page.goto(`${BASE}/jijing`)
    const seasons = page.getByTestId('jijing-season')
    await expect(seasons.first().getByRole('heading')).toHaveText('2026 年 9–12 月')
    await expect(seasons.first()).toContainText('e2e-jijing-autumn')
    await expect(seasons.nth(1).getByRole('heading')).toHaveText('2026 年 5–8 月')
    await expect(page.getByText('e2e-jijing-article')).toHaveCount(0)

    await page.getByTestId('jijing-filter').getByRole('link', { name: '口语' }).click()
    await expect(page).toHaveURL(/subject=speaking/)
    await expect(page.getByTestId('jijing-row')).toHaveCount(1)
    await expect(page.getByTestId('jijing-row')).toContainText('e2e-jijing-autumn')

    await expect(page).toHaveTitle(/雅思机经/)
    expect(await page.title()).not.toMatch(/IELTS/i)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/jijing$/)
    expect(await (await request.get(`${BASE}/pages-sitemap.xml`)).text()).toContain('/jijing</loc>')
  })

  test('/posts 不列机经；首页文章区块给机经加标签、有机经入口；手机不横向滚动', async ({ page }) => {
    await page.goto(`${BASE}/posts`)
    await expect(page.getByText('e2e-jijing-article')).toBeVisible()
    await expect(page.getByText('e2e-jijing-autumn')).toHaveCount(0)

    await page.goto(BASE)
    await expect(page.getByTestId('home-jijing')).toHaveAttribute('href', '/jijing')
    const row = page.getByRole('link', { name: /e2e-jijing-autumn/ })
    await expect(row).toContainText('机经')

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/jijing`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
