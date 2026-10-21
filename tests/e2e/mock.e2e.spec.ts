import { test, expect, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { getMockPaper } from '../../src/content/mockPaper'
import { SLOTS } from '../../src/exam/mock'
import { scoreUnit, type Answers, type PracticeUnit } from '../../src/exam/practice'
import { answerLines, expandOptional } from '../../src/exam/scoring'
import type { MockPaper, Unit } from '../../src/payload-types'

// 028 全真模考。夹具：用库里已发布的单元建两张模考卷 9001、9002（标题 e2e-模考…），结束时删掉；不动单元。
// 用 page.clock 快进截止时间；--workers=1
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const EMAIL = `e2e-mock-${Date.now()}@example.test`
const NOS = [9001, 9002]
let units: Unit[] = []

const removePapers = async () => {
  const payload = await getPayload({ config })
  await payload.delete({ collection: 'mock-papers', where: { no: { in: NOS } } })
}

test.beforeAll(async () => {
  await removePapers()
  const payload = await getPayload({ config })
  // 每个位置取两个已发布单元，两张卷子各用一个
  const picks = await Promise.all(
    SLOTS.map(async (s) =>
      (
        await payload.find({
          collection: 'units',
          where: { _status: { equals: 'published' }, module: { equals: s.module }, part: { equals: s.part } },
          sort: 'id',
          limit: 2,
          depth: 0,
        })
      ).docs as Unit[],
    ),
  )
  units = picks.map((p) => p[0])
  for (const [i, no] of NOS.entries()) {
    const data = Object.fromEntries(SLOTS.map((s, k) => [s.key, picks[k][i].id])) as Record<(typeof SLOTS)[number]['key'], number>
    await payload.create({ collection: 'mock-papers', data: { no, title: `e2e-模考 ${no}`, ...data, _status: 'published' } })
  }
})

test.afterAll(async () => {
  await removePapers()
  const payload = await getPayload({ config })
  const like = { like: 'e2e-mock-' }
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
})

type Attempt = { no: number; stage: string; l?: { deadline: number; answers: Record<string, unknown> }; r?: { deadline: number } }
const attempts = (page: Page) =>
  page.evaluate(() => Object.values((JSON.parse(localStorage.getItem('ybz:practice:v1') ?? '{}').mocks ?? {}) as Record<string, unknown>)) as Promise<Attempt[]>
const current = async (page: Page, no = 9001) => (await attempts(page)).find((a) => a.no === no && !['done', 'abandoned'].includes(a.stage))

/** 快进到某个时间点之后 ms 毫秒 */
const jumpTo = async (page: Page, at: number, extra = 2000) => {
  const now = await page.evaluate(() => Date.now())
  if (at > now) await page.clock.fastForward(at - now)
  await page.clock.runFor(extra)
}

const startListening = async (page: Page, no = 9001) => {
  await page.goto(`${BASE}/mock/${no}`)
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('exam-audio-bar')).toBeVisible({ timeout: 20_000 })
}

