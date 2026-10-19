import { expect, test, type Page } from '@playwright/test'

import type { LookupItem } from '../../src/endpoints/lookup'

// 009 错题本与收藏，都不登录（存本机，FR-035）。用本机已导入的阅读单元；没有时跳过
const BASE = 'http://localhost:3000'

const submitEmpty = async (page: Page, path: string) => {
  await page.goto(`${BASE}${path}`)
  await page.getByRole('button', { name: '交卷' }).click()
  await page.getByRole('button', { name: '交卷' }).last().click()
  await expect(page.getByRole('button', { name: '再做一遍' }).first()).toBeVisible()
}

/** 最新阅读单元里第一个全是填空题的题组，以及它的答案 */
const textGroup = async (page: Page) => {
  await page.goto(`${BASE}/practice/latest-r1`)
  test.skip(page.url().includes('empty=1'), '本机没有阅读单元')
  const unit = page.url().split('/practice/')[1]
  for (let g = 1; g <= 6; g++) {
    const id = `${unit}-g${g}`
    const res = await page.request.get(`${BASE}/api/practice/lookup?ids=${id}`)
    const item = ((await res.json()) as { items: Record<string, LookupItem> }).items[id]
    if (item.gone) break
    const qs = item.questions ?? []
    if (qs.length && qs.every((q) => ['completion', 'short_answer'].includes(q.type)))
      return { unit, id, answers: qs.map((q) => ({ n: q.number, a: q.answers.split('\n')[0].replace(/[()（）]/g, '').split('/')[0].trim() })) }
  }
  test.skip(true, '最新阅读单元里没有填空题组')
  throw new Error('unreachable')
}

test.describe('错题本', () => {
  test('交卷做错的题进错题本，可筛选，重做答对后移到已掌握', async ({ page }) => {
    const g = await textGroup(page)
    await submitEmpty(page, `/practice/${g.unit}`)

    await page.goto(`${BASE}/me/mistakes`)
    const rows = page.getByTestId('mistake-row')
    await expect(rows.first()).toBeVisible()
    const total = await rows.count()
    expect(total).toBeGreaterThan(0)

    // 栏目筛选：全是阅读题，选"听力"后为空
    await page.getByTestId('filter-module').getByRole('button', { name: /^听力/ }).click()
    await expect(rows).toHaveCount(0)
    await page.getByTestId('filter-module').getByRole('button', { name: /^阅读/ }).click()
    await expect(rows.first()).toBeVisible()

    // 题型筛选：选"填空"后每行都是填空
    const types = page.getByTestId('filter-type')
    if (await types.count()) {
      await types.getByRole('button', { name: /^填空/ }).click()
      for (const t of await rows.allTextContents()) expect(t).toContain('填空')
    }

    // 展开一行看到正确答案
    await rows.first().getByRole('button', { expanded: false }).click()
    await expect(rows.first().getByText('正确答案')).toBeVisible()

    // 重做那一组并全部答对
    await page.goto(`${BASE}/practice/${g.id}`)
    for (const { n, a } of g.answers) await page.getByRole('textbox', { name: `第 ${n} 题` }).fill(a)
    await page.getByRole('button', { name: '交卷' }).click()
    await expect(page.getByRole('button', { name: '再做一遍' }).first()).toBeVisible()

    await page.goto(`${BASE}/me/mistakes`)
    await expect(rows.first()).toBeVisible()
    for (const href of await rows.getByRole('link', { name: /重做/ }).evaluateAll((els) => els.map((e) => e.getAttribute('href'))))
      expect(href).not.toBe(`/practice/${g.id}`)
    await page.getByTestId('filter-state').getByRole('button', { name: /^已掌握/ }).click()
    await expect(rows.getByRole('link', { name: /重做/ }).first()).toHaveAttribute('href', `/practice/${g.id}`)
  })

  test('打印：按来源分块带原文摘录，题目区没有答案，最后是答案与解析（018）', async ({ page }) => {
    const g = await textGroup(page)
    await submitEmpty(page, `/practice/${g.unit}`)
    await page.goto(`${BASE}/me/mistakes`)
    await expect(page.getByTestId('mistake-row').first()).toBeVisible()

    // 调用 print 时 #print-sheet 还在，把内容存下来
    await page.evaluate(() => {
      const w = window as unknown as { __printed: string[]; __groups: string; print: () => void }
      w.__printed = []
      w.print = () => {
        const sheet = document.getElementById('print-sheet')
        w.__printed.push(sheet?.innerHTML ?? '')
        w.__groups = [...(sheet?.querySelectorAll('.print-group') ?? [])].map((el) => el.textContent).join(' ')
      }
    })
    await page.getByRole('button', { name: '打印' }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: string[] }).__printed.length)).toBe(1)
    const html = await page.evaluate(() => (window as unknown as { __printed: string[] }).__printed[0])
    expect(html).toContain('错题练习')
    expect(html).toContain('答案与解析')
    expect(html).toContain('<u>')

    // 题组（题目区，不含原文摘录）里不出现这组题的正确答案；填空答案取自原文，摘录里本来就有
    const groups = await page.evaluate(() => (window as unknown as { __groups: string }).__groups)
    expect(groups.length).toBeGreaterThan(0)
    for (const { a } of g.answers) if (a.length >= 3) expect(groups).not.toContain(a)
    expect(html.split('class="answers"')[1]).toContain(g.answers[0].a)

    // 打印完清理干净，按钮恢复
    await expect(page.locator('#print-sheet')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '打印' })).toBeEnabled()
  })

  test('打印版面：深色模式下也是白底黑字，网站界面不出现，答案另起一页（018）', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('payload-theme', 'dark'))
    const g = await textGroup(page)
    await submitEmpty(page, `/practice/${g.unit}`)
    await page.goto(`${BASE}/me/mistakes`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByTestId('mistake-row').first()).toBeVisible()

    // print 抛错时 #print-sheet 留在页面上，在 print 媒体下检查
    await page.evaluate(() => {
      window.print = () => {
        throw new Error('stop')
      }
    })
    await page.emulateMedia({ media: 'print' })
    await page.getByRole('button', { name: '打印' }).click()
    const sheet = page.locator('#print-sheet')
    await expect(sheet).toBeVisible()
    await expect(page.getByRole('banner')).toBeHidden()
    const style = await sheet.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { bg: cs.backgroundColor, color: cs.color, page: getComputedStyle(el.querySelector('.answers')!).breakBefore }
    })
    expect(style).toEqual({ bg: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 0)', page: 'page' })
    await page.emulateMedia({ media: 'screen' })
  })

  test('没有错题时显示空状态和练习入口', async ({ page }) => {
    await page.goto(`${BASE}/me/mistakes`)
    await expect(page.getByText('交卷后做错的题会出现在这里')).toBeVisible()
    await expect(page.getByText('登录后换设备也能看到')).toBeVisible()
  })
})

