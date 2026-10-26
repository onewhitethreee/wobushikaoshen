import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { importPackage } from '../../src/import/importPackage'

// 033 四 / 六级真题的前台验收：导入 tests/fixtures/cet（改成 2099 年的试卷，保证排在最前、不和本机真实试卷同组），测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const FIX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/cet')
const PAPER = '2099-01-1'
const GROUP = '2099 年 1 月 第 1 套'
const PREFIX = 'fixture-cet4-'
const EMAIL = `e2e-cet-${Date.now()}@example.test`

let payload: Payload
const ids: Record<string, number> = {}

const pack = (kind: string) => {
  const m = JSON.parse(fs.readFileSync(path.join(FIX, kind, 'import.json'), 'utf8')) as { publish?: boolean; data: Record<string, unknown>[] }
  m.publish = true
  for (const d of m.data) d.paper = PAPER
  return JSON.stringify(m)
}
const reader = (kind: string) => async (p: string) => {
  const f = path.join(FIX, kind, p)
  if (!fs.existsSync(f)) return null
  const data = fs.readFileSync(f)
  return { data, size: data.length }
}
const cleanup = async () => {
  await payload.delete({ collection: 'units', where: { sourceId: { like: PREFIX } } })
  await payload.delete({ collection: 'writing-tasks', where: { sourceId: { like: PREFIX } } })
  await payload.delete({ collection: 'media', where: { alt: { like: PREFIX } } })
  await payload.delete({ collection: 'members', overrideAccess: true, where: { email: { equals: EMAIL } } })
}

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
const login = async (page: Page) => {
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-email').fill(EMAIL)
  await page.getByTestId('login-send').click()
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.getByTestId('login-code').fill(await latestCode(EMAIL))
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
  const req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
  for (const kind of ['reading', 'listening', 'writing']) {
    const r = await importPackage(req, pack(kind), reader(kind))
    if (!r.body.ok) throw new Error(`${kind}: ${r.body.errors.join('\n')}`)
  }
  for (const c of ['units', 'writing-tasks'] as const)
    for (const d of (await payload.find({ collection: c, where: { sourceId: { like: PREFIX } }, limit: 20, depth: 0 })).docs) ids[d.sourceId!] = d.id
})
test.afterAll(cleanup)

test('雅思栏目、模考不出现四 / 六级（US4）', async ({ page }) => {
  for (const p of ['/reading', '/listening', '/writing', '/mock', '/']) {
    await page.goto(`${BASE}${p}`)
    const html = await page.content()
    expect(html, p).not.toContain('Why Cities Need Small Parks')
    expect(html, p).not.toContain('介绍城市里的口袋公园')
    expect(html, p).not.toContain(GROUP)
  }
})

test('页头进四级，按试卷分组；六级不含四级（US1）', async ({ page }) => {
  await page.goto(BASE)
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '四六级' }).click()
  await expect(page).toHaveURL(`${BASE}/cet4`)
  await expect(page.getByTestId('row-group').first()).toHaveText(GROUP)
  const rows = page.getByTestId('practice-row')
  await expect(rows.nth(0)).toContainText('Section A 新闻报道')
  await expect(rows.nth(1)).toContainText('选词填空')
  await expect(rows.nth(4)).toContainText('仔细阅读 2')
  await expect(rows.nth(5)).toContainText('写作')
  await expect(rows.nth(6)).toContainText('翻译')
  await expect(page.getByRole('navigation', { name: '四级 / 六级' }).getByRole('link', { name: '六级' })).toBeVisible()

  await page.goto(`${BASE}/cet6`)
  expect(await page.content()).not.toContain(GROUP)
})