test.describe('US1 考一场', () => {
  test('说明 → 听力（只放一次、不能查词、可高亮、可标记）→ 到点交卷 → 阅读 → 到点交卷', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-20T08:00:00') })
    await page.setViewportSize({ width: 1280, height: 900 })

    await page.goto(`${BASE}/mock`)
    await expect(page.getByText('e2e-模考 9001')).toBeVisible()

    await page.goto(`${BASE}/mock/9001`)
    await expect(page.getByText('听力音频只播放一次，不能暂停、拖动')).toBeVisible()
    expect(await current(page)).toBeUndefined() // 说明页不计时、不存

    await startListening(page)
    await expect.poll(() => page.getByTestId('exam-audio').evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0), { timeout: 15_000 }).toBe(true)
    await expect(page.getByRole('slider', { name: '音量' })).toBeVisible()
    await expect(page.getByTestId('audio-player')).toHaveCount(0)
    await expect(page.getByTestId('radio-link')).toHaveCount(0)
    await expect(page.getByText('隐藏原文')).toHaveCount(0)
    await expect(page.getByTestId('exam-timer')).toBeVisible()

    // 不能查词
    await page.evaluate(() => {
      const s = document.createElement('span')
      s.textContent = 'mitigated'
      s.dataset.e2e = 'word'
      document.querySelector('[data-testid="questions-pane"]')!.prepend(s)
    })
    await page.locator('[data-e2e="word"]').dblclick()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('lookup-card')).toBeHidden()

    // 可以高亮：选中题目说明的前几个字，右键 → 高亮
    const pos = await page.evaluate(async () => {
      const el = document.querySelector('[data-hl="q"] p.italic')!
      const t = el.firstChild as Text
      const r = document.createRange()
      r.setStart(t, 0)
      r.setEnd(t, Math.min(6, t.data.length))
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(r)
      const b = r.getClientRects()[0]
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    })
    await page.mouse.click(pos.x, pos.y, { button: 'right' })
    await page.getByRole('menu', { name: '高亮' }).getByRole('menuitem', { name: '高亮', exact: true }).click()
    expect(await page.evaluate(() => CSS.highlights.get('ybz-hl')?.size ?? 0)).toBe(1)

    // 作答 + 标记第 5 题
    await page.locator('#q-1').fill('e2e')
    await page.getByRole('button', { name: /^跳到第 5 题/ }).click()
    await page.getByTestId('flag-toggle').click()
    await expect(page.getByTestId('flag-5')).toBeVisible()
    await expect(page.getByRole('button', { name: /^跳到第 5 题.*已标记/ })).toBeVisible()
    await expect.poll(async () => (await current(page))?.l?.answers['1']).toBe('e2e')

    // 听力到点自动交卷
    await jumpTo(page, (await current(page))!.l!.deadline)
    await expect(page.getByText('听力已交卷')).toBeVisible()
    await expect(page.getByText('时间到，已自动交卷。')).toBeVisible()

    await page.getByRole('button', { name: '开始阅读（60 分钟）' }).click()
    await expect(page.getByTestId('exam-timer')).toHaveText(/^(60:00|59:5\d)$/)
    await page.clock.fastForward(55 * 60_000)
    await page.clock.runFor(1500)
    await expect(page.getByRole('status').filter({ hasText: '还剩 5 分钟' })).toBeAttached()

    await jumpTo(page, (await current(page))!.r!.deadline)
    await expect(page.getByTestId('band-l')).toBeVisible()
    await expect(page.getByTestId('band-r')).toBeVisible()
  })

  test('窄屏只显示"请用电脑"，拉宽恢复', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 })
    await page.goto(`${BASE}/mock/9001`)
    await expect(page.getByText('模考请用电脑打开')).toBeVisible()
    await expect(page.getByTestId('start-listening')).toBeHidden()
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.getByTestId('start-listening')).toBeVisible()
    await expect(page.getByText('模考请用电脑打开')).toBeHidden()
  })
})

/** 一个练习单位的标准答案（多选按 span 取前几个） */
const correctAnswers = (unit: PracticeUnit): Answers => {
  const out: Answers = {}
  for (const sec of unit.sections)
    for (const g of sec.groups)
      for (const q of g.questions) {
        const lines = answerLines(q.answers)
        out[q.number] = g.type === 'multi_choice' ? lines.slice(0, q.span) : expandOptional(lines[0].split('/')[0])[0]
      }
  return out
}

/** 改本机存着的这一场（模拟"已经答完"） */
const patchAttempt = (page: Page, no: number, mod: 'l' | 'r', answers: Answers) =>
  page.evaluate(
    ([no, mod, answers]) => {
      const s = JSON.parse(localStorage.getItem('ybz:practice:v1')!)
      const key = Object.keys(s.mocks).find((k) => s.mocks[k].no === no && !['done', 'abandoned'].includes(s.mocks[k].stage))!
      s.mocks[key][mod].answers = answers
      s.mocks[key].at = Date.now()
      localStorage.setItem('ybz:practice:v1', JSON.stringify(s))
    },
    [no, mod, answers] as const,
  )

