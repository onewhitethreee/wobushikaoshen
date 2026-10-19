import { expect, test, type Page } from '@playwright/test'

import type { RadioItem } from '../../src/endpoints/playlist'

// 023 精听 / 听写：用本机最新的听力单元（不登录）；没有时跳过
const BASE = 'http://localhost:3000'

const records = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('ybz:practice:v1') ?? '{"records":[]}').records as unknown[]).length)

test.describe('023 精听 / 听写', () => {
  test('交卷前不能听写；交卷后逐句播放、比对、挖空，错句进错题本"听写"，不写交卷记录', async ({ browser }) => {
    test.setTimeout(120_000)
    const page = await (await browser.newContext()).newPage()
    await page.goto(`${BASE}/practice/latest-l1`)
    test.skip(page.url().includes('empty=1'), '本机没有听力单元')
    const unit = /\/practice\/(u\d+)/.exec(page.url())![1]

    // 句子：与听写页同样的筛选（去掉开场播报、要有时间）
    const item = ((await (await page.request.get(`${BASE}/api/listening/playlist?start=${unit}`)).json()) as { items: RadioItem[] }).items[0]
    const lines = (item.lines ?? []).filter((l) => !l.announce && typeof l.start === 'number' && l.text.trim()).sort((a, b) => a.start! - b.start!)
    test.skip(lines.length < 3, '没有逐句时间')

    // 交卷前
    await page.goto(`${BASE}/listening/dictation?u=${unit}`)
    await expect(page.getByTestId('dict-gate')).toBeVisible()

    // 空交卷 → 入口出现
    await page.goto(`${BASE}/practice/${unit}`)
    await page.getByRole('button', { name: '交卷', exact: true }).click()
    const confirm = page.getByRole('button', { name: '仍然交卷' })
    if (await confirm.isVisible()) await confirm.click()
    await expect(page.getByTestId('dictation-link')).toHaveAttribute('href', `/listening/dictation?u=${unit}`)
    const before = await records(page)

    await page.getByTestId('dictation-link').click()
    await expect(page.getByTestId('dict-progress')).toContainText(`第 1 / ${lines.length} 句`)

    // 只播第 1 句，停在句尾
    await page.locator('audio').evaluate((a: HTMLAudioElement) => {
      a.muted = true
    })
    await page.getByTestId('dict-play').click()
    await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => !a.paused), { timeout: 10_000 }).toBe(true)
    await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => a.paused), { timeout: 30_000 }).toBe(true)
    const t = await page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)
    expect(Math.abs(t - lines[0].end!)).toBeLessThan(0.3)

    // 全大写、去掉标点 → 全对
    await page.getByTestId('dict-input').fill(lines[0].text.toUpperCase().replace(/[.,!?;:"]/g, ''))
    await page.getByTestId('dict-input').press('Enter')
    await expect(page.getByTestId('dict-ok')).toBeVisible()

    // 找一句 ≥ 6 个词的：删第 2 个词、改错第 4 个词
    const k = lines.findIndex((l, idx) => idx > 0 && l.text.split(/\s+/).length >= 6)
    test.skip(k < 0, '没有足够长的句子')
    const words = lines[k].text.split(/\s+/)
    await page.goto(`${BASE}/listening/dictation?u=${unit}&n=${lines[k].n}`)
    const typed = words.filter((_, idx) => idx !== 1).map((w, idx) => (idx === 2 ? 'zzzz' : w)).join(' ')
    await page.getByTestId('dict-input').fill(typed)
    await page.getByTestId('dict-check').click()
    await expect(page.getByTestId('dict-result').locator('[data-status="missing"]')).toHaveCount(1)
    await expect(page.getByTestId('dict-result').locator('[data-status="wrong"]')).toHaveCount(1)
    await expect(page.getByTestId('dict-ok')).toHaveCount(0)

    // 挖空：有空可填，按原词填 → 全对
    await page.getByTestId('dict-mode-blank').click()
    const blanks = page.getByTestId('dict-blank')
    await expect(blanks.first()).toBeVisible()
    const n = await blanks.count()
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(3)
    // 空在原句里的位置：按顺序收集挖掉的词
    const holes = await page.locator('p:has([data-testid="dict-blank"])').evaluate((p) => {
      const out: number[] = []
      let idx = 0
      for (const node of Array.from(p.childNodes)) {
        if (node.nodeType === 3) idx += (node.textContent ?? '').split(/\s+/).filter(Boolean).length
        else if ((node as HTMLElement).dataset?.testid === 'dict-blank') out.push(idx++)
      }
      return out
    })
    for (let b = 0; b < n; b++) await blanks.nth(b).fill(words[holes[b]])
    await page.getByTestId('dict-check').click()
    await expect(page.getByTestId('dict-ok')).toBeVisible()

    expect(await records(page)).toBe(before)

    // 错题本"听写"
    await page.goto(`${BASE}/me/mistakes`)
    await page.getByTestId('filter-module').getByRole('button', { name: /^听写/ }).click()
    const row = page.getByTestId('dict-row')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(lines[k].text)
    await expect(row.getByRole('link', { name: /再听写/ })).toHaveAttribute('href', `/listening/dictation?u=${unit}&n=${lines[k].n}`)
    await expect(page.getByRole('button', { name: '打印' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
