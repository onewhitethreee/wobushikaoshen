import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { clearStats, seedFirstAttempts } from '../helpers/statsSeed'

// 035 题目作答统计：先补足 20 人（前台接口有 5 分钟缓存，要在第一次读之前补）→ 未登录交卷，统计请求发出 →
// 解析面板显示"正确率 · 人做过"、成绩面板显示"超过 X%" → 后台 /admin/stats 看到这个单元；
// 统计接口出错时交卷照常；375px 不横向滚动。用本机最新的阅读单元，用完清掉它的统计
const BASE = 'http://localhost:3000'
let payload: Payload
let unitId = ''

const submitEmpty = async (page: import('@playwright/test').Page) => {
  await page.goto(`${BASE}/practice/${unitId}`)
  await page.getByRole('button', { name: '交卷' }).click()
  const confirm = page.getByRole('button', { name: '交卷' })
  if (await confirm.count()) await confirm.last().click().catch(() => {})
  await expect(page.getByTestId('result-bar')).toBeVisible()
}

test.describe('作答统计', () => {
  test.beforeAll(async ({ browser }) => {
    payload = await getPayload({ config: await config })
    const page = await browser.newPage()
    await page.goto(`${BASE}/practice/latest-r1`)
    unitId = page.url().split('/practice/')[1].split(/[?#]/)[0]
    await page.close()
    test.skip(!/^u\d+$/.test(unitId), '本机没有阅读单元')
    await clearStats(payload, unitId)
    await seedFirstAttempts(payload, unitId, 20)
  })
  test.afterAll(async () => {
    if (unitId) await clearStats(payload, unitId)
    await cleanupTestUser()
  })

  test('未登录交卷 → 统计请求发出；满 20 人后前台显示正确率和超过百分比', async ({ browser }) => {
    test.setTimeout(180_000)
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const sent = page.waitForRequest((r) => r.url().endsWith('/api/stats/attempts') && r.method() === 'POST')
    await submitEmpty(page)
    const body = (await sent).postDataJSON() as { unitId: string; device: string }
    expect(body.unitId).toBe(unitId)
    expect(body.device).toMatch(/^[0-9a-f-]{36}$/)

    await expect(page.getByTestId('unit-stat')).toContainText('你超过了')
    // 手机上解析面板要点开：点题号条第一题
    await page.getByRole('button', { name: /第 \d+ 题/ }).first().click()
    await expect(page.getByTestId('question-stat').first()).toContainText('人做过')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('统计接口出错时交卷照常、没有报错', async ({ page }) => {
    test.setTimeout(120_000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/stats/**', (r) => r.fulfill({ status: 500, body: '' }))
    await submitEmpty(page)
    await expect(page.getByTestId('unit-stat')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('后台作答统计能看到这个单元', async ({ browser }) => {
    test.setTimeout(120_000)
    await seedTestUser()
    const page = await (await browser.newContext()).newPage()
    await login({ page, user: testUser })
    await page.goto(`${BASE}/admin/stats?tab=units&exam=ielts&module=reading&open=${unitId}`)
    await expect(page.getByRole('heading', { name: '作答统计' })).toBeVisible()
    await expect(page.getByRole('link', { name: '作答统计' }).first()).toBeVisible()
    await page.goto(`${BASE}/admin/stats?exam=ielts&module=reading&min=20`)
    await expect(page.locator(`a[href="/practice/${unitId}"]`).first()).toBeVisible()
  })
})