test.describe('US2 成绩单', () => {
  test('听力全对、阅读全空 → 9 / 最低分；看解析、错题本、进步曲线、列表都联动', async ({ page }) => {
    const paper = (await getMockPaper(9001))!
    const answers = correctAnswers(paper.l)
    expect(scoreUnit(paper.l, answers).score).toBe(40)

    await page.clock.install({ time: new Date('2026-10-20T09:00:00') })
    await page.setViewportSize({ width: 1280, height: 900 })
    await startListening(page)
    await expect.poll(async () => (await current(page))?.stage).toBe('listening')
    // 先离开考试页（离开时页面会存一次），再改本机记录、回来
    await page.goto(`${BASE}/mock`)
    await patchAttempt(page, 9001, 'l', answers)
    await page.goto(`${BASE}/mock/9001`)
    await jumpTo(page, (await current(page))!.l!.deadline)
    await page.getByRole('button', { name: '开始阅读（60 分钟）' }).click()
    await expect(page.getByTestId('exam-timer')).toBeVisible()
    await jumpTo(page, (await current(page))!.r!.deadline)

    await expect(page.getByTestId('band-l')).toHaveText('9.0')
    await expect(page.getByTestId('band-r')).toHaveText('0.0')
    await expect(page.getByTestId('band-avg')).toHaveText('4.5')
    await expect(page.getByText('到点自动交卷').first()).toBeVisible()

    // 阅读解析：能定位原文
    await page.getByRole('button', { name: '查看阅读解析' }).click()
    await page.getByRole('button', { name: /^跳到第 1 题/ }).click()
    const panel = page.getByTestId('explain-panel')
    await expect(panel).toBeVisible()
    const locate = panel.getByRole('button', { name: '在原文中定位' })
    if (await locate.count()) {
      await locate.click()
      await expect(page.locator('[data-testid="passage-pane"] mark, [data-testid="passage-pane"] .bg-sun, [data-testid="passage-pane"] [data-highlight]').first()).toBeAttached()
    }

    // 错题本、进步曲线、列表
    await page.goto(`${BASE}/me/mistakes`)
    await expect(page.getByTestId('mistake-row').first()).toBeVisible()
    await page.goto(`${BASE}/me/progress`)
    await expect(page.getByTestId('progress-listening')).toContainText('最近整套 Band')
    await page.goto(`${BASE}/mock`)
    const row = page.getByTestId('practice-row').filter({ hasText: 'e2e-模考 9001' })
    await expect(row.getByRole('link', { name: /再考一次/ })).toBeVisible()
    await row.getByRole('link', { name: /查看成绩/ }).click()
    await expect(page.getByTestId('band-l')).toHaveText('9.0')
  })
})

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

