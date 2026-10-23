import { expect, test, type Page } from '@playwright/test'

// 030 栏目随机抽题：抽中的题一定在当前栏目 + 标签页 + 筛选的范围里；优先没做过；再抽一题；返回列表保留筛选。
// 用本机已导入的题库（只读），"做过"直接写进本机记录，不改数据库
const BASE = 'http://localhost:3000'
const KEY = 'ybz:practice:v1'

/** 打开栏目页并等本机记录读完（"已做 / 未做"筛选依赖记录） */
const openColumn = async (page: Page, url: string) => {
  await page.goto(url)
  await expect(page.locator('#practice-list[data-records-ready]')).toBeAttached()
}

/** 列表所有页的行入口（第一个操作的链接，去掉参数）——这就是抽题范围的标准答案 */
const scopeHrefs = async (page: Page, url: string) => {
  const hrefs: string[] = []
  for (let n = 1, pages = 1; n <= pages; n++) {
    await openColumn(page, `${url}${url.includes('?') ? '&' : '?'}page=${n}`)
    const pager = page.getByTestId('pager')
    if (await pager.count()) pages = Number(/\/ (\d+) 页/.exec((await pager.textContent())!)![1])
    hrefs.push(
      ...(await page
        .getByTestId('practice-row')
        .evaluateAll((rows) =>
          rows.map((r) => r.querySelector<HTMLAnchorElement>('a[href^="/practice/"], a[href^="/writing/"]')?.getAttribute('href') ?? ''),
        )),
    )
  }
  return hrefs.map((h) => h.split('?')[0])
}

