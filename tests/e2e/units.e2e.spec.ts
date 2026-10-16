import { expect, test, type Locator, type Page } from '@playwright/test'
import { createLocalReq, getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { importPackage } from '../../src/import/importPackage'

// 007 题库导入的前台验收。数据全部在测试里现造（原创短题），测完删除；不依赖 out/ 里的题
const BASE = 'http://localhost:3000'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

// 25 道 Task 2（保证超过一页）+ 1 道 Task 1 地图题（带图）
const writing = [
  {
    taskType: 'task1',
    category: 'map',
    title: 'E2E Harbour Changes',
    titleZh: '测试用港口变化',
    prompt: 'The maps show a harbour in 1990 and now.\nSummarise the information.',
    image: 'img/e2e-w-map.png',
    sourceType: 'original',
    sourceId: 'e2e-w-map',
  },
  ...Array.from({ length: 25 }, (_, i) => ({
    taskType: 'task2',
    category: 'opinion',
    title: `E2E Opinion ${i + 1}`,
    prompt: `Some people think test topic ${i + 1} matters. To what extent do you agree?`,
    sourceType: 'original',
    sourceId: `e2e-w-${i + 1}`,
  })),
]
const ids = writing.map((w) => w.sourceId)

// 一个 MPEG-1 Layer III 帧头 + 静音数据，足够让上传识别为 audio/mpeg
const MP3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(413), Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(413)])

/** 本机库里有真实题目时测试数据可能不在第一页：逐页翻到出现为止 */
const findOnPages = async (page: Page, target: Locator) => {
  for (let i = 0; i < 40 && !(await target.count()); i++) {
    const next = page.getByRole('button', { name: '下一页 →' })
    if (!(await next.count()) || !(await next.isEnabled())) break
    await next.click()
  }
  await expect(target).toHaveCount(1)
}

// 测试音频只是占位字节、不能真正播放：替换 audio 元素的时间与播放状态，设 currentTime 时派发 timeupdate（004）
// 用字符串脚本：测试经 tsx 编译时，传给 evaluate 的函数会被插入浏览器里不存在的 __name
const fakeAudio = (page: Page) =>
  page.evaluate(`(() => {
    const a = document.querySelector('audio')
    let t = 0
    let paused = true
    Object.defineProperty(a, 'currentTime', { configurable: true, get: () => t, set: (v) => { t = v; a.dispatchEvent(new Event('timeupdate')) } })
    Object.defineProperty(a, 'duration', { configurable: true, get: () => 60 })
    Object.defineProperty(a, 'paused', { configurable: true, get: () => paused })
    a.play = async () => { paused = false; a.dispatchEvent(new Event('play')) }
    a.pause = () => { paused = true; a.dispatchEvent(new Event('pause')) }
  })()`)
const audioAt = (page: Page, t: number) => page.locator('audio').evaluate((a: HTMLAudioElement, v) => (a.currentTime = v), t)
const audioNow = (page: Page) => page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)
const audioPaused = (page: Page) => page.locator('audio').evaluate((a: HTMLAudioElement) => a.paused)

const withPayload = async <T>(fn: (p: Awaited<ReturnType<typeof getPayload>>) => Promise<T>) =>
  fn(await getPayload({ config }))

const cleanup = () =>
  withPayload(async (payload) => {
    await payload.delete({ collection: 'writing-tasks', where: { sourceId: { in: ids } } })
    await payload.delete({ collection: 'media', where: { alt: { equals: 'img/e2e-w-map.png' } } })
  })

let mapId = 0