test('选词填空：词库按字母排、译文开关、交卷看解析；手机无横向滚动（US1）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/practice/u${ids['fixture-cet4-2024-06-1-a']}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`四级 ${GROUP} · 选词填空`)
  await expect(page.locator('dl dt').nth(0)).toHaveText('A')
  await expect(page.locator('dl dt').nth(1)).toHaveText('B')

  const toggle = page.getByTestId('translation-toggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('translation')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('translation').first()).toContainText('园艺社')
  await toggle.click()
  await expect(page.getByTestId('translation')).toHaveCount(0)

  await page.getByRole('button', { name: '交卷' }).click()
  await page.getByRole('button', { name: '交卷' }).last().click()
  await expect(page.getByTestId('explain-panel')).toContainText('detailed')
  // 交卷后译文开关仍可用
  await toggle.click()
  await expect(page.getByTestId('translation').first()).toBeVisible()

  await page.setViewportSize({ width: 375, height: 800 })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('四级栏目写作、翻译行有 AI 批改按钮（034 FR-001）', async ({ page }) => {
  await page.goto(`${BASE}/cet4`)
  const rows = page.getByTestId('practice-row')
  for (const i of [5, 6]) await expect(rows.nth(i).getByRole('link', { name: /AI 批改/ })).toHaveAttribute('href', /\/writing\/\d+#review/)
})

test('随机抽题只在四级里抽（FR-023）', async ({ page }) => {
  await page.goto(`${BASE}/cet4`)
  await page.getByTestId('pick-random').click()
  await expect(page).toHaveURL(/\/(practice\/u|writing\/)\d+\?pick=%2Fcet4/)
})

test('听力：交卷后原文 + 段落译文；连播接口按考试（US2）', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/practice/u${ids['fixture-cet4-2024-06-1-la']}`)
  await expect(page.getByTestId('translation-toggle')).toHaveCount(0)
  // 四 / 六级听力默认隐藏题干（试卷上只印选项），可以切换
  const stem = page.getByText('Why did the six residents have to move?')
  await expect(page.getByTestId('stem-toggle')).toHaveAttribute('aria-pressed', 'true')
  await expect(stem).toBeHidden()
  await expect(page.getByText('Smoke and heat damage.')).toBeVisible()
  await page.getByTestId('stem-toggle').click()
  await expect(stem).toBeVisible()
  await page.getByTestId('stem-toggle').click()
  await expect(stem).toBeHidden()
  await page.getByRole('button', { name: '交卷' }).click()
  await page.getByRole('button', { name: '交卷' }).last().click()
  await page.getByTestId('translation-toggle').click()
  await expect(page.getByTestId('translation').first()).toContainText('六人不得不搬走')
  await expect(page.getByTestId('translation')).toHaveCount(2)

  const cet = await (await request.get(`${BASE}/api/listening/playlist?exam=cet4`)).json()
  expect(cet.items[0].id).toBe(`u${ids['fixture-cet4-2024-06-1-la']}`)
  expect(cet.items[0].tag).toBe(GROUP)
  expect((await request.get(`${BASE}/api/listening/playlist?exam=cet5`)).status()).toBe(400)
  const ielts = await (await request.get(`${BASE}/api/listening/playlist`)).json()
  expect(ielts.items.map((x: { id: string }) => x.id)).not.toContain(`u${ids['fixture-cet4-2024-06-1-la']}`)
})

test('写作：字数要求、草稿、看范文；翻译不显示字数；批改入口与字数下限（033 US3、034）', async ({ page }) => {
  const w = ids['fixture-cet4-2024-06-1-w']
  const t = ids['fixture-cet4-2024-06-1-t']
  await page.goto(`${BASE}/writing/${w}`)
  await expect(page.getByText('120–180 词')).toBeVisible()
  await expect(page.getByTestId('review-start')).toBeVisible()
  await page.locator('#essay').fill('Libraries should be open to the public.')
  await expect(page.getByText('已保存')).toBeVisible()
  await page.reload()
  await expect(page.locator('#essay')).toHaveValue('Libraries should be open to the public.')
  await page.getByTestId('model-answer-toggle').click()
  await expect(page.getByTestId('model-answer')).toContainText('范文译文')
  await expect(page.getByTestId('model-answer')).toContainText('解析')

  await page.goto(`${BASE}/writing/${t}`)
  await expect(page.getByText('四级 · 2099 年 1 月 第 1 套 · 翻译')).toBeVisible()
  await expect(page.getByText(/\d+–\d+ 词/)).toHaveCount(0)

  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`, { method: 'DELETE' })
  await login(page)
  // 034：翻译不到 20 词不能批改、不扣（不触发真实 AI 调用）
  const res = await page.evaluate(async (taskId) => {
    const r = await fetch('/api/me/writing-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, essay: 'word '.repeat(10) }) })
    return { status: r.status, body: await r.json() }
  }, t)
  expect(res).toEqual({ status: 400, body: { error: 'words', min: 20, max: 1000, words: 10 } })
  await page.goto(`${BASE}/writing/${t}`)
  await page.locator('#essay').fill('word '.repeat(10))
  await page.getByTestId('review-start').click()
  await expect(page.getByTestId('review-note')).toContainText('至少写 20 词')
  const m = (await payload.find({ collection: 'members', overrideAccess: true, where: { email: { equals: EMAIL } } })).docs[0]
  const spent = await payload.find({ collection: 'credit-entries', overrideAccess: true, where: { member: { equals: m.id }, amount: { less_than: 0 } } })
  expect(spent.totalDocs).toBe(0)
})
