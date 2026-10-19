import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createLocalReq, getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { importEndpoint } from '../../src/endpoints/import'

// 003 练习界面验收。自己导入并发布示例套题 EX-001，结束时删除（quickstart.md）
const BASE = 'http://localhost:3000'
const PACK = path.resolve(process.cwd(), 'docs/import-example')
const CODE = 'EX-001'

type Q = { number: number; span?: number; answers: string }
type G = { type: string; options?: unknown[]; questions: Q[] }
const pack = JSON.parse(fs.readFileSync(path.join(PACK, 'import.json'), 'utf8')).data as {
  listening: { parts: { groups: G[] }[] }
  reading: { passages: { groups: G[] }[] }
}
const mediaPaths = fs
  .readdirSync(PACK, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && d.name !== 'import.json')
  .map((d) => path.relative(PACK, path.join(d.parentPath, d.name)).replace(/\\/g, '/'))

let id = 0

const removeExample = async () => {
  const payload = await getPayload({ config })
  await payload.delete({ collection: 'tests', where: { code: { equals: CODE } } })
  await payload.delete({ collection: 'media', where: { alt: { in: mediaPaths } } })
}

test.beforeAll(async () => {
  await removeExample()
  const payload = await getPayload({ config })
  const form = new FormData()
  for (const p of ['import.json', ...mediaPaths]) form.append('files', new File([fs.readFileSync(path.join(PACK, p))], p))
  const req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
  req.formData = async () => form
  const res = (await importEndpoint.handler(req)) as Response
  const body = (await res.json()) as { ok: boolean; created?: { id: number }[]; errors?: string[] }
  expect(body.errors ?? []).toEqual([])
  id = body.created![0].id
  await payload.update({ collection: 'tests', id, data: { _status: 'published' } })
})

test.afterAll(removeExample)

/** 按示例包答案作答指定 Part / 文章；override 按题号换成给定答案 */
export const answerAll = async (page: Page, module: 'listening' | 'reading', sections: number[], override: Record<number, string> = {}) => {
  const all = module === 'listening' ? pack.listening.parts : pack.reading.passages
  for (const n of sections) {
    const tab = page.getByRole('tab', { name: `${module === 'listening' ? 'Part' : 'Passage'} ${n}`, exact: true })
    if (await tab.count()) await tab.click()
    for (const g of all[n - 1].groups) {
      const text = ['completion', 'short_answer', 'labelling'].includes(g.type) && !g.options?.length
      for (const q of g.questions) {
        const lines = q.answers.split('\n')
        const answer = override[q.number] ?? lines[0].replace(/[()]/g, '')
        if (text) await page.getByRole('textbox', { name: `第 ${q.number} 题`, exact: true }).fill(answer)
        else if (g.type === 'multi_choice') for (const k of lines) await page.locator(`#q-${q.number} [data-key="${k}"]`).click()
        else await page.locator(`#q-${q.number} [data-key="${answer}"]`).click()
      }
    }
  }
}

const submit = async (page: Page) => {
  await page.getByRole('button', { name: '交卷', exact: true }).click()
  const confirm = page.getByRole('button', { name: '仍然交卷' })
  if (await confirm.isVisible()) await confirm.click()
  await expect(page.getByTestId('result-bar')).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test.describe('US1 首页进入并完成一组听力', () => {
  test('首页两次点击进入，未答提示，交卷与再做一遍', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE + '/')
    await page.getByRole('button', { name: /开始做题/ }).click()
    await expect(page).toHaveURL(new RegExp(`/practice/t${id}-l1$`))
    await expect(page.getByRole('button', { name: '播放' })).toBeVisible()

    await page.getByRole('button', { name: '交卷', exact: true }).click()
    await expect(page.getByText('还有 10 题没做')).toBeVisible()
    await expect(page.getByRole('button', { name: '仍然交卷' })).toBeVisible()
    await page.getByRole('button', { name: '继续作答' }).click()

    await answerAll(page, 'listening', [1])
    await page.getByRole('button', { name: '交卷', exact: true }).click()
    await expect(page.getByText('答对 10 / 10')).toBeVisible()

    await page.getByRole('button', { name: '再做一遍' }).click()
    await answerAll(page, 'listening', [1], { 1: 'Smith', 7: 'A' })
    await page.getByRole('button', { name: '交卷', exact: true }).click()
    await expect(page.getByText('答对 8 / 10')).toBeVisible()
    await expect(page.getByTestId('feedback-1')).toContainText('错误')
    await expect(page.getByTestId('feedback-1')).toContainText('Harper')
    // 交卷后选错的选项标红、正确选项标绿（005 FR-020）
    await expect(page.locator('#q-7 [data-key="A"]')).toHaveClass(/bg-error-soft/)
    await expect(page.locator('#q-7 [data-key="B"]')).toHaveClass(/bg-success-soft/)
  })
})