test.describe('收藏', () => {
  test('收藏单元、题目、写作题，在我的收藏里看到；取消后可撤销，刷新后消失', async ({ page }) => {
    // 栏目页：收藏第一行单元
    await page.goto(`${BASE}/reading`)
    const row = page.getByTestId('practice-row').first()
    test.skip(!(await row.getByTestId('fav-btn').count()), '本机没有阅读单元')
    await row.getByTestId('fav-btn').click()
    await expect(row.getByTestId('fav-btn')).toHaveAttribute('aria-pressed', 'true')

    // 练习页交卷后，在解析面板收藏当前题
    await submitEmpty(page, '/practice/latest-r1')
    const panelStar = page.getByTestId('explain-panel').getByTestId('fav-btn')
    await panelStar.click()
    await expect(panelStar).toHaveAttribute('aria-pressed', 'true')

    // 写作题页
    await page.goto(`${BASE}/writing`)
    const href = await page.getByTestId('practice-row').first().getByRole('link').first().getAttribute('href')
    test.skip(!href?.startsWith('/writing/'), '本机没有写作题')
    await page.goto(`${BASE}${href}`)
    await page.getByTestId('fav-btn').click()

    await page.goto(`${BASE}/me/favorites`)
    const rows = page.getByTestId('fav-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).not.toContainText('…')
    await page.getByRole('button', { name: /^题目/ }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(/第 \d+ 题/)

    // 取消：行还在、可撤销；撤销后恢复
    await page.getByRole('button', { name: /^整组/ }).click()
    await rows.first().getByTestId('fav-btn').click()
    await expect(rows.first().getByRole('button', { name: '撤销' })).toBeVisible()
    await rows.first().getByRole('button', { name: '撤销' }).click()
    await expect(rows.first().getByTestId('fav-btn')).toBeVisible()

    // 再取消后刷新：剩 1 个单元
    await rows.first().getByTestId('fav-btn').click()
    await page.reload()
    await expect(rows).toHaveCount(1)
  })
})
