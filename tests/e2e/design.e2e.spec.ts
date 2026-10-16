import { test, expect } from '@playwright/test'

// 002 前端视觉设计的验收用例。范围只限这 6 个路由；
// 模板原有的 /home、/posts、/search 的演示文案由 001 的模板清理任务处理。
const BASE = 'http://localhost:3000'
const ROUTES = ['/', '/listening', '/reading', '/writing', '/speaking', '/mock']
const DISCLAIMER = '题目整理自网络公开资料'

test.describe('全站', () => {
  for (const route of ROUTES) {
    test(`${route} 可访问、无商标、有声明`, async ({ page }) => {
      const res = await page.goto(BASE + route)
      expect(res?.status()).toBe(200)
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
      const html = await page.content()
      expect(html).not.toMatch(/ielts|剑雅|正版授权/i)
      await expect(page.getByText(DISCLAIMER)).toBeVisible()
    })

    test(`${route} 三种宽度无横向滚动`, async ({ page }) => {
      for (const [width, height] of [
        [375, 667],
        [768, 1024],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height })
        await page.goto(BASE + route)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(overflow, `${route} @ ${width}px`).toBeLessThanOrEqual(0)
      }
    })

    test(`${route} 只请求本站资源`, async ({ page }) => {
      const hosts = new Set<string>()
      page.on('request', (req) => {
        const url = new URL(req.url())
        if (url.protocol.startsWith('http')) hosts.add(url.hostname)
      })
      await page.goto(BASE + route, { waitUntil: 'networkidle' })
      expect([...hosts]).toEqual(['localhost'])
    })
  }
})

test.describe('首页', () => {
  test('首屏可直接开练，免费与额度可区分', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE + '/')

    const h1 = page.locator('h1')
    await expect(h1).toContainText('免费')
    await expect(h1).toContainText('不用注册')

    const start = page.getByRole('button', { name: /开始做题/ })
    for (const el of [h1, start]) {
      const box = await el.boundingBox()
      expect(box && box.y + box.height).toBeLessThanOrEqual(667)
    }

    const catalog = page.getByTestId('catalog')
    await expect(catalog.getByTestId('subject-听力')).toContainText('免费')
    await expect(catalog.getByTestId('subject-阅读')).toContainText('免费')
    await expect(catalog.getByTestId('subject-写作')).toContainText('额度')
    await expect(catalog.getByTestId('subject-口语')).toContainText('额度')

    const soon = page.getByText('即将开放', { exact: true })
    expect(await soon.evaluate((el) => el.closest('a,button'))).toBeNull()
    await expect(page.getByText('示例数据')).toHaveCount(0)

    await page.getByText('阅读 Passage 1', { exact: true }).click()
    await expect(page.getByLabel('阅读 Passage 1')).toBeChecked()
    // 有已发布的套题或练习单元就直接进练习页；都没有时落到栏目页并说明题库在准备
    await start.click()
    await expect(page).toHaveURL(/\/practice\/[tu]\d|\/reading/, { timeout: 30_000 })
    if (page.url().includes('/reading')) await expect(page.getByText('题库正在准备')).toBeVisible()
  })
})

