import { expect, test, type Page } from '@playwright/test'

// 024 备考计划（不登录，用本机数据）
const BASE = 'http://localhost:3000'
const DAY = 86_400_000
const ymd = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// 凌晨 4 点前跑测试时"今天"是前一天；测试取中午之后的一个确定时刻不现实，所以按页面同样的规则算
const studyNow = () => (new Date().getHours() < 4 ? Date.now() - DAY : Date.now())

const seed = (page: Page, practice: object, vocab?: object) =>
  page.addInitScript(
    ([p, v]) => {
      if (sessionStorage.getItem('seeded')) return
      localStorage.setItem('ybz:practice:v1', JSON.stringify(p))
      if (v) localStorage.setItem('ybz:vocab:v1', JSON.stringify(v))
      sessionStorage.setItem('seeded', '1')
    },
    [practice, vocab ?? null] as const,
  )

test.describe('024 备考计划', () => {
  test('设置计划 → 倒计时；早于今天报错；刷新仍在；清除回到表单', async ({ page }) => {
    await page.goto(BASE)
    const box = page.getByTestId('today-plan')
    await expect(box).toContainText('填上考试日期')

    await box.getByTestId('plan-date').fill(ymd(studyNow() - DAY))
    await box.getByTestId('plan-save').click()
    await expect(box.getByTestId('plan-error')).toHaveText('日期不能早于今天')

    await box.getByTestId('plan-date').fill(ymd(studyNow() + 30 * DAY))
    await box.getByTestId('plan-target').selectOption('7')
    await box.getByTestId('plan-save').click()
    await expect(box.getByTestId('plan-countdown')).toHaveText('距离考试还有 30 天 · 目标 7 分')
    await page.reload()
    await expect(page.getByTestId('plan-countdown')).toContainText('还有 30 天')

    await page.getByTestId('plan-edit').click()
    await page.getByTestId('plan-clear').click()
    await expect(page.getByTestId('today-plan')).toContainText('填上考试日期')
  })

  test('今日任务：已做数、优先题型、背单词、打卡日历', async ({ page }) => {
    const now = Date.now()
    const items = Array.from({ length: 10 }, (_, k) => ({ groupKey: 'u990001-g1', number: k + 1, correct: k < 5, type: k < 5 ? 'completion' : 'tfng' }))
    const card = { due: now - 1000, stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: now - 3 * DAY }
    await seed(
      page,
      {
        progress: {},
        records: [{ unitId: 'u990001-g1', module: 'l', at: now - 60_000, score: 5, total: 10, items }],
        favorites: {},
        dismissed: {},
        dictation: {},
        plan: { at: now, examDate: ymd(studyNow() + 30 * DAY), target: 7 },
      },
      { words: Object.fromEntries(['alpha', 'beta', 'gamma'].map((w) => [w, { at: now, on: true, added: now, card }])), vocab: { at: 0, newPerDay: 20, accent: 'gb' } },
    )
    await page.goto(BASE)
    const listening = page.getByTestId('task-listening')
    await expect(listening).toContainText('1 / ')
    await expect(listening).toContainText('优先 判断')
    expect(await listening.getByRole('link').getAttribute('href')).toContain(`type=${encodeURIComponent('判断')}`)
    await expect(page.getByTestId('task-reading')).toContainText('各题型都做')
    await expect(page.getByTestId('task-vocab')).toContainText('今天还有 3 个')

    const today = page.getByTestId('plan-calendar').locator('[data-today="true"]')
    await expect(today).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('plan-streak')).toHaveText('连续 1 天')
  })

  test('手机宽度不横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await seed(page, { progress: {}, records: [], favorites: {}, dismissed: {}, dictation: {}, plan: { at: 1, examDate: ymd(studyNow() + 10 * DAY), target: 6.5 } })
    await page.goto(BASE)
    await expect(page.getByTestId('plan-countdown')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