/** 点"随机一题"，返回落到的页面路径和 pick */
const drawOnce = async (page: Page, columnUrl: string) => {
  await page.goto(columnUrl)
  const btn = page.getByTestId('pick-random')
  await expect(btn).toBeEnabled()
  await btn.click()
  await page.waitForURL((u) => /^\/(practice|writing)\//.test(u.pathname))
  const u = new URL(page.url())
  return { path: u.pathname, pick: u.searchParams.get('pick') }
}

const seedDone = async (page: Page, unitIds: string[]) => {
  await page.evaluate(
    ([key, ids]) => {
      const s = JSON.parse(localStorage.getItem(key as string) ?? 'null') ?? { progress: {}, records: [], favorites: {}, dismissed: {}, dictation: {}, mocks: {} }
      for (const id of ids as string[]) s.records.push({ unitId: id, at: Date.now(), score: 1, total: 1, items: [] })
      localStorage.setItem(key as string, JSON.stringify(s))
    },
    [KEY, unitIds] as const,
  )
}

test.describe('030 栏目随机抽题', () => {
  test('阅读按题型（判断）：抽 50 次都在当前范围里，网址带 pick', async ({ page }) => {
    test.setTimeout(300_000)
    const url = `${BASE}/reading?${new URLSearchParams({ type: '判断' })}`
    const scope = new Set(await scopeHrefs(page, url))
    expect(scope.size).toBeGreaterThan(0)
    for (let i = 0; i < 50; i++) {
      const { path, pick } = await drawOnce(page, url)
      expect(scope.has(path)).toBe(true)
      expect(pick).toBe(`/reading?${new URLSearchParams({ type: '判断' })}`)
    }
  })

  test('听力按 Part：抽 50 次都是 Part 1 的题组', async ({ page }) => {
    test.setTimeout(300_000)
    const url = `${BASE}/listening?${new URLSearchParams({ tab: 'part', part: 'Part 1' })}`
    const scope = new Set(await scopeHrefs(page, url))
    for (let i = 0; i < 50; i++) expect(scope.has((await drawOnce(page, url)).path)).toBe(true)
  })

  test('整篇练、写作分类：抽中的在范围里；写作页有再抽一题和返回列表', async ({ page }) => {
    const unitUrl = `${BASE}/reading?${new URLSearchParams({ tab: 'unit', part: 'Passage 3' })}`
    const units = new Set(await scopeHrefs(page, unitUrl))
    for (let i = 0; i < 5; i++) expect(units.has((await drawOnce(page, unitUrl)).path)).toBe(true)

    await page.goto(`${BASE}/writing?tab=t2`)
    const cat = page.getByRole('group', { name: '分类' }).getByRole('button').nth(1)
    const label = (await cat.textContent())!.trim()
    const writingUrl = `${BASE}/writing?${new URLSearchParams({ tab: 't2', category: label })}`
    const tasks = new Set(await scopeHrefs(page, writingUrl))
    const { path, pick } = await drawOnce(page, writingUrl)
    expect(tasks.has(path)).toBe(true)
    await expect(page.getByTestId('pick-again')).toHaveAttribute('href', `${pick}&draw=1`)
    await expect(page.getByRole('link', { name: '返回列表' })).toHaveAttribute('href', pick!)
  })

  test('优先没做过的；全做过时提示并照常抽', async ({ page }) => {
    const url = `${BASE}/reading?${new URLSearchParams({ tab: 'unit', part: 'Passage 1' })}`
    const ids = (await scopeHrefs(page, url)).map((h) => h.replace('/practice/', ''))
    expect(ids.length).toBeGreaterThan(1)
    const left = ids[ids.length - 1]
    await seedDone(page, ids.slice(0, -1))
    for (let i = 0; i < 5; i++) expect((await drawOnce(page, url)).path).toBe(`/practice/${left}`)

    await openColumn(page, url)
    await expect(page.getByTestId('pick-count')).toHaveText('从 1 个没做过的里抽')
    await seedDone(page, [left])
    await openColumn(page, url)
    await expect(page.getByTestId('pick-count')).toHaveText('这里的题都做过了，随机再练一道')
    expect(ids).toContain((await drawOnce(page, url)).path.replace('/practice/', ''))
  })

  test('写作草稿里写过字算做过：显示已做、可筛出、不再优先抽到', async ({ page }) => {
    await page.goto(`${BASE}/writing?tab=t2`)
    const cat = page.getByRole('group', { name: '分类' }).getByRole('button').nth(1)
    const url = `${BASE}/writing?${new URLSearchParams({ tab: 't2', category: (await cat.textContent())!.trim() })}`
    const ids = (await scopeHrefs(page, url)).map((h) => h.replace('/writing/', ''))
    expect(ids.length).toBeGreaterThan(1)
    const written = ids[0]
    await page.evaluate((id) => localStorage.setItem('ybz:writing:v1', JSON.stringify({ [id]: { text: 'Some people think', at: Date.now() } })), written)
    expect(await scopeHrefs(page, `${url}&status=${encodeURIComponent('已做')}`)).toEqual([`/writing/${written}`])
    for (let i = 0; i < 5; i++) expect((await drawOnce(page, url)).path).not.toBe(`/writing/${written}`)
  })

  test('交卷后再抽一题：换一道题；返回键回到上一题；返回列表保留筛选', async ({ page }) => {
    const url = `${BASE}/reading?${new URLSearchParams({ tab: 'unit', part: 'Passage 2' })}`
    const first = await drawOnce(page, url)
    await page.getByRole('button', { name: '交卷', exact: true }).click()
    const confirm = page.getByRole('button', { name: '仍然交卷' })
    if (await confirm.isVisible()) await confirm.click()
    await expect(page.getByTestId('result-bar')).toBeVisible()
    await expect(page.getByRole('link', { name: '返回列表' })).toHaveAttribute('href', first.pick!)

    await page.getByTestId('pick-again').click()
    await page.waitForURL((u) => u.pathname.startsWith('/practice/') && u.pathname !== first.path)
    expect(new URL(page.url()).searchParams.get('pick')).toBe(first.pick)
    await page.goBack()
    await page.waitForURL((u) => u.pathname === first.path)
  })

  test('空范围不可抽；越界的 pick 不生效', async ({ page }) => {
    await openColumn(page, `${BASE}/reading?${new URLSearchParams({ tab: 'unit', part: 'Passage 1', status: '已做' })}`)
    await expect(page.getByTestId('pick-count')).toHaveText('当前筛选下没有题')
    await expect(page.getByTestId('pick-random')).toBeDisabled()

    const { path } = await drawOnce(page, `${BASE}/writing?tab=t2`)
    await page.goto(`${BASE}${path}?pick=${encodeURIComponent('https://evil.com')}`)
    await expect(page.getByTestId('pick-again')).toHaveCount(0)
  })

  test('375px：栏目页和写作页不横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 })
    await page.goto(`${BASE}/reading`)
    await expect(page.getByTestId('pick-random')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await drawOnce(page, `${BASE}/writing`)
    await expect(page.getByTestId('pick-again')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
})
