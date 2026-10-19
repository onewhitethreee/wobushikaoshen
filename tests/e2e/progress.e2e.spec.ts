import { expect, test, type Page } from '@playwright/test'

// 021 进步曲线：往本机存储写入交卷记录，不登录（未登录用本机记录）
const BASE = 'http://localhost:3000'
const KEY = 'ybz:practice:v1'
const DAY = 86_400_000
const T0 = Date.parse('2026-10-01T09:00:00')

type Item = { groupKey: string; number: number; correct: boolean; type: string }
type Rec = { unitId: string; module: 'l' | 'r'; at: number; score: number; total: number; items: Item[]; duration?: number }

// 12 次听力，正确率逐步升高；题型：判断错得多、填空都对
const listening: Rec[] = Array.from({ length: 12 }, (_, i) => {
  const score = 2 + Math.floor(i / 2)
  const items: Item[] = Array.from({ length: 10 }, (_, k) => ({
    groupKey: `u999-g${i}`,
    number: k + 1,
    correct: k < score,
    type: k < 5 ? 'completion' : 'tfng',
  }))
  return { unitId: `u999-g${i}`, module: 'l', at: T0 + i * DAY, score, total: 10, items, ...(i > 8 ? { duration: 300 } : {}) }
})
const wholeReading = (scores: number[]): Rec[] =>
  scores.map((score, i) => ({ unitId: `t99${i}-r`, module: 'r', at: T0 + i * DAY, score, total: 40, items: [] }))

const seed = async (page: Page, records: Rec[]) => {
  await page.addInitScript(
    ([key, recs]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key as string, JSON.stringify({ progress: {}, records: recs, favorites: {}, dismissed: {} }))
        sessionStorage.setItem('seeded', '1')
      }
    },
    [KEY, records] as const,
  )
}

test.describe('021 进步曲线', () => {
  test('学习进度页：数字行、每次正确率、提示、数据表、题型条、空状态', async ({ page }) => {
    await seed(page, listening)
    await page.goto(`${BASE}/me/progress`)
    const l = page.getByTestId('progress-listening')
    await expect(l.getByTestId('progress-kpis')).toContainText('12 次')
    await expect(l.getByTestId('progress-delta')).toHaveText(/^↑ \+\d+%$/)
    await expect(l.getByTestId('progress-kpis')).toContainText('平均每题用时')

    const chart = l.getByTestId('chart-accuracy')
    await expect(chart.getByTestId('chart-point')).toHaveCount(12)
    await chart.getByTestId('chart-point').first().focus()
    await expect(chart.getByTestId('chart-tip')).toContainText('答对 2 / 10')
    await page.keyboard.press('ArrowRight')
    await expect(chart.getByTestId('chart-tip')).toContainText('10月2日')
    await chart.getByRole('button', { name: '查看数据表' }).click()
    await expect(chart.locator('tbody tr')).toHaveCount(12)

    // 题型：判断最弱，排在第一
    await expect(l.getByTestId('type-bar').first()).toContainText('判断')
    await expect(l.getByText('判断最弱，去练没做过的')).toBeVisible()

    // 没有阅读记录：空状态，没有整套 Band
    await expect(page.getByTestId('progress-reading')).toContainText('还没有交过阅读卷')
    await expect(page.getByTestId('chart-band')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('整套阅读 ≥ 2 次画 Band 折线；只有 1 次只显示数字', async ({ browser }) => {
    const a = await (await browser.newContext()).newPage()
    await seed(a, wholeReading([25, 29, 33]))
    await a.goto(`${BASE}/me/progress`)
    const r = a.getByTestId('progress-reading')
    await expect(r.getByTestId('chart-band').getByTestId('chart-point')).toHaveCount(3)
    await expect(r.getByTestId('progress-kpis')).toContainText('最近整套 Band7.5')

    const b = await (await browser.newContext()).newPage()
    await seed(b, wholeReading([30]))
    await b.goto(`${BASE}/me/progress`)
    await expect(b.getByTestId('progress-reading').getByTestId('progress-kpis')).toContainText('最近整套 Band7')
    await expect(b.getByTestId('chart-band')).toHaveCount(0)
  })

  test('栏目页顶部显示本科进步，可收起并记住；没记录的科不显示', async ({ page }) => {
    await seed(page, listening)
    await page.goto(`${BASE}/listening`)
    const panel = page.getByTestId('progress-listening')
    await expect(panel.getByTestId('chart-accuracy')).toBeVisible()
    await panel.getByTestId('progress-fold').click()
    await expect(panel.getByTestId('chart-accuracy')).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('progress-fold')).toHaveAttribute('aria-expanded', 'false')

    await page.goto(`${BASE}/reading`)
    await expect(page.getByRole('heading', { level: 1, name: '阅读' })).toBeVisible()
    await expect(page.getByTestId('progress-reading')).toHaveCount(0)
  })

  test('触屏：在图上点一下就显示最近一次的提示（audit P2）', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await seed(page, listening)
    await page.goto(`${BASE}/me/progress`)
    const chart = page.getByTestId('progress-listening').getByTestId('chart-accuracy')
    const box = (await chart.locator('svg[role="group"]').boundingBox())!
    // 点在两点之间的空白处（不是点本身），也应吸附到最近的一次
    await page.touchscreen.tap(box.x + box.width * 0.47, box.y + box.height * 0.5)
    await expect(chart.getByTestId('chart-tip')).toBeVisible()
    await ctx.close()
  })

  test('手机宽度不横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await seed(page, [...listening, ...wholeReading([25, 29, 33])])
    for (const path of ['/me/progress', '/listening']) {
      await page.goto(`${BASE}${path}`)
      await expect(page.getByTestId('chart-accuracy').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
})