test.describe('US1 音频控件', () => {
  test('播放、倍速、拖动、后退 5 秒', async ({ page }) => {
    await page.goto(`${BASE}/practice/t${id}-l1`)
    const audio = page.locator('audio')
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.duration)).toBeGreaterThan(0)
    await page.getByRole('button', { name: '1.5×' }).click()
    expect(await audio.evaluate((a: HTMLAudioElement) => a.playbackRate)).toBe(1.5)
    await expect(page.getByLabel('播放进度')).not.toHaveAttribute('max', '0')
    await page.getByLabel('播放进度').fill('0.5')
    expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeCloseTo(0.5, 1)
    await page.getByRole('button', { name: '后退 5 秒' }).click()
    expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBe(0)
    await page.getByRole('button', { name: '播放' }).click()
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => !a.paused || a.ended)).toBe(true)
  })
})

test.describe('US2 11 种题型', () => {
  test('整套听力、整套阅读按答案作答得满分', async ({ page }) => {
    await page.goto(`${BASE}/practice/t${id}-l`)
    await answerAll(page, 'listening', [1, 2, 3, 4])
    await submit(page)
    await expect(page.getByText('答对 40 / 40')).toBeVisible()

    await page.goto(`${BASE}/practice/t${id}-r`)
    await answerAll(page, 'reading', [1, 2, 3])
    await submit(page)
    await expect(page.getByText('答对 40 / 40')).toBeVisible()
  })

  test('全部不答得 0 分', async ({ page }) => {
    await page.goto(`${BASE}/practice/t${id}-r`)
    await submit(page)
    await expect(page.getByText('答对 0 / 40')).toBeVisible()
  })

  test('多选最多选 2 项，配图可见', async ({ page }) => {
    await page.goto(`${BASE}/practice/t${id}-l2`)
    const opt = (k: string) => page.locator(`#q-16 [data-key="${k}"]`)
    await opt('A').click()
    await opt('B').click()
    await opt('C').click({ force: true })
    await expect(opt('C')).toHaveAttribute('aria-checked', 'false')
    await expect(opt('C')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('#q-16')).toContainText('选 2 项')
    await expect(page.locator('img[alt="题目配图"]')).toBeVisible()
  })
})

test.describe('US3 阅读对照与定位', () => {
  test('电脑上左右分栏', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/t${id}-r2`)
    const a = await page.getByTestId('passage-pane').boundingBox()
    const b = await page.getByTestId('questions-pane').boundingBox()
    expect(a && b && a.x !== b.x).toBe(true)
    await expect(page.getByTestId('passage-pane')).toBeVisible()
    await expect(page.getByTestId('questions-pane')).toBeVisible()
  })

  test('手机上原文 / 题目切换不丢作答，交卷后定位段落', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE}/practice/t${id}-r2`)
    await page.getByRole('button', { name: '题目', exact: true }).click()
    await page.locator('#q-14 [data-key="iii"]').click()
    await page.getByRole('button', { name: '原文', exact: true }).click()
    await page.getByRole('button', { name: '题目', exact: true }).click()
    await expect(page.locator('#q-14 [data-key="iii"]')).toHaveAttribute('aria-checked', 'true')

    await submit(page)
    await page.getByTestId('feedback-20').click()
    await page.getByTestId('explain-panel').getByRole('button', { name: '在原文中定位' }).click()
    await expect(page.locator('#para-C')).toBeInViewport()
    await expect(page.locator('#para-C')).toHaveAttribute('data-highlight', 'true')
  })
})