test.describe('栏目页', () => {
  const count = async (page: import('@playwright/test').Page) =>
    Number((await page.getByTestId('result-count').innerText()).replace(/\D/g, ''))

  test('听力筛选、空状态与清除', async ({ page }) => {
    await page.goto(BASE + '/listening?demo=loggedin')
    const initial = await count(page)

    const map = page.getByRole('button', { name: '地图题', exact: true })
    await map.click()
    await expect(map).toHaveAttribute('aria-pressed', 'true')
    expect(await count(page)).toBeLessThan(initial)

    await page.getByRole('tab', { name: '按 Part 练' }).click()
    const partInitial = await count(page)
    await page.getByRole('button', { name: '已做', exact: true }).click()
    await page.getByRole('button', { name: 'Part 4', exact: true }).click()
    await expect(page.getByText('没有符合条件的题')).toBeVisible()
    await page.getByRole('button', { name: '清除筛选' }).click()
    expect(await count(page)).toBe(partInitial)

    await expect(page.getByText('未做').first()).toBeVisible()
    // 示例数据里的"已做"记录（导入真实题库后栏目不再显示示例数据）
    if (await page.getByText('示例数据').count()) await expect(page.getByText('再做一遍').first()).toBeVisible()
  })

  test('未登录也有状态筛选，本机无记录时正确率区显示引导', async ({ page }) => {
    await page.goto(BASE + '/listening')
    await expect(page.getByRole('button', { name: '已做', exact: true })).toBeVisible()
    await expect(page.locator('aside')).toContainText('做完一组题后')
    await expect(page.locator('aside')).not.toContainText('%')
  })

  test('练习入口给出即将上线说明，目录条目能定位', async ({ page }) => {
    await page.goto(BASE + '/listening?start=l1')
    // 示例条目 l1 只在示例数据下存在
    if (await page.getByText('示例数据').count())
      await expect(page.getByTestId('pending-notice')).toContainText('社区图书馆的会员新规')
    // 写作栏目导入真实题库后（007）不再显示示例数据，示例条目 w4 的定位只在示例数据下检查
    await page.goto(BASE + '/writing?focus=w4')
    if (await page.getByText('示例数据').count()) {
      await expect(page.getByRole('tab', { name: 'Task 2' })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByText('从这里开始')).toBeVisible()
    }
  })

  test('筛选写进网址，刷新后保留', async ({ page }) => {
    await page.goto(BASE + '/listening')
    await page.getByRole('button', { name: '地图题', exact: true }).click()
    await expect(page).toHaveURL(/type=/)
    await page.reload()
    await expect(page.getByRole('button', { name: '地图题', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('窄屏侧栏在列表下方', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE + '/listening')
    const main = await page.locator('main').boundingBox()
    const aside = await page.locator('aside').boundingBox()
    expect(aside!.y).toBeGreaterThan(main!.y)
  })

  test('阅读页有 Passage 标签', async ({ page }) => {
    await page.goto(BASE + '/reading')
    await page.getByRole('tab', { name: '按 Passage 练' }).click()
    await expect(page.getByRole('button', { name: 'Passage 1', exact: true })).toBeVisible()
  })

  test('写作、口语在点击前标明额度', async ({ page }) => {
    await page.goto(BASE + '/writing')
    const rows = page.getByTestId('practice-row')
    const n = await rows.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i)).toContainText('AI 批改')
      await expect(rows.nth(i)).toContainText('1 额度')
    }
    await expect(page.getByText('开始写').first()).toBeVisible()
    await expect(page.locator('aside')).toContainText('登录后查看额度')
    await expect(page.locator('aside')).not.toContainText('剩余')

    await page.goto(BASE + '/writing?demo=loggedin')
    await expect(page.locator('aside')).toContainText('剩余')
    await expect(page.locator('aside')).not.toContainText('示例')

    await page.goto(BASE + '/speaking')
    await expect(page.getByText('口语批改').first()).toBeVisible()
    await expect(page.getByText('1 额度').first()).toBeVisible()
  })

  test('成绩记录画成图形（005 US6）', async ({ page }) => {
    // 写作的批改记录只存在于示例数据（007 导入真实题库后跳过这一段）
    await page.goto(BASE + '/writing')
    if (await page.getByText('示例数据').count()) {
      const graded = page.getByTestId('practice-row').filter({ has: page.getByTestId('band-gauge') })
      await expect(graded).toHaveCount(1)
      await expect(graded.getByTestId('band-gauge')).toHaveAttribute('aria-label', /已批改 6\.5/)
      // 没有分数的状态仍是文字（在 Task 2 标签下）
      await page.getByRole('tab', { name: 'Task 2' }).click()
      await expect(page.getByText('已写 · 未批改')).toBeVisible()
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(BASE + '/mock')
    await expect(page.getByTestId('practice-row').first().getByTestId('band-gauge')).toHaveCount(2)

    await page.goto(BASE + '/listening')
    // 正确率圆环来自示例数据的做题记录
    if (await page.getByText('示例数据').count()) await expect(page.getByTestId('ratio-ring').first()).toBeVisible()
  })

  test('模考在手机上提示用电脑', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE + '/mock')
    for (const link of await page.getByRole('link', { name: '进入模考' }).all()) {
      await expect(link).toBeHidden()
    }
    await expect(page.getByText('请用电脑打开').first()).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(BASE + '/mock')
    await expect(page.getByRole('link', { name: '进入模考' }).first()).toBeVisible()
  })
})

test.describe('深色模式', () => {
  test('浅色背景为暖纸色', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('payload-theme', 'light'))
    await page.goto(BASE + '/listening')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(252, 247, 236)')
  })

  test('选择深色后刷新仍为深色', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('payload-theme', 'dark'))
    await page.goto(BASE + '/listening')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(19, 17, 14)',
    )
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('禁用 JS 时内容可见', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(BASE + '/')
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).opacity)).toBe('1')
    await context.close()
  })
})

// 005：标题改用系统字体，页面不再下载任何网络字体（SC-006）
test.describe('字体', () => {
  for (const route of ['/', '/listening']) {
    test(`${route} 不请求网络字体`, async ({ page }) => {
      const fonts: string[] = []
      page.on('request', (req) => {
        if (/\.(woff2?|ttf|otf)(\?|$)/.test(req.url())) fonts.push(req.url())
      })
      await page.goto(BASE + route, { waitUntil: 'networkidle' })
      expect(fonts).toEqual([])
    })
  }
})

// 005 动效：单段入场 ≤ 0.6 秒；系统开启减少动效时没有进行中的动画（FR-010、FR-013）
test.describe('动效', () => {
  test('入场动效时长受控', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    const durations = await page.evaluate(() =>
      document.getAnimations().map((a) => Number((a.effect?.getTiming().duration as number) ?? 0)),
    )
    for (const d of durations) expect(d).toBeLessThanOrEqual(1000)
    const entrances = await page.locator('.animate-rise').evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).animationDuration)),
    )
    expect(entrances.length).toBeGreaterThan(0)
    for (const d of entrances) expect(d).toBeLessThanOrEqual(0.6)
  })

  for (const route of ['/', '/listening']) {
    test(`${route} 减少动效时无进行中的动画`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(BASE + route, { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)
      expect(running).toBe(0)
    })
  }
})
