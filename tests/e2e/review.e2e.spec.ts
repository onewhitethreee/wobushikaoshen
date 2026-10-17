import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'

import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { LookupItem } from '../../src/endpoints/lookup'
import type { AiSetting, MailSetting } from '../../src/payload-types'

// 015 写作批改（research R10）：不调真实 DeepSeek，测试里起本地桩代替 /chat/completions，
// 按作文里的标记决定返回：BADJSON → 坏 JSON，OUTOFRANGE → 越界分数，其余正常。
// 发信走本机 Mailpit（ielts-mail），测试邮箱以 e2e-review- 开头，测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const stamp = Date.now()
const mail = (k: string) => `e2e-review-${k}-${stamp}@example.test`

let payload: Payload
let originalMail: MailSetting
let originalAi: AiSetting
let originalSignup: number
let stub: Server
let stubCalls = 0
let task2: number
let task1: { id: number; chartData: string | null | undefined }

const essay = (tag: string) => `${tag} Education is the key to a better future for young people. `.repeat(16).trim()

const goodResult = {
  criteria: ['TR', 'CC', 'LR', 'GRA'].map((key, i) => ({ key, band: 6 + (i % 2) * 0.5, reason: `${key} 的理由` })),
  paragraphs: [{ index: 1, comment: '第一段的建议' }],
  rewrites: [1, 2, 3].map((i) => ({ original: `Original sentence ${i}.`, revised: `Revised sentence ${i}.`, why: '更准确' })),
  lengthNote: '',
}

const startStub = () =>
  new Promise<number>((resolve) => {
    stub = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        stubCalls++
        const material = JSON.parse(JSON.parse(body).messages[1].content) as { essay?: string; studentAnswer?: string }
        // 错题讲解：答案是 failme 时返回 500
        if (material.studentAnswer !== undefined) {
          if (material.studentAnswer === 'failme') return void res.writeHead(500).end('boom')
          res.setHeader('content-type', 'application/json')
          return void res.end(JSON.stringify({ choices: [{ message: { content: `你写的 ${material.studentAnswer} 和 **原文** 对不上。` } }], usage: { prompt_tokens: 80, completion_tokens: 40 } }))
        }
        const text = material.essay as string
        const content = text.includes('BADJSON')
          ? 'not json'
          : JSON.stringify(text.includes('OUTOFRANGE') ? { ...goodResult, criteria: goodResult.criteria.map((c) => ({ ...c, band: 9.5 })) } : goodResult)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }))
      })
    }).listen(0, '127.0.0.1', () => resolve((stub.address() as AddressInfo).port))
  })

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

// 在登录页完成验证码登录（调用前页面已在 /login）
const fillLogin = async (page: Page, email: string) => {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { method: 'DELETE' })
  await payload.delete({ collection: 'email-sends', where: { email: { equals: email } } })
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-send').click()
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.getByTestId('login-code').fill(await latestCode(email))
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 }) // 登录后跳首页，开发模式首次编译慢
}
const login = async (page: Page, email: string) => {
  await page.goto(`${BASE}/login`)
  await fillLogin(page, email)
}

const memberId = async (email: string) => (await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1 })).docs[0].id
const give = async (email: string, amount: number) =>
  payload.create({ collection: 'credit-entries', data: { member: await memberId(email), amount, reason: 'adjust', note: 'e2e' } })
const amounts = async (email: string) =>
  (await payload.find({ collection: 'credit-entries', where: { member: { equals: await memberId(email) } }, sort: 'id', limit: 100 })).docs
    .filter((e) => e.reason !== 'adjust')
    .map((e) => e.amount)

const write = async (page: Page, id: number, text: string) => {
  await page.goto(`${BASE}/writing/${id}`)
  // 页面加载草稿时重新渲染会打断 fill 的全选，新文字接在旧草稿后面：填完核对，不对就重填
  await expect(async () => {
    await page.locator('#essay').fill(text)
    await expect(page.locator('#essay')).toHaveValue(text, { timeout: 500 })
  }).toPass()
  await expect(page.getByText('已保存')).toBeVisible()
}
const review = async (page: Page) => {
  await page.getByTestId('review-start').click()
  await page.getByTestId('review-submit').click()
}

const cleanup = async () => {
  const like = { like: 'e2e-review-' }
  const ids = (await payload.find({ collection: 'members', where: { email: like }, limit: 100 })).docs.map((m) => m.id)
  if (ids.length) await payload.delete({ collection: 'writing-reviews', where: { member: { in: ids } }, overrideAccess: true })
  if (ids.length) await payload.delete({ collection: 'explanation-unlocks', where: { member: { in: ids } }, overrideAccess: true })
  await payload.delete({ collection: 'answer-explanations', where: { answer: { in: ['wrongans', 'failme'] } }, overrideAccess: true })
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
}