test.describe('US4 听力原文', () => {
  test('听力两栏：交卷前左栏放说明，交卷后放原文；音频条固定在顶部', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/t${id}-l1`)
    const left = page.getByTestId('passage-pane')
    await expect(page.getByText('Good morning, Lakeside Bike Tours')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '显示原文' })).toHaveCount(0)
    await expect(left.locator('p.italic').first()).toBeVisible()
    await page.getByTestId('questions-pane').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByRole('button', { name: '播放' })).toBeInViewport()
    await submit(page)
    await expect(left.getByText('Good morning, Lakeside Bike Tours')).toBeVisible()
  })
})

test.describe('US5 整套与 band', () => {
  test('整套阅读有分部切换、40 个题号，满分 band 9；单篇不显示 band', async ({ page }) => {
    await page.goto(`${BASE}/practice/t${id}-r`)
    for (const n of [1, 2, 3]) await expect(page.getByRole('tab', { name: `Passage ${n}`, exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '题号' }).getByRole('button')).toHaveCount(40)
    await answerAll(page, 'reading', [1, 2, 3])
    await submit(page)
    await expect(page.getByText('band 9')).toBeVisible()
    // 解析面板跨分部翻页（008 US1）
    await page.getByRole('tab', { name: 'Passage 1', exact: true }).click()
    await page.getByRole('navigation', { name: '题号' }).getByRole('button', { name: /第 13 题/ }).click()
    await page.getByTestId('explain-panel').getByRole('button', { name: '下一题' }).click()
    await expect(page.getByRole('tab', { name: 'Passage 2', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('explain-panel')).toHaveAttribute('aria-label', '第 14 题解析')
    await expect(page.getByText('估算分数，仅供参考')).toBeVisible()

    await page.goto(`${BASE}/practice/t${id}-r1`)
    await submit(page)
    await expect(page.getByTestId('result-bar')).not.toContainText('band')
  })
})

test.describe('US6 本地进度与记录', () => {
  test('刷新恢复作答，交卷后栏目页显示上次成绩和正确率', async ({ page }) => {
    await page.goto(`${BASE}/practice/t${id}-l1`)
    const box = (n: number) => page.getByRole('textbox', { name: `第 ${n} 题`, exact: true })
    await box(1).fill('Harper')
    await box(2).fill('14')
    await box(3).fill('four')
    await page.waitForTimeout(800)
    await page.reload()
    await expect(page.getByText('已恢复上次的作答')).toBeVisible()
    await expect(box(1)).toHaveValue('Harper')
    await expect(box(2)).toHaveValue('14')
    await expect(box(3)).toHaveValue('four')

    await submit(page)
    await page.goto(BASE + '/listening')
    await expect(page.getByTestId('local-accuracy')).toContainText('%')
    // 本机库有真实题库时刚做的那组可能不在第一页：先筛"已做"
    await page.getByRole('button', { name: '已做', exact: true }).click()
    await expect(page.getByTestId('practice-row').first()).toContainText('上次')
    await expect(page.getByText(/上次 \d+\/\d+/).first()).toBeVisible()
    await expect(page.getByTestId('ratio-ring').first()).toBeVisible()
  })

  test('作答无法保存时提示，仍能交卷', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError')
      }
    })
    await page.goto(`${BASE}/practice/t${id}-l1`)
    await expect(page.getByText('这次作答没法保存')).toBeVisible()
    await submit(page)
    await expect(page.getByText('答对 0 / 10')).toBeVisible()
  })
})

test.describe('020 做题计时', () => {
  // 示例套题阅读第 1 篇的题号数 → 倒计时时长（每题 1.5 分钟，向上取整到分钟）
  const nums = pack.reading.passages[0].groups.flatMap((g) => g.questions).reduce((n, q) => n + (q.span ?? 1), 0)
  const limit = Math.ceil(nums * 1.5) * 60
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const value = (page: Page) => page.getByTestId('timer-value')
  // 时钟只随 runFor 走，不随真实时间走
  const frozen = async (page: Page) => {
    await page.clock.install({ time: new Date('2026-10-19T08:00:00') })
    await page.clock.pauseAt(new Date('2026-10-19T08:00:01'))
  }
  // 时钟暂停时 React 的 effect 要等时钟走一下才跑，计时器这时才开始
  const warm = async (page: Page) => {
    await page.getByTestId('timer-value').waitFor()
    await page.clock.runFor(100)
  }
  const choose = async (page: Page, name: string) => {
    await page.getByTestId('timer').click()
    await page.getByRole('button', { name, exact: false }).first().click()
  }

  test('正计时、倒计时、超时提示、暂停、后台不计、刷新续计', async ({ page }) => {
    await frozen(page)
    await page.goto(`${BASE}/practice/t${id}-r1`)
    await warm(page)
    await expect(value(page)).toHaveText('0:00')
    await page.clock.runFor(65_000)
    await expect(value(page)).toHaveText('1:05')

    // 菜单按 Esc 关闭，焦点回到计时按钮（audit P2）
    await page.getByTestId('timer').click()
    await expect(page.getByRole('button', { name: /倒计时/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: /倒计时/ })).toBeHidden()
    await expect(page.getByTestId('timer')).toBeFocused()

    await choose(page, '倒计时')
    await expect(value(page)).toHaveText(fmt(limit - 65))
    await page.clock.runFor((limit - 65 + 35) * 1000)
    await expect(value(page)).toHaveText('超时 +0:35')
    await expect(page.getByRole('status').filter({ hasText: '时间到了，可以继续做完再交卷' })).toHaveCount(1)

    // 暂停期间不走
    await choose(page, '暂停')
    await expect(value(page)).toHaveText('已暂停')
    await page.clock.runFor(30_000)
    await choose(page, '继续')
    await page.clock.runFor(1_000)
    await expect(value(page)).toHaveText(/超时 \+0:3[67]/)

    // 页面在后台时不计
    await choose(page, '正计时')
    const before = await value(page).textContent()
    await page.evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))`)
    await page.clock.runFor(60_000)
    await page.evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'))`)
    await page.clock.runFor(1_000)
    // 后台 60 秒不计；回到前台后从那一刻重新算，多出的不超过 1 秒
    const sec = (t: string | null) => t!.split(':').map(Number).reduce((a, b) => a * 60 + b)
    const after = sec(await value(page).textContent())
    expect(after - sec(before)).toBeGreaterThanOrEqual(0)
    expect(after - sec(before)).toBeLessThanOrEqual(1)

    // 作答后刷新：接着计，模式记住
    const box = page.getByRole('textbox').first()
    if (await box.count()) await box.fill('x')
    else await page.locator('[data-key]').first().click()
    await page.clock.runFor(1_000)
    const saved = await value(page).textContent()
    // 刷新时让时钟照常走（暂停的时钟会卡住页面加载）
    await page.clock.resume()
    await page.reload()
    await expect(value(page)).not.toHaveText('0:00')
    const [m2, s2] = (await value(page).textContent())!.split(':').map(Number)
    const [m1, s1] = saved!.split(':').map(Number)
    expect(m2 * 60 + s2).toBeGreaterThanOrEqual(m1 * 60 + s1 - 2)
  })

  test('交卷后显示总用时、用时最长的题、解析里的本题用时，记录里有用时', async ({ page }) => {
    await frozen(page)
    await page.goto(`${BASE}/practice/t${id}-r1`)
    await warm(page)
    const q = (n: number) => page.locator(`[data-q="${n}"]`).first()
    await q(1).click()
    await page.clock.runFor(20_000)
    await q(2).click()
    await page.clock.runFor(3_000)
    await submit(page)

    await expect(page.getByTestId('result-time')).toHaveText(/^用时 0:2[34]$/)
    const slow = page.getByTestId('slow-q')
    await expect(slow).toHaveCount(1)
    await expect(slow.first()).toHaveText('第 1 题 0:20')
    await slow.first().click()
    await expect(page.getByTestId('q-time').first()).toHaveText('本题用时 0:20')

    const rec = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ybz:practice:v1') ?? '{}') as { records: { duration?: number; times?: Record<string, number>; limit?: number }[] }
      return s.records[s.records.length - 1]
    })
    expect(rec.duration).toBeGreaterThanOrEqual(23)
    expect(rec.times?.['1']).toBe(20)
    expect(rec.limit).toBeUndefined()
  })
})

