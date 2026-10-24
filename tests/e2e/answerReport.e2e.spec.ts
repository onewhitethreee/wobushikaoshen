import { expect, test, type Browser, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { LookupItem } from '../../src/endpoints/lookup'

// 031 答案纠错举报：交卷后举报 → 刷新仍显示审核中 → 后台通过 → 我的额度 +N、流水"答案举报"、举报列表已通过；
// 未登录点举报出现登录链接；375px 我的额度不横向滚动。用本机已导入的阅读单元，没有填空题组时跳过
const BASE = 'http://localhost:3000'
const EMAIL = `e2e-areport-${Date.now()}@example.test`
const PASSWORD = 'e2e-areport-pass-1'
let payload: Payload

/** 最新阅读单元里第一个全是填空题的题组 */
const textGroup = async (page: Page) => {
  await page.goto(`${BASE}/practice/latest-r1`)
  test.skip(page.url().includes('empty=1'), '本机没有阅读单元')
  const unit = page.url().split('/practice/')[1]
  for (let g = 1; g <= 6; g++) {
    const id = `${unit}-g${g}`
    const item = ((await (await page.request.get(`${BASE}/api/practice/lookup?ids=${id}`)).json()) as { items: Record<string, LookupItem> }).items[id]
    if (item.gone) break
    const qs = item.questions ?? []
    if (qs.length && qs.every((q) => ['completion', 'short_answer'].includes(q.type))) return { id, first: qs[0].number }
  }
  test.skip(true, '最新阅读单元里没有填空题组')
  throw new Error('unreachable')
}

const answerAndSubmit = async (page: Page, id: string, n: number, text: string) => {
  await page.goto(`${BASE}/practice/${id}`)
  await page.getByRole('textbox', { name: `第 ${n} 题` }).fill(text)
  await page.getByRole('button', { name: '交卷' }).click()
  const confirm = page.getByRole('button', { name: '交卷' })
  if (await confirm.count()) await confirm.last().click().catch(() => {})
  await expect(page.getByRole('button', { name: '再做一遍' }).first()).toBeVisible()
}

const member = async (browser: Browser, viewport?: { width: number; height: number }) => {
  const ctx = await browser.newContext(viewport ? { viewport } : {})
  expect((await ctx.request.post(`${BASE}/api/auth/password`, { data: { email: EMAIL, password: PASSWORD } })).ok()).toBe(true)
  return ctx
}

test.describe('答案纠错举报', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: 'e2e-areport-' } } })
    await payload.create({ collection: 'members', overrideAccess: true, data: { email: EMAIL, password: PASSWORD, passwordSet: true } })
  })
  test.afterAll(async () => {
    await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { like: 'e2e-areport-' } } })
  })

  test('交卷后举报 → 审核通过 → 我的额度看到奖励', async ({ browser }) => {
    test.setTimeout(180_000)
    const ctx = await member(browser)
    const page = await ctx.newPage()
    const g = await textGroup(page)
    await answerAndSubmit(page, g.id, g.first, '13th of June e2e')

    const panel = page.getByTestId('explain-panel')
    await panel.getByTestId('report-answer').click()
    const form = panel.getByTestId('report-form')
    await expect(form).toContainText('13th of June e2e')
    await form.getByLabel('我的答案也应该算对').check()
    await form.getByTestId('report-remark').fill('日期写法')
    await form.getByTestId('report-submit').click()
    await expect(panel.getByTestId('report-status')).toHaveText('已举报，审核中，审核通过后奖励额度')

    // 重做同一题再交卷：状态从接口取回
    await answerAndSubmit(page, g.id, g.first, '13th of June e2e')
    await expect(page.getByTestId('explain-panel').getByTestId('report-status')).toHaveText('已举报，审核中')

    // 后台通过（同审核页保存）
    const m = (await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: EMAIL } } })).docs[0]
    const r = (await payload.find({ collection: 'answer-reports', overrideAccess: true, where: { member: { equals: m.id } } })).docs[0]
    expect(r.answer).toBe('13th of June e2e')
    const admin = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true })).docs[0]
    await payload.update({ collection: 'answer-reports', id: r.id, data: { status: 'approved' }, user: { ...admin, collection: 'users' }, overrideAccess: false })

    await page.goto(`${BASE}/me/credits`)
    await expect(page.getByTestId('credit-balance')).toHaveText(String(r.amount))
    await expect(page.getByTestId('credit-entry').first()).toContainText('答案举报')
    await expect(page.getByTestId('my-reports')).toContainText(`已通过 +${r.amount}`)
    await ctx.close()
  })

  test('未登录点"答案有问题"出现登录链接', async ({ page }) => {
    const g = await textGroup(page)
    await answerAndSubmit(page, g.id, g.first, 'x')
    const panel = page.getByTestId('explain-panel')
    await panel.getByTestId('report-answer').click()
    await expect(panel.getByTestId('report-guest').getByRole('link', { name: '登录' })).toHaveAttribute('href', /^\/login\?next=/)
  })

  test('375px 我的额度不横向滚动', async ({ browser }) => {
    // 自己造一条举报：前面的用例失败时 worker 重启会重跑 beforeAll，账号和举报都会重建
    const m = (await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: EMAIL } } })).docs[0]
    await payload.create({
      collection: 'answer-reports',
      overrideAccess: true,
      data: { member: m.id, unitKey: 'u1', number: 99, kind: 'other', answer: 'a very long answer '.repeat(8), status: 'pending' },
    })
    const ctx = await member(browser, { width: 375, height: 812 })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/me/credits`)
    await expect(page.getByTestId('my-reports')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await ctx.close()
  })
})