test.describe('写作题库', () => {
  test.beforeAll(async () => {
    await cleanup()
    await withPayload(async (payload) => {
      const req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
      const r = await importPackage(req, JSON.stringify({ kind: 'writing', publish: true, data: writing }), async (p) =>
        p === 'img/e2e-w-map.png' ? { data: PNG, size: PNG.length } : null,
      )
      if (!r.body.ok) throw new Error(r.body.errors.join('\n'))
      mapId = Number(r.body.created.find((c) => c.label === 'E2E Harbour Changes')!.id)
    })
  })
  test.afterAll(cleanup)

  test('栏目显示真实题目，可按分类筛选、翻页', async ({ page }) => {
    await page.goto(BASE + '/writing?tab=t2')
    await expect(page.getByText('示例数据')).toHaveCount(0)
    await expect(page.getByTestId('pager')).toContainText('第 1 /')
    await page.getByRole('button', { name: '下一页 →' }).click()
    await expect(page.getByTestId('pager')).toContainText('第 2 /')
    await expect(page).toHaveURL(/page=2/)

    await page.getByRole('tab', { name: 'Task 1' }).click()
    await page.getByRole('group', { name: '分类' }).getByRole('button', { name: '地图', exact: true }).click()
    const rows = page.getByTestId('practice-row')
    await expect(rows.filter({ hasText: 'E2E Harbour Changes' })).toHaveCount(1)
    for (const text of await rows.allInnerTexts()) expect(text).toContain('地图')
  })

  test('写作页：题目、配图、字数、草稿自动保存', async ({ page }) => {
    await page.goto(`${BASE}/writing/${mapId}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Harbour Changes')
    await expect(page.getByText('测试用港口变化').first()).toBeVisible()
    await expect(page.getByRole('img', { name: 'E2E Harbour Changes 配图' })).toBeVisible()
    await expect(page.getByTestId('word-count')).toContainText('还差 150 词')

    await page.getByLabel('在这里写').fill('The harbour has changed a lot over the years.')
    await expect(page.getByTestId('word-count')).toContainText('9 词')
    await expect(page.getByText('已保存', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('在这里写')).toHaveValue('The harbour has changed a lot over the years.')
  })

  test('写作页 375px 无横向滚动；不存在的题 404', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/writing/${mapId}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    const res = await page.goto(`${BASE}/writing/999999999`)
    expect(res?.status()).toBe(404)
  })
})

// 阅读单元：两篇原创短文，标签不同（题集筛选才会出现）
const readingUnit = (n: number, tag: string) => ({
  module: 'reading',
  part: 1,
  title: `E2E Bees ${n}`,
  sourceType: 'original',
  sourceId: `e2e-r-${n}`,
  sourceTag: tag,
  passage: [
    { label: 'A', sentences: [{ n: 0, text: 'Honey bees tell each other where flowers are by dancing.' }, { n: 1, text: 'The dance shows both direction and distance.' }] },
    { label: 'B', sentences: [{ n: 2, text: 'A single hive can visit millions of flowers in a day.' }] },
  ],
  groups: [
    {
      type: 'tfng',
      instructions: 'Do the following statements agree with the information given in the passage?',
      questions: [{ number: 1, prompt: 'Bees dance to share the location of flowers.', answers: 'TRUE', explanation: 'A 段**第一句**。', tip: 'dancing 对应 dance。', evidence: '0', answerStatus: 'auto' }],
    },
    {
      type: 'matching_information',
      instructions: 'Which paragraph contains the following information?',
      questions: [{ number: 2, prompt: 'how many flowers one hive visits', answers: 'B', evidence: '2', answerStatus: 'auto' }],
    },
    {
      type: 'completion',
      instructions: 'Complete the sentence. Choose ONE WORD ONLY from the passage.',
      maxWords: 1,
      content: 'The dance shows direction and {{3}}.',
      questions: [{ number: 3, answers: 'distance', evidence: '1', answerStatus: 'auto' }],
    },
  ],
})
const readingUnits = [readingUnit(1, '增补'), readingUnit(2, '9月高频')]

test.describe('阅读单元', () => {
  let unitId = 0
  const clean = () => withPayload((payload) => payload.delete({ collection: 'units', where: { sourceId: { in: readingUnits.map((u) => u.sourceId) } } }))

  test.beforeAll(async () => {
    await clean()
    await withPayload(async (payload) => {
      const req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
      const r = await importPackage(req, JSON.stringify({ kind: 'unit', publish: true, data: readingUnits }), async () => null)
      if (!r.body.ok) throw new Error(r.body.errors.join('\n'))
      unitId = Number(r.body.created.find((c) => c.label.includes('E2E Bees 1'))!.id)
    })
  })
  test.afterAll(clean)

  test('导入时自动生成栏目用的题组摘要', async () => {
    const doc = await withPayload((payload) => payload.findByID({ collection: 'units', id: unitId, depth: 0 }))
    expect(doc.summary).toEqual([
      { type: 'tfng', count: 1, range: '1' },
      { type: 'matching_information', count: 1, range: '2' },
      { type: 'completion', count: 1, range: '3' },
    ])
  })

  test('栏目：按题型 + 题集筛选，有整篇练', async ({ page }) => {
    await page.goto(BASE + '/reading?tab=type')
    await page.getByRole('group', { name: '题型' }).getByRole('button', { name: '信息匹配', exact: true }).click()
    await page.getByRole('group', { name: '题集' }).getByRole('button', { name: '增补', exact: true }).click()
    const rows = page.getByTestId('practice-row')
    await findOnPages(page, rows.filter({ hasText: 'E2E Bees 1' }))
    for (const text of await rows.allInnerTexts()) expect(text).not.toContain('E2E Bees 2')
    await page.getByRole('tab', { name: '整篇练' }).click()
    await findOnPages(page, page.locator(`a[href="/practice/u${unitId}"]`))
    expect(await page.content()).not.toMatch(/Z家|D家/)
  })

  test('做一篇：判分、字数超限判错、按句定位、易错点', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Bees 1 · Passage 1')
    await page.getByRole('radio', { name: 'TRUE', exact: true }).click()
    await page.getByRole('textbox', { name: '第 3 题' }).fill('the distance')
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('button', { name: '交卷' }).last().click() // 还有未答题时的确认
    // 题目下只有一行结果，解析在面板里（008 FR-001）
    await expect(page.getByTestId('feedback-1')).toContainText('正确')
    await expect(page.getByTestId('feedback-1')).not.toContainText('易错点')
    await expect(page.getByLabel('错误').first()).toBeVisible() // 第 3 题超过 ONE WORD
    const panel = page.getByTestId('explain-panel')
    await page.getByTestId('feedback-1').click()
    await expect(panel).toContainText('易错点')
    await page.getByTestId('feedback-2').click()
    await panel.getByRole('button', { name: '在原文中定位' }).click()
    await expect(page.locator('#s2')).toHaveAttribute('data-highlight', 'true')
    await expect(page.locator('#s0')).not.toHaveAttribute('data-highlight', 'true')
    // 正文里的填空题也能定位
    await page.getByTestId('feedback-3').click()
    await panel.getByRole('button', { name: '在原文中定位' }).click()
    await expect(page.locator('#s1')).toHaveAttribute('data-highlight', 'true')
    expect(await page.content()).not.toMatch(/Z家|D家/)
  })

  test('focus + 已做筛选：落在目标所在页（008 US3）', async ({ page, browser }) => {
    test.setTimeout(90_000)
    // 期望页码：没有记录时"全部"列表里目标所在页（所有阅读单元都记为已做后，"已做"列表顺序与之相同）
    const clean = await browser.newPage()
    await clean.goto(`${BASE}/reading?tab=unit`)
    await expect(clean.getByRole('tab', { name: '整篇练' })).toHaveAttribute('aria-selected', 'true')
    await findOnPages(clean, clean.locator(`a[href="/practice/u${unitId}"]`))
    const expected = new URL(clean.url()).searchParams.get('page') ?? '1'
    await clean.close()

    const ids = await withPayload(async (payload) =>
      (await payload.find({ collection: 'units', where: { module: { equals: 'reading' } }, limit: 0, pagination: false, depth: 0 })).docs.map((d) => `u${d.id}`),
    )
    const store = { progress: {}, records: ids.map((unitId) => ({ unitId, at: 0, score: 1, total: 1, items: [] })) }
    await page.addInitScript((v) => localStorage.setItem('ybz:practice:v1', v), JSON.stringify(store))

    await page.goto(`${BASE}/reading?status=${encodeURIComponent('已做')}&focus=u${unitId}`)
    await expect(page.locator(`a[href="/practice/u${unitId}"]`)).toBeInViewport()
    expect(new URL(page.url()).searchParams.get('page') ?? '1').toBe(expected)

    // 不在筛选结果里：第 1 页，不报错
    await page.goto(`${BASE}/reading?status=${encodeURIComponent('未做')}&focus=u${unitId}`)
    await expect(page.getByText(/第 1 \/ \d+ 页|还没有/).first()).toBeVisible()
    await expect(page.locator(`a[href="/practice/u${unitId}"]`)).toHaveCount(0)
    expect(new URL(page.url()).searchParams.get('page')).toBeNull()
  })

  test('解析面板翻页（电脑）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    await page.getByRole('radio', { name: 'TRUE', exact: true }).click()
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('button', { name: '交卷' }).last().click()
    const panel = page.getByTestId('explain-panel')
    // 交卷后停在第一道错题（第 2 题），它没有解析
    await expect(panel).toHaveAttribute('aria-label', '第 2 题解析')
    await expect(panel).toContainText('这道题暂无解析')
    await panel.getByRole('button', { name: '下一题' }).click()
    await expect(panel).toHaveAttribute('aria-label', '第 3 题解析')
    await expect(panel.getByRole('button', { name: '下一题' })).toBeDisabled()
    await page.getByRole('navigation', { name: '题号' }).getByRole('button', { name: /第 1 题/ }).click()
    await expect(panel).toHaveAttribute('aria-label', '第 1 题解析')
    await expect(panel.getByRole('button', { name: '上一题' })).toBeDisabled()
    await expect(panel).toContainText('A 段第一句。')
    await expect(panel.locator('b', { hasText: '第一句' })).toBeVisible() // **…** 显示为粗体
    await expect(page.locator('#s0')).toHaveAttribute('data-highlight', 'true') // 翻到哪题，原文自动定位到哪句
    await panel.getByRole('button', { name: '收起' }).click()
    await expect(panel.getByText('A 段第一句。')).toBeHidden()
    await panel.getByRole('button', { name: '展开' }).click()
    await page.getByRole('button', { name: '再做一遍' }).click()
    await expect(panel).toHaveCount(0)
  })

  test('解析面板（手机）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('button', { name: '交卷' }).last().click()
    const panel = page.getByTestId('explain-panel')
    await expect(panel).toBeHidden()
    await page.getByRole('button', { name: '题目', exact: true }).click()
    await page.getByTestId('feedback-2').click()
    await expect(panel).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await panel.getByRole('button', { name: '在原文中定位' }).click()
    await expect(panel).toBeHidden()
    await expect(page.getByTestId('passage-pane')).toBeVisible()
    await expect(page.locator('#s2')).toHaveAttribute('data-highlight', 'true')
    await page.getByRole('button', { name: '题目', exact: true }).click()
    await page.getByTestId('feedback-2').click()
    await expect(panel).toHaveAttribute('aria-label', '第 2 题解析')
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(page.getByTestId('feedback-2')).toBeFocused()
  })
})

// 听力单元：原创短对话 + 自制地图；音频用占位字节（只验证 src 可访问）
const listeningUnit = {
  module: 'listening',
  part: 2,
  title: 'E2E Town Walk',
  sourceType: 'original',
  sourceId: 'e2e-l-1',
  sourceTag: '全年高频',
  audio: 'audio/e2e-l-1.mp3',
  transcript: [
    { n: 0, speaker: 'Speaker 0', start: 0, end: 1, text: 'Part two.', announce: true },
    { n: 1, speaker: 'Speaker 0', start: 1, end: 3, text: 'You will hear a guide talking about the town.', announce: true },
    { n: 2, speaker: 'Speaker 1', start: 3, end: 6, text: 'The bank is directly opposite the station.' },
    { n: 3, speaker: 'Speaker 1', start: 6, end: 9, text: 'The museum opens at nine every morning.' },
    { n: 4, speaker: 'Speaker 0', start: 9, end: 10, text: 'That is the end of part two.', announce: true },
  ],
  groups: [
    {
      type: 'labelling',
      instructions: 'Label the map below. Write the correct letter, A-C.',
      image: 'img/e2e-l-map.png',
      options: [
        { key: 'A', text: 'A' },
        { key: 'B', text: 'B' },
        { key: 'C', text: 'C' },
      ],
      questions: [{ number: 11, prompt: 'the bank', answers: 'B', evidence: '2', answerStatus: 'auto' }],
    },
    {
      type: 'completion',
      instructions: 'Complete the note. Write ONE WORD AND/OR A NUMBER.',
      maxWords: 1,
      numberAllowed: true,
      content: 'Museum opens at {{12}} a.m.',
      questions: [{ number: 12, answers: 'nine\n9', evidence: '3', tip: 'nine 写成 9 也对。', answerStatus: 'auto' }],
    },
  ],
}

test.describe('听力单元', () => {
  let unitId = 0
  const clean = () =>
    withPayload(async (payload) => {
      await payload.delete({ collection: 'units', where: { sourceId: { equals: 'e2e-l-1' } } })
      await payload.delete({ collection: 'media', where: { alt: { in: ['audio/e2e-l-1.mp3', 'img/e2e-l-map.png'] } } })
    })

  test.beforeAll(async () => {
    await clean()
    await withPayload(async (payload) => {
      const req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
      const files: Record<string, Buffer> = { 'audio/e2e-l-1.mp3': MP3, 'img/e2e-l-map.png': PNG }
      const r = await importPackage(req, JSON.stringify({ kind: 'unit', publish: true, data: [listeningUnit] }), async (p) =>
        files[p] ? { data: files[p], size: files[p].length } : null,
      )
      if (!r.body.ok) throw new Error(r.body.errors.join('\n'))
      unitId = Number(r.body.created[0].id)
    })
  })
  test.afterAll(clean)

  test('地图题按字母判分；原文播报句弱化；按句定位；音频有 src', async ({ page, request }) => {
    await page.goto(`${BASE}/practice/u${unitId}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Town Walk · Part 2')
    const src = await page.locator('audio').getAttribute('src')
    expect(src).toBeTruthy()
    expect((await request.get(new URL(src!, BASE).toString())).status()).toBe(200)

    await page.getByRole('radiogroup', { name: '第 11 题' }).getByRole('radio', { name: 'B', exact: true }).click()
    await page.getByRole('textbox', { name: '第 12 题' }).fill('9')
    await page.getByRole('button', { name: '交卷' }).click()
    await expect(page.getByTestId('feedback-11')).toContainText('正确')
    await page.getByTestId('feedback-12').click()
    await expect(page.getByTestId('explain-panel')).toContainText('易错点')

    await page.getByTestId('feedback-11').click()
    await page.getByTestId('explain-panel').getByRole('button', { name: '在原文中定位' }).click()
    await expect(page.locator('#s2')).toHaveAttribute('data-highlight', 'true')
    await expect(page.locator('#s0')).toHaveClass(/text-muted-foreground/)
    await expect(page.locator('#s3')).not.toHaveClass(/text-muted-foreground/)
    await expect(page.getByText('说话人 2').first()).toBeVisible()
  })

  test('听力两栏（电脑）：地图在左栏，交卷后左栏换成原文并可展开地图', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    const left = page.getByTestId('passage-pane')
    await expect(left.locator('img[alt="题目配图"]')).toBeVisible()
    await expect(page.getByTestId('questions-pane').locator('img[alt="题目配图"]')).toHaveCount(0)
    await expect(left.locator('#s2')).toHaveCount(0)
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('button', { name: '交卷' }).last().click()
    await expect(left.locator('#s2')).toBeVisible()
    // 交卷后面板停在第 11 题，原文自动定位到出处句
    await expect(left.locator('#s2')).toHaveAttribute('data-highlight', 'true')
    // 光标停在作答位上显示答案
    await expect(page.getByRole('textbox', { name: '第 12 题' })).toHaveAttribute('title', /答案：nine/)
    await expect(page.locator('#q-11')).toHaveAttribute('title', '答案：B')
    await left.getByText('查看地图 / 配图').click()
    await expect(left.locator('img[alt="题目配图"]')).toBeVisible()
    // 隐藏原文；"在原文中定位"会重新显示
    await left.getByRole('button', { name: '隐藏原文' }).click()
    await expect(left.locator('#s2')).toHaveCount(0)
    await page.getByTestId('explain-panel').getByRole('button', { name: '在原文中定位' }).click()
    await expect(left.locator('#s2')).toHaveAttribute('data-highlight', 'true')
    await left.getByRole('button', { name: '隐藏原文' }).click()
    await left.getByRole('button', { name: '显示原文' }).click()
    await expect(left.locator('#s2')).toBeVisible()
  })

  test('004 交卷后原文跟随播放、点句播放、单句循环', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    await fakeAudio(page)
    const left = page.getByTestId('passage-pane')
    await expect(left.locator('#s2')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '单句循环' })).toHaveCount(0)
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('button', { name: '交卷' }).last().click()
    await page.locator('audio').evaluate((a: HTMLAudioElement) => a.play())
    await audioAt(page, 6.5)
    await expect(left.locator('#s3')).toHaveAttribute('data-current', 'true')
    await expect(left.locator('#s2')).not.toHaveAttribute('data-current', 'true')
    // 点句从该句开头播放
    await left.locator('#s2').click()
    expect(await audioNow(page)).toBe(3)
    await expect(left.locator('#s2')).toHaveAttribute('data-current', 'true')
    // 单句循环：到句末回句首
    const loop = page.getByRole('button', { name: '单句循环' })
    await loop.click()
    await expect(loop).toHaveAttribute('aria-pressed', 'true')
    await audioAt(page, 5.97)
    await expect.poll(() => audioNow(page)).toBe(3)
    await loop.click()
    await audioAt(page, 5.97)
    expect(await audioNow(page)).toBe(5.97)
  })

  test('004 快捷键：按句跳转、输入框不拦截、组合键不拦截、R 只在交卷后', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    await fakeAudio(page)
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('ArrowRight')
    expect(await audioNow(page)).toBe(1)
    await audioAt(page, 4)
    await page.keyboard.press('ArrowLeft') // 第 2 句才播 1 秒：回到上一句
    expect(await audioNow(page)).toBe(1)
    await audioAt(page, 5)
    await page.keyboard.press('ArrowLeft') // 已播 2 秒：回到本句句首
    expect(await audioNow(page)).toBe(3)
    await page.keyboard.press('Control+ArrowRight')
    expect(await audioNow(page)).toBe(3)
    // 空格：页面上切换播放；选项按钮上只选中选项
    await page.locator('audio').evaluate((a: HTMLAudioElement) => a.pause())
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('Space')
    expect(await audioPaused(page)).toBe(false)
    const optB = page.getByRole('radiogroup', { name: '第 11 题' }).getByRole('radio', { name: 'B', exact: true })
    await optB.focus()
    await page.keyboard.press('Space')
    await expect(optB).toHaveAttribute('aria-checked', 'true')
    expect(await audioPaused(page)).toBe(false)
    // 输入框里打字不触发任何控制
    const box = page.getByRole('textbox', { name: '第 12 题' })
    await box.click()
    await page.keyboard.type('nine am')
    await page.keyboard.press('ArrowLeft')
    await expect(box).toHaveValue('nine am')
    expect(await audioNow(page)).toBe(3)
    expect(await audioPaused(page)).toBe(false)
    // R：交卷前无效，交卷后切换单句循环
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('r')
    await expect(page.getByRole('button', { name: '单句循环' })).toHaveCount(0)
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('r')
    await expect(page.getByRole('button', { name: '单句循环' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('004 快捷键展示：电脑有键帽、悬停说明、快捷键面板；触屏没有', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    const prev = page.getByRole('button', { name: '上一句' })
    await expect(prev.locator('kbd')).toBeVisible()
    await expect(prev).toHaveAttribute('title', /回到句首/)
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('?')
    const dialog = page.getByRole('dialog', { name: '快捷键' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('单句循环')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
    const phone = await ctx.newPage()
    await phone.goto(`${BASE}/practice/u${unitId}`)
    await expect(phone.getByRole('button', { name: '上一句' })).toBeVisible()
    await expect(phone.getByRole('button', { name: '上一句' }).locator('kbd')).toBeHidden()
    await expect(phone.getByRole('button', { name: '快捷键' })).toBeHidden()
    await phone.getByRole('button', { name: '交卷' }).click()
    await phone.getByRole('button', { name: '交卷' }).last().click()
    await expect(phone.getByRole('button', { name: '单句循环' })).toBeVisible()
    expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await ctx.close()
  })

  test('听力手机：默认题目，原文 / 题目切换，定位后切到原文', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/practice/u${unitId}`)
    await expect(page.getByRole('button', { name: '题目', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: '原文', exact: true }).click()
    await expect(page.getByTestId('passage-pane').locator('img[alt="题目配图"]')).toBeVisible()
    await page.getByRole('button', { name: '题目', exact: true }).click()
    await page.getByRole('button', { name: '交卷' }).click()
    await page.getByRole('button', { name: '交卷' }).last().click()
    await page.getByTestId('feedback-12').click()
    await page.getByTestId('explain-panel').getByRole('button', { name: '在原文中定位' }).click()
    await expect(page.getByTestId('passage-pane')).toBeVisible()
    await expect(page.locator('#s3')).toHaveAttribute('data-highlight', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})