test.describe('通用', () => {
  for (const unit of ['l1', 'r2', 'l']) {
    test(`t-${unit} 三种宽度无横向滚动、无商标、只请求本站`, async ({ page }) => {
      const hosts = new Set<string>()
      page.on('request', (req) => {
        const url = new URL(req.url())
        if (url.protocol.startsWith('http')) hosts.add(url.hostname)
      })
      for (const [width, height] of [
        [375, 667],
        [768, 1024],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height })
        await page.goto(`${BASE}/practice/t${id}-${unit}`, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${unit} @ ${width}px`).toBeLessThanOrEqual(0)
      }
      expect(await page.content()).not.toMatch(/ielts/i)
      expect([...hosts]).toEqual(['localhost'])
    })
  }

  test('无效链接显示没找到', async ({ page }) => {
    const res = await page.goto(`${BASE}/practice/t999999-l1`)
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: '没找到这组题' })).toBeVisible()
    await page.goto(`${BASE}/practice/nonsense`)
    await expect(page.getByRole('heading', { name: '没找到这组题' })).toBeVisible()
  })

  test('导航高亮所属栏目', async ({ page }) => {
    await page.goto(`${BASE}/practice/t${id}-r1`)
    await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '阅读' })).toHaveAttribute('aria-current', 'page')
  })
})