const signIn = async (page: Page) => {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`, { method: 'DELETE' })
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-email').fill(EMAIL)
  await page.getByTestId('login-send').click()
  await page.getByTestId('login-code').fill(await latestCode(EMAIL))
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 })
}

const timerSeconds = async (page: Page) => {
  const [m, s] = ((await page.getByTestId('exam-timer').textContent()) ?? '').trim().split(':').map(Number)
  return m * 60 + s
}

test.describe('US3 续考', () => {
  test('听力中刷新：作答、标记都在，剩余时间连续，点继续后音频回到应在位置', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-20T10:00:00') })
    await page.setViewportSize({ width: 1280, height: 900 })
    await startListening(page)
    await page.locator('#q-1').fill('alpha')
    await page.locator('#q-2').fill('beta')
    await page.getByRole('button', { name: /^跳到第 3 题/ }).click()
    await page.getByTestId('flag-toggle').click()
    await page.clock.runFor(20_000)
    const before = await timerSeconds(page)

    await page.reload()
    await expect(page.locator('#q-1')).toHaveValue('alpha')
    await expect(page.locator('#q-2')).toHaveValue('beta')
    await expect(page.getByTestId('flag-3')).toBeVisible()
    expect(Math.abs((await timerSeconds(page)) - before)).toBeLessThanOrEqual(3)

    const resume = page.getByRole('button', { name: '继续听力' })
    if (await resume.isVisible()) await resume.click()
    const a = (await current(page))!.l! as { startedAt?: number }
    const want = ((await page.evaluate(() => Date.now())) - (a.startedAt ?? 0)) / 1000
    await expect
      .poll(() => page.getByTestId('exam-audio').evaluate((el: HTMLAudioElement) => el.currentTime), { timeout: 15_000 })
      .toBeGreaterThan(want - 3)
  })

  test('阅读中关掉页面，过了截止再打开 → 已自动交卷，显示成绩单', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-20T11:00:00') })
    await page.setViewportSize({ width: 1280, height: 900 })
    await startListening(page)
    await jumpTo(page, (await current(page))!.l!.deadline)
    await page.getByRole('button', { name: '开始阅读（60 分钟）' }).click()
    await expect(page.getByTestId('exam-timer')).toBeVisible()
    const deadline = (await current(page))!.r!.deadline

    await page.goto(`${BASE}/mock`)
    await jumpTo(page, deadline, 1000)
    await page.goto(`${BASE}/mock/9001`)
    await expect(page.getByTestId('band-r')).toBeVisible()
    await expect(page.getByText('到点自动交卷')).toHaveCount(2)
  })

  test('两个标签页：后开的提示已在别处打开，可以抢过来；进行中再开另一张卷子要先处理', async ({ context }) => {
    const a = await context.newPage()
    await a.setViewportSize({ width: 1280, height: 900 })
    await startListening(a)

    const b = await context.newPage()
    await b.setViewportSize({ width: 1280, height: 900 })
    await b.goto(`${BASE}/mock/9001`)
    await expect(b.getByText('这场考试已在别的窗口打开。')).toBeVisible()
    await b.getByRole('button', { name: '在这里继续' }).click()
    await expect(b.getByTestId('exam-timer')).toBeVisible()
    await expect(a.getByText('这场考试已在别的窗口打开。')).toBeVisible({ timeout: 10_000 })

    await b.goto(`${BASE}/mock/9002`)
    await expect(b.getByText('你还有一场「模考 9001」没考完')).toBeVisible()
    await b.getByRole('button', { name: '放弃那一场' }).click()
    await expect(b.getByTestId('start-listening')).toBeVisible()
  })

  test('已登录断网作答、到点交卷，恢复网络后另一台设备能接着考', async ({ browser }) => {
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await signIn(page)
    await page.clock.install({ time: new Date('2026-10-20T12:00:00') })
    await startListening(page)
    await ctx.setOffline(true)
    await page.locator('#q-1').fill('offline')
    await jumpTo(page, (await current(page))!.l!.deadline)
    await expect(page.getByRole('button', { name: '开始阅读（60 分钟）' })).toBeVisible()
    await ctx.setOffline(false)
    await page.waitForResponse((r) => r.url().endsWith('/api/me/data') && r.ok(), { timeout: 20_000 })

    // 另一台设备：同一账号的登录 cookie，本机存储是空的（再走一遍验证码会碰上 60 秒限频）
    const other = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: await ctx.cookies(), origins: [] } })
    const p2 = await other.newPage()
    await p2.goto(`${BASE}/mock/9001`)
    await expect(p2.getByRole('button', { name: '开始阅读（60 分钟）' })).toBeVisible({ timeout: 15_000 })
    await ctx.close()
    await other.close()
  })

  test('考试中卷子的单元被下架：这场无法继续，列表不再显示这张卷子', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await startListening(page, 9002)
    const payload = await getPayload({ config })
    const paper = (await payload.find({ collection: 'mock-papers', where: { no: { equals: 9002 } }, depth: 0 })).docs[0] as MockPaper
    const unitId = paper.r1 as number
    await payload.update({ collection: 'units', id: unitId, data: { _status: 'draft' } })
    try {
      await page.goto(`${BASE}/mock/9002`)
      await expect(page.getByText('这张卷子已下架')).toBeVisible()
      await expect(page.getByText('你正在考的这一场无法继续')).toBeVisible()
      await page.goto(`${BASE}/mock`)
      await expect(page.getByText('e2e-模考 9002')).toHaveCount(0)
    } finally {
      await payload.update({ collection: 'units', id: unitId, data: { _status: 'published' } })
    }
  })
})

test.describe('US4 后台', () => {
  test('编辑页按位置显示；把 Passage 2 换成一篇 Passage 3 发布被拒，换回后能发布', async ({ page }) => {
    await seedTestUser()
    try {
      const payload = await getPayload({ config })
      const paper = (await payload.find({ collection: 'mock-papers', where: { no: { equals: 9001 } }, depth: 0 })).docs[0] as MockPaper
      await login({ page, user: testUser })
      await page.goto(`${BASE}/admin/collections/mock-papers/${paper.id}`)
      await expect(page.locator('label', { hasText: '阅读 Passage 2' })).toBeVisible()
      await expect(page.locator('label', { hasText: '听力 Part 4' })).toBeVisible()

      const wrong = units.find((u) => u.module === 'reading' && u.part === 3)!
      await expect(payload.update({ collection: 'mock-papers', id: paper.id, data: { r2: wrong.id, _status: 'published' } })).rejects.toThrow()
      const after = (await payload.findByID({ collection: 'mock-papers', id: paper.id, depth: 0 })) as MockPaper
      expect(after.r2).toBe(paper.r2)
      await payload.update({ collection: 'mock-papers', id: paper.id, data: { r2: paper.r2 as number, _status: 'published' } })
    } finally {
      await cleanupTestUser()
    }
  })
})

test.describe('随机一场', () => {
  test('列表有随机模考；进入时抽 7 个单元；中途回来是同一场；考完"再考一次"重新抽', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-20T13:00:00') })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${BASE}/mock`)
    const row = page.getByTestId('practice-row').filter({ hasText: '随机模考' })
    await expect(row.getByRole('link', { name: /开始随机一场/ })).toBeVisible()

    await page.goto(`${BASE}/mock/random`)
    await page.waitForURL(/\/mock\/random\?u=(\d+,){6}\d+$/)
    const first = new URL(page.url()).searchParams.get('u')
    await page.getByTestId('start-listening').click()
    await expect(page.getByTestId('exam-audio-bar')).toBeVisible({ timeout: 20_000 })
    const a = (await attempts(page)).find((x) => x.no === 0 && x.stage === 'listening') as Attempt & { units: number[] }
    expect(a.units.join(',')).toBe(first)

    // 回到列表再进来：还是这一场
    await page.goto(`${BASE}/mock`)
    await expect(row.getByRole('link', { name: /继续考试/ })).toBeVisible()
    await page.goto(`${BASE}/mock/random`)
    await page.waitForURL(/\?u=/)
    expect(new URL(page.url()).searchParams.get('u')).toBe(first)
    await expect(page.getByTestId('exam-timer')).toBeVisible()

    // 考完
    await jumpTo(page, (await attempts(page)).find((x) => x.no === 0 && x.stage === 'listening')!.l!.deadline)
    await page.getByRole('button', { name: '开始阅读（60 分钟）' }).click()
    await expect(page.getByTestId('exam-timer')).toBeVisible()
    await jumpTo(page, (await attempts(page)).find((x) => x.no === 0 && x.stage === 'reading')!.r!.deadline)
    await expect(page.getByTestId('band-l')).toBeVisible()

    await page.getByRole('button', { name: '再考一次' }).click()
    await page.waitForURL((u) => u.searchParams.get('u') !== null && u.searchParams.get('u') !== first)
    await expect(page.getByTestId('start-listening')).toBeVisible()
  })
})
