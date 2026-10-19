import { expect, test, type Page } from '@playwright/test'

import type { RadioItem } from '../../src/endpoints/playlist'

// 022 听力磨耳朵：用本机已导入的听力单元；没有时跳过
const BASE = 'http://localhost:3000'

// 记下页面注册的 Media Session 处理函数，测试里直接调用（相当于点锁屏按钮）
const recordHandlers = (page: Page) =>
  page.addInitScript(`
    window.__ms = {}
    if (navigator.mediaSession) {
      const orig = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
      navigator.mediaSession.setActionHandler = (a, h) => { window.__ms[a] = h; try { orig(a, h) } catch {} }
    }
  `)

const audio = (page: Page) => page.locator('[data-testid="audio-player"] audio')

const firstUnit = async (page: Page) => {
  await page.goto(`${BASE}/practice/latest-l1`)
  test.skip(page.url().includes('empty=1'), '本机没有听力单元')
  return /\/practice\/(u\d+)/.exec(page.url())![1]
}

test.describe('022 磨耳朵', () => {
  test('锁屏控制、下一句、播完自动接下一个、原文默认隐藏、不写交卷记录', async ({ page }) => {
    test.setTimeout(90_000)
    await recordHandlers(page)
    const unit = await firstUnit(page)
    await expect(page.getByTestId('radio-link')).toHaveAttribute('href', `/listening/play?start=${unit}`)
    const records = await page.evaluate(() => JSON.parse(localStorage.getItem('ybz:practice:v1') ?? '{"records":[]}').records.length as number)

    const list = (await (await page.request.get(`${BASE}/api/listening/playlist?start=${unit}`)).json()) as { items: RadioItem[] }
    test.skip(list.items.length < 2, '题集里只有一个 Part')
    const [first, second] = list.items

    await page.goto(`${BASE}/listening/play?start=${unit}`)
    await expect(page.getByTestId('radio-now')).toContainText(first.title)
    await expect(page.getByTestId('radio-transcript')).toHaveCount(0)
    await page.getByTestId('radio-transcript-toggle').click()
    await expect(page.getByTestId('radio-transcript')).toBeVisible()

    await audio(page).evaluate((a: HTMLAudioElement) => {
      a.muted = true
    })
    await page.getByRole('button', { name: '播放' }).click()
    await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe(first.title)

    // 锁屏"下一曲" = 下一句
    const timed = first.lines!.filter((l) => typeof l.start === 'number').sort((a, b) => a.start! - b.start!)
    await page.evaluate(() => (window as unknown as { __ms: Record<string, (d: object) => void> }).__ms.pause({}))
    await audio(page).evaluate((a: HTMLAudioElement) => {
      a.currentTime = 0
    })
    await page.evaluate(() => (window as unknown as { __ms: Record<string, (d: object) => void> }).__ms.nexttrack({}))
    await expect.poll(() => audio(page).evaluate((a: HTMLAudioElement) => a.currentTime)).toBeCloseTo(timed[0].start!, 0)
    expect(await audio(page).evaluate((a: HTMLAudioElement) => a.paused)).toBe(true)

    // 播到结尾自动接下一个并继续播放
    await audio(page).evaluate(async (a: HTMLAudioElement) => {
      a.currentTime = Math.max(0, a.duration - 0.5)
      await a.play()
    })
    await expect(page.getByTestId('radio-now')).toContainText(second.title, { timeout: 15_000 })
    await expect.poll(() => audio(page).evaluate((a: HTMLAudioElement, url: string) => !a.paused && a.src.endsWith(url), second.audioUrl)).toBe(true)

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ybz:practice:v1') ?? '{"records":[]}').records.length as number)
    expect(after).toBe(records)
  })

  test('栏目页入口；手机宽度不横向滚动', async ({ page }) => {
    await page.goto(`${BASE}/listening`)
    await expect(page.getByTestId('radio-entry')).toHaveAttribute('href', '/listening/play')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByTestId('radio-entry').click()
    await expect(page.getByTestId('radio-now')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