test.describe('写作 AI 批改', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config: await config })
    originalMail = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
    originalAi = await payload.findGlobal({ slug: 'ai-settings', overrideAccess: true })
    // 本文件的余额断言从 0 算起：关掉 016 的注册赠送，测完恢复
    originalSignup = (await payload.findGlobal({ slug: 'credit-settings', overrideAccess: true })).signupReward
    await payload.updateGlobal({ slug: 'credit-settings', overrideAccess: true, data: { signupReward: 0 } })
    await payload.updateGlobal({
      slug: 'mail-settings',
      overrideAccess: true,
      data: { primary: { enabled: true, host: '127.0.0.1', port: 1025, secure: 'none', fromAddress: 'noreply@example.test', fromName: '我不是考神' } },
    })
    const port = await startStub()
    await payload.updateGlobal({ slug: 'ai-settings', overrideAccess: true, data: { baseUrl: `http://127.0.0.1:${port}`, apiKey: 'e2e-stub' } })
    const find = (taskType: 'task1' | 'task2') =>
      payload.find({ collection: 'writing-tasks', where: { taskType: { equals: taskType }, _status: { equals: 'published' } }, sort: 'id', limit: 1 })
    task2 = (await find('task2')).docs[0].id
    // 拿一道 Task 1 临时清空图表数据（直接写主表，不产生版本），测完恢复
    const t1 = (await find('task1')).docs[0]
    task1 = { id: t1.id, chartData: t1.chartData }
    await payload.db.updateOne({ collection: 'writing-tasks', id: t1.id, data: { chartData: null } })
    await cleanup()
  })

  test.afterAll(async () => {
    await payload.db.updateOne({ collection: 'writing-tasks', id: task1.id, data: { chartData: task1.chartData ?? null } })
    await payload.db.updateGlobal({ slug: 'ai-settings', data: { baseUrl: originalAi.baseUrl, apiKey: originalAi.apiKey ?? null } })
    await payload.db.updateGlobal({ slug: 'mail-settings', data: { primary: originalMail.primary, backup: originalMail.backup } })
    await payload.updateGlobal({ slug: 'credit-settings', overrideAccess: true, data: { signupReward: originalSignup } })
    stub?.close()
    await cleanup()
  })

  test('正常批改扣 1；坏 JSON 退回；连点和多标签页只扣一次；手机上不横向滚动', async ({ browser }) => {
    const A = mail('a')
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, A)
    await give(A, 5)

    // 正常：确认框写明余额 → 结果显示总分与四项 → 流水 −1
    await write(page, task2, essay('NORMAL'))
    await page.getByTestId('review-start').click()
    await expect(page.getByTestId('review-confirm')).toContainText('你现在有 5 额度')
    await page.getByTestId('review-submit').click()
    await expect(page.getByTestId('review-start')).toHaveText('批改中…')
    await expect(page.locator('#essay')).toHaveAttribute('readonly', '')
    await expect(page.getByTestId('review-overall')).toHaveText('6.5', { timeout: 30_000 }) // (6 + 6.5 + 6 + 6.5) / 4 = 6.25 → 6.5
    await expect(page.getByTestId('review-result')).toContainText('Coherence and Cohesion')
    await expect(page.getByTestId('review-result')).toContainText('Revised sentence 3.')
    expect(await amounts(A)).toEqual([-1])

    // 手机宽度：结果区不横向滚动（FR-052）
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1280, height: 800 })

    // 坏 JSON：提示已退回，余额不变（SC-002）
    await write(page, task2, essay('BADJSON'))
    await review(page)
    await expect(page.getByTestId('review-note')).toHaveText('批改没成功，额度已退回')
    await expect(page.locator('#essay')).not.toHaveAttribute('readonly', '')
    expect(await amounts(A)).toEqual([-1, -1, 1])

    // 越界分数同样算失败
    await write(page, task2, essay('OUTOFRANGE'))
    await review(page)
    await expect(page.getByTestId('review-note')).toHaveText('批改没成功，额度已退回')
    expect(await amounts(A)).toEqual([-1, -1, 1, -1, 1])

    // 连点 5 次 + 另一个标签页同时提交：只有 1 条 −1、1 次 AI 调用（SC-003）
    await write(page, task2, essay('TWICE'))
    const page2 = await ctx.newPage()
    await page2.goto(`${BASE}/writing/${task2}`)
    await expect(page2.locator('#essay')).toHaveValue(essay('TWICE'))
    await page.getByTestId('review-start').click()
    await page2.getByTestId('review-start').click()
    const calls = stubCalls
    await Promise.all([page.getByTestId('review-submit').click({ clickCount: 5 }), page2.getByTestId('review-submit').click()])
    await expect(page.getByTestId('review-overall')).toBeVisible()
    await expect(page2.getByTestId('review-overall')).toBeVisible()
    expect(await amounts(A)).toEqual([-1, -1, 1, -1, 1, -1])
    expect(stubCalls - calls).toBe(1)
    await ctx.close()
  })

  test('批改记录：写作页列出历次、详情是当时的作文、同一篇再交不扣、别人看不到', async ({ browser }) => {
    const C = mail('c')
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, C)
    await give(C, 5)

    // 同题批改两次 → 写作页两条记录
    await write(page, task2, essay('FIRST'))
    await review(page)
    await expect(page.getByTestId('review-overall')).toBeVisible({ timeout: 30_000 })
    await write(page, task2, essay('SECOND'))
    await expect(page.getByTestId('task-reviews').getByRole('listitem')).toHaveCount(1)
    await review(page)
    await expect(page.getByTestId('review-overall')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('task-reviews').getByRole('listitem')).toHaveCount(2)

    // 不改作文再交 → 显示上次的结果，不扣
    const calls = stubCalls
    await review(page)
    await expect(page.getByText('这篇和上次批改的一样，下面是上次的结果，没有扣额度')).toBeVisible()
    expect(await amounts(C)).toEqual([-1, -1])
    expect(stubCalls).toBe(calls)

    // 详情：作文是当时的快照（较早那条是 FIRST）
    await page.goto(`${BASE}/me/reviews`)
    await expect(page.getByTestId('review-row')).toHaveCount(2)
    await page.getByTestId('review-row').last().getByRole('link').click()
    await expect(page.getByTestId('review-essay')).toContainText('FIRST Education')
    await expect(page.getByTestId('review-overall')).toHaveText('6.5')
    const detailUrl = page.url()

    // 手机宽度：详情页不横向滚动（FR-052）
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    // 两页都 noindex
    for (const path of ['/me/reviews', new URL(detailUrl).pathname]) {
      expect(await (await page.request.get(`${BASE}${path}`)).text()).toMatch(/<meta name="robots" content="noindex/)
    }

    // 另一个账号打开详情链接 → 看不到
    const other = await browser.newContext()
    const page2 = await other.newPage()
    await login(page2, mail('d'))
    await page2.goto(detailUrl)
    await expect(page2.getByTestId('review-missing')).toBeVisible()
    await expect(page2.getByText('FIRST Education')).toHaveCount(0)
    await other.close()
    await ctx.close()
  })

  test('错题讲解：扣 1、再看不扣、别人同错答命中缓存、答对没有按钮、失败退回、未登录提示', async ({ browser }) => {
    const E = mail('e')
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()

    // 最新阅读单元里第一个全是填空题的题组
    await page.goto(`${BASE}/practice/latest-r1`)
    test.skip(page.url().includes('empty=1'), '本机没有阅读单元')
    const unit = page.url().split('/practice/')[1]
    let g: { id: string; qs: { n: number; a: string }[] } | undefined
    for (let k = 1; k <= 6 && !g; k++) {
      const id = `${unit}-g${k}`
      const item = ((await (await page.request.get(`${BASE}/api/practice/lookup?ids=${id}`)).json()) as { items: Record<string, LookupItem> }).items[id]
      if (item.gone) break
      const qs = item.questions ?? []
      if (qs.length >= 4 && qs.every((q) => ['completion', 'short_answer'].includes(q.type)))
        g = { id, qs: qs.map((q) => ({ n: q.number, a: q.answers.split('\n')[0].replace(/[()（）]/g, '').split('/')[0].trim() })) }
    }
    test.skip(!g, '最新阅读单元里没有 4 题以上的填空题组')
    const [wrong, right, failing, blank] = g!.qs

    const doGroup = async (p: Page) => {
      await p.goto(`${BASE}/practice/${g!.id}`)
      await p.getByRole('textbox', { name: `第 ${wrong.n} 题` }).fill('wrongans')
      await p.getByRole('textbox', { name: `第 ${right.n} 题` }).fill(right.a)
      await p.getByRole('textbox', { name: `第 ${failing.n} 题` }).fill('failme')
      await p.getByRole('button', { name: '交卷', exact: true }).click()
      const confirm = p.getByRole('button', { name: '仍然交卷' })
      if (await confirm.isVisible()) await confirm.click()
      await expect(p.getByTestId('result-bar')).toBeVisible()
    }
    const panel = (p: Page) => p.getByTestId('explain-panel')
    const open = async (p: Page, n: number) => {
      await p.getByTestId(`feedback-${n}`).click()
      await expect(panel(p)).toHaveAttribute('aria-label', `第 ${n} 题解析`)
    }

    // 未登录：提示登录
    await doGroup(page)
    await open(page, wrong.n)
    await expect(panel(page).getByTestId('ai-explain')).toContainText('登录后可以让 AI 讲解你的答案')

    await login(page, E)
    await give(E, 5)
    await doGroup(page)

    // 答错 → 讲解 → −1
    await open(page, wrong.n)
    const calls = stubCalls
    await panel(page).getByTestId('ai-explain-ask').click()
    await expect(panel(page).getByTestId('ai-explain-body')).toContainText('为什么不是 wrongans')
    await expect(panel(page).getByTestId('ai-explain-body').locator('b')).toHaveText('原文')
    expect(await amounts(E)).toEqual([-1])
    expect(stubCalls - calls).toBe(1)

    // 手机宽度：解析面板里的讲解不横向滚动（FR-052）
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1440, height: 900 })

    // 答对的题没有按钮；未作答的有
    await open(page, right.n)
    await expect(panel(page).getByTestId('ai-explain')).toHaveCount(0)
    await open(page, blank.n)
    await expect(panel(page).getByTestId('ai-explain-ask')).toBeVisible()

    // 桩返回 500 → 提示已退回，余额不变
    await open(page, failing.n)
    await panel(page).getByTestId('ai-explain-ask').click()
    await expect(panel(page).getByTestId('ai-explain-note')).toHaveText('讲解没成功，额度已退回')
    expect(await amounts(E)).toEqual([-1, -1, 1])

    // 「我的额度」流水显示用途（T031）
    await page.goto(`${BASE}/me/credits`)
    await expect(page.getByTestId('credit-entry').first()).toContainText('退回 · 错题讲解')
    await expect(page.getByTestId('credit-entry').nth(1)).toContainText('使用 · 错题讲解')

    // 刷新后（错题本里）直接显示，不扣、不调 AI
    const before = stubCalls
    await page.goto(`${BASE}/me/mistakes`)
    const row = page.getByTestId('mistake-row').filter({ has: page.locator('span.tabular-nums', { hasText: new RegExp(`^${wrong.n}$`) }) }).first()
    await row.getByRole('button', { expanded: false }).click()
    await expect(row.getByTestId('ai-explain-body')).toContainText('为什么不是 wrongans')
    await expect(row.getByTestId('ai-explain-ask')).toHaveCount(0)
    expect(await amounts(E)).toEqual([-1, -1, 1])
    expect(stubCalls).toBe(before)
    await ctx.close()

    // 换账号同题同错答 → −1，命中缓存，桩没收到新请求（SC-006）
    const F = mail('f')
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page2 = await ctx2.newPage()
    await login(page2, F)
    await give(F, 1)
    await doGroup(page2)
    await open(page2, wrong.n)
    await panel(page2).getByTestId('ai-explain-ask').click()
    await expect(panel(page2).getByTestId('ai-explain-body')).toContainText('你写的 wrongans')
    expect(await amounts(F)).toEqual([-1])
    expect(stubCalls).toBe(before)

    // 余额 0：提示额度不够
    await open(page2, blank.n)
    await panel(page2).getByTestId('ai-explain-ask').click()
    await expect(panel(page2).getByTestId('ai-explain-note')).toContainText('额度不够')
    expect(await amounts(F)).toEqual([-1])
    await ctx2.close()
  })

  test('字数不足、余额 0、未登录、Task 1 没有图表数据：都不扣', async ({ browser }) => {
    const B = mail('b')
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    // 未登录：跳登录页，登录后回到写作页批改区，草稿还在（SC-007）
    await write(page, task2, essay('GUEST'))
    await page.getByTestId('review-start').click()
    await expect(page).toHaveURL(/\/login\?next=/)
    await fillLogin(page, B)
    await expect(page).toHaveURL(`${BASE}/writing/${task2}#review`)
    await expect(page.locator('#essay')).toHaveValue(essay('GUEST'))

    // 余额 0：确认框直接说额度不够，给「我的额度」入口
    await page.getByTestId('review-start').click()
    await expect(page.getByTestId('review-confirm')).toContainText('额度不够')
    await expect(page.getByTestId('review-confirm').getByRole('link')).toHaveAttribute('href', '/me/credits')

    // 字数不足：不弹确认
    await give(B, 1)
    await write(page, task2, 'Too short to review.')
    await page.getByTestId('review-start').click()
    await expect(page.getByTestId('review-note')).toHaveText('至少写 80 词再批改（现在 4 词）')
    await expect(page.getByTestId('review-confirm')).toHaveCount(0)

    // Task 1 没有图表数据：按钮不可用
    await page.goto(`${BASE}/writing/${task1.id}`)
    await expect(page.getByTestId('review-start')).toBeDisabled()
    await expect(page.getByText('这道题暂时不能批改')).toBeVisible()

    expect(await amounts(B)).toEqual([])
    await ctx.close()
  })
})
