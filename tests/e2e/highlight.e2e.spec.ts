import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { importEndpoint } from '../../src/endpoints/import'
import type { MailSetting } from '../../src/payload-types'

// 014 做题高亮。自己导入并发布示例套题 EX-001，结束时删除（与 practice.e2e 共用，--workers=1）
// 登录同步用 Mailpit（ielts-mail）取验证码；测试邮箱以 e2e-hl- 开头，测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const PACK = path.resolve(process.cwd(), 'docs/import-example')
const CODE = 'EX-001'
const mediaPaths = fs
  .readdirSync(PACK, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && d.name !== 'import.json')
  .map((d) => path.relative(PACK, path.join(d.parentPath, d.name)).replace(/\\/g, '/'))

let payload: Payload
let original: MailSetting
let id = 0

const removeExample = async () => {
  await payload.delete({ collection: 'tests', where: { code: { equals: CODE } } })
  await payload.delete({ collection: 'media', where: { alt: { in: mediaPaths } } })
}

test.beforeAll(async () => {
  payload = await getPayload({ config })
  await removeExample()
  const form = new FormData()
  for (const p of ['import.json', ...mediaPaths]) form.append('files', new File([fs.readFileSync(path.join(PACK, p))], p))
  const req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
  req.formData = async () => form
  const body = (await ((await importEndpoint.handler(req)) as Response).json()) as { created?: { id: number }[]; errors?: string[] }
  expect(body.errors ?? []).toEqual([])
  id = body.created![0].id
  await payload.update({ collection: 'tests', id, data: { _status: 'published' } })
  original = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
  await payload.updateGlobal({
    slug: 'mail-settings',
    overrideAccess: true,
    data: { primary: { enabled: true, host: '127.0.0.1', port: 1025, secure: 'none', fromAddress: 'noreply@example.test', fromName: '我不是考神' } },
  })
})

test.afterAll(async () => {
  await removeExample()
  await payload.db.updateGlobal({ slug: 'mail-settings', data: { primary: original.primary, backup: original.backup } })
  const like = { like: 'e2e-hl-' }
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
})

test.describe.configure({ mode: 'serial' })

const open = async (page: Page, unit: string) => {
  await page.goto(`${BASE}/practice/t${id}-${unit}`)
  await page.locator('[data-hl="q"]').waitFor({ state: 'attached' })
  await page.waitForLoadState('networkidle')
}

/** 在区域里选中从 from 开头到 to 结尾的文字（可跨文本节点），返回选区中心坐标 */
// 页面是平滑滚动，滚动事件会把刚打开的菜单关掉：立即滚到视口中间，等两帧让滚动事件派发完再返回坐标
const select = (page: Page, region: string, from: string, to = from) =>
  page.evaluate(
    async ([region, from, to]) => {
      const root = document.querySelector(`[data-hl="${region}"]`)!
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const r = document.createRange()
      let started = false
      while (w.nextNode()) {
        const t = w.currentNode as Text
        if (!started && t.data.includes(from)) {
          r.setStart(t, t.data.indexOf(from))
          started = true
        }
        if (started && t.data.includes(to) && (t !== r.startContainer || t.data.indexOf(to) >= r.startOffset)) {
          r.setEnd(t, t.data.indexOf(to, t === r.startContainer ? r.startOffset : 0) + to.length)
          break
        }
      }
      ;(r.startContainer.parentElement as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' })
      for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(r)
      const b = r.getClientRects()[0]
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    },
    [region, from, to] as const,
  )

/** 某段文字在页面上的中心坐标（右键高亮用，不改选区） */
const pointAt = (page: Page, region: string, text: string) =>
  page.evaluate(
    async ([region, text]) => {
      const root = document.querySelector(`[data-hl="${region}"]`)!
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) {
        const t = w.currentNode as Text
        const i = t.data.indexOf(text)
        if (i < 0) continue
        t.parentElement!.scrollIntoView({ block: 'center', behavior: 'instant' })
        for (let k = 0; k < 2; k++) await new Promise(requestAnimationFrame)
        const r = document.createRange()
        r.setStart(t, i)
        r.setEnd(t, i + text.length)
        const b = r.getClientRects()[0]
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
      }
      throw new Error(`找不到 ${text}`)
    },
    [region, text] as const,
  )

const marked = (page: Page) => page.evaluate(() => [...(CSS.highlights.get('ybz-hl') ?? [])].map((r) => r.toString()))
const menu = (page: Page) => page.getByRole('menu', { name: '高亮' })

const rightClick = (page: Page, p: { x: number; y: number }) => page.mouse.click(p.x, p.y, { button: 'right' })
const highlight = async (page: Page, region: string, from: string, to = from) => {
  await rightClick(page, await select(page, region, from, to))
  await menu(page).getByRole('menuitem', { name: '高亮', exact: true }).click()
}

const regionTexts = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-hl]')].map((root) => {
      // 与 src/practice/marks.ts 的计数规则相同（跳过 [data-hl-skip]）；不用 acceptNode，tsx 会给它注入 __name
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let s = ''
      while (w.nextNode()) if (!w.currentNode.parentElement?.closest('[data-hl-skip]')) s += (w.currentNode as Text).data
      return `${root.getAttribute('data-hl')}:${s}`
    }),
  )

const submit = async (page: Page) => {
  await page.getByRole('button', { name: '交卷', exact: true }).click()
  const confirm = page.getByRole('button', { name: '仍然交卷' })
  if (await confirm.isVisible()) await confirm.click()
  await expect(page.getByTestId('result-bar')).toBeVisible()
}

test.describe('US1 / US2 高亮与清除', () => {
  test('文章里高亮、跨段、合并，选区清空；高亮上右键清除只清这一段', async ({ page }) => {
    await open(page, 'r1')
    await highlight(page, 'p', 'less than one percent')
    expect(await marked(page)).toEqual(['less than one percent'])
    // 高亮样式确实生效（不是被 CSS 解析器丢掉）
    expect(
      await page.evaluate(() =>
        [...document.styleSheets].some((sh) => [...sh.cssRules].some((r) => r.cssText.includes('::highlight(ybz-hl)') && r.cssText.includes('var(--highlight)'))),
      ),
    ).toBe(true)
    expect(await page.evaluate(() => getSelection()!.isCollapsed)).toBe(true)
    await expect(menu(page)).toHaveCount(0)

    // 与已有高亮重叠 → 合并成一段
    await highlight(page, 'p', 'one percent of the ocean', 'ocean floor')
    expect(await marked(page)).toEqual(['less than one percent of the ocean floor'])

    // 跨段：A 段末尾到 B 段开头，两段都有
    const paras = await page.locator('[data-hl="p"] p').allTextContents()
    const aEnd = paras[0].trim().slice(-12)
    const bStart = paras[1].replace(/^[A-Z]\s*/, '').slice(0, 10)
    await highlight(page, 'p', aEnd, bStart)
    // 跨段是一个 Range，覆盖 A 段末尾和 B 段开头
    const all = await marked(page)
    expect(all).toHaveLength(2)
    expect(all[1]).toContain(aEnd)
    expect(all[1]).toContain(bStart)

    // 高亮上右键（无选区）→ 只有"清除高亮"，只清这一段
    await page.evaluate(() => getSelection()!.removeAllRanges())
    await rightClick(page, await pointAt(page, 'p', 'less than'))
    await expect(menu(page).getByRole('menuitem')).toHaveText(['清除高亮'])
    await menu(page).getByRole('menuitem', { name: '清除高亮' }).click()
    expect(await marked(page)).toHaveLength(1)
    expect((await marked(page)).join('|')).not.toContain('less than')

    // 高亮上又选了新文字 → 两项都有
    await select(page, 'p', 'Coral reefs')
    await rightClick(page, await pointAt(page, 'p', aEnd))
    await expect(menu(page).getByRole('menuitem')).toHaveText(['高亮', '清除高亮'])
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveCount(0)
    expect(await marked(page)).toHaveLength(1)
  })

  test('不拦截的情况：无选区普通文字、跨区域；Esc / 点外部 / 滚动关闭；键盘操作菜单', async ({ page }) => {
    await open(page, 'r1')
    // 浏览器自带菜单拿不到，只看站内菜单没出现、事件没被拦
    const prevented = () => page.evaluate(() => (window as unknown as { __p: boolean }).__p)
    await page.evaluate(() => document.addEventListener('contextmenu', (e) => ((window as unknown as { __p: boolean }).__p = e.defaultPrevented)))
    await rightClick(page, await pointAt(page, 'p', 'Coral reefs'))
    await expect(menu(page)).toHaveCount(0)
    expect(await prevented()).toBe(false)

    // 跨区域：文章拖到题目
    await page.evaluate(() => {
      const r = document.createRange()
      r.setStart(document.querySelector('[data-hl="p"]')!, 0)
      r.setEnd(document.querySelector('[data-hl="q"]')!, 1)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(r)
    })
    await rightClick(page, await pointAt(page, 'p', 'Coral reefs'))
    await expect(menu(page)).toHaveCount(0)
    expect(await prevented()).toBe(false)

    const p = await select(page, 'p', 'Coral reefs')
    await rightClick(page, p)
    await expect(menu(page)).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(menu(page)).toHaveCount(0)

    await rightClick(page, await select(page, 'p', 'Coral reefs'))
    await page.getByTestId('passage-pane').evaluate((el) => el.dispatchEvent(new Event('scroll')))
    await expect(menu(page)).toHaveCount(0)

    // 键盘：焦点在第一项，Enter 执行
    await rightClick(page, await select(page, 'p', 'Coral reefs'))
    await expect(menu(page).getByRole('menuitem', { name: '高亮', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    const first = menu(page).getByRole('menuitem', { name: '高亮', exact: true })
    await expect(first).toBeFocused()
    // 键盘操作时有焦点框
    await expect(first).toHaveCSS('outline-style', 'solid')
    // Tab 离开菜单就关闭
    await page.keyboard.press('Tab')
    await expect(menu(page)).toHaveCount(0)
    await rightClick(page, await select(page, 'p', 'Coral reefs'))
    await expect(first).toBeFocused()
    await page.keyboard.press('Enter')
    expect(await marked(page)).toEqual(['Coral reefs'])
  })

  test('题目和选项文字能高亮，点选项照常作答，拖选选项不误选；输入框照常输入', async ({ page }) => {
    await open(page, 'l1')
    const opt = page.locator('[data-hl="q"] [role="radio"]').first()
    const optText = (await opt.textContent())!.trim().slice(1, 8).trim()
    // 拖选选项文字：松开后不算选中
    const box = (await opt.boundingBox())!
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect(opt).toHaveAttribute('aria-checked', 'false')

    await highlight(page, 'q', optText)
    expect(await marked(page)).toEqual([optText])
    await opt.click()
    await expect(opt).toHaveAttribute('aria-checked', 'true')

    // 选区包含输入框：从输入框所在那行的第一个文本节点选到最后一个
    const input = page.getByRole('textbox', { name: '第 1 题', exact: true })
    const at = await page.evaluate(async () => {
      const line = document.querySelector('[data-hl="q"] [data-q="1"]')!.closest('p, li')!
      line.scrollIntoView({ block: 'center', behavior: 'instant' })
      for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame)
      const w = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
      const texts: Text[] = []
      while (w.nextNode()) if ((w.currentNode as Text).data.trim()) texts.push(w.currentNode as Text)
      const r = document.createRange()
      r.setStart(texts[0], 0)
      r.setEnd(texts[texts.length - 1], texts[texts.length - 1].length)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(r)
      const b = texts[0].parentElement!.getBoundingClientRect()
      return { x: b.left + 2, y: b.top + b.height / 2 }
    })
    await rightClick(page, at)
    await menu(page).getByRole('menuitem', { name: '高亮', exact: true }).click()
    await expect.poll(() => marked(page).then((m) => m.length)).toBe(2)
    await input.fill('Harper')
    await expect(input).toHaveValue('Harper')
  })

  test('双击查词照常；接着右键关闭卡片、出现菜单', async ({ page }) => {
    await open(page, 'r1')
    const p = await pointAt(page, 'p', 'Coral')
    await page.mouse.dblclick(p.x, p.y)
    // 本机可能没导入词典：卡片出现（有词或"查词失败"）即可
    await expect(page.getByTestId('lookup-card')).toBeVisible()
    await rightClick(page, p)
    await expect(page.getByTestId('lookup-card')).toHaveCount(0)
    await expect(menu(page)).toBeVisible()
  })

  test('触屏设备上不出现菜单', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await open(page, 'r1')
    await page.evaluate(() => {
      const t = document.querySelector('[data-hl="p"] p')!.lastChild!
      const r = document.createRange()
      r.setStart(t, 0)
      r.setEnd(t, 5)
      getSelection()!.addRange(r)
      t.parentElement!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 300 }))
    })
    await expect(menu(page)).toHaveCount(0)
    await ctx.close()
  })
})

test.describe('US3 保存到交卷为止', () => {
  test('刷新恢复；交卷后仍在且区域文字不变；交卷后的改动不保存；重做清空', async ({ page }) => {
    await open(page, 'r1')
    await highlight(page, 'p', 'less than one percent')
    await highlight(page, 'q', (await page.locator('[data-hl="q"] li p').first().textContent())!.slice(0, 12))
    await page.waitForTimeout(700)
    await page.reload()
    await page.locator('[data-hl="q"]').waitFor({ state: 'attached' })
    await expect.poll(() => marked(page).then((m) => m.length)).toBe(2)

    const before = await regionTexts(page)
    const kept = await marked(page)
    await submit(page)
    expect(await regionTexts(page)).toEqual(before)
    await expect.poll(() => marked(page)).toEqual(kept)

    // 交卷后新加的只在当前页面
    await highlight(page, 'p', 'Coral reefs')
    await expect.poll(() => marked(page).then((m) => m.length)).toBe(3)
    await page.reload()
    await page.locator('[data-hl="q"]').waitFor({ state: 'attached' })
    await page.waitForTimeout(300)
    expect(await marked(page)).toEqual([])

    // 重做清空
    await highlight(page, 'p', 'Coral reefs')
    await page.waitForTimeout(700)
    await submit(page)
    await page.getByTestId('result-bar').getByRole('button', { name: /再做|重做/ }).click()
    await expect.poll(() => marked(page)).toEqual([])
  })

  test('20 处高亮（含跨段、重叠、清除）刷新后原样恢复', async ({ page }) => {
    await open(page, 'r2')
    const words = (await page.locator('[data-hl="p"] p').allTextContents()).join(' ').match(/\b[a-z]{6,}\b/g)!.filter((w, i, a) => a.indexOf(w) === i)
    for (const w of words.slice(0, 20)) await highlight(page, 'p', w)
    const paras = await page.locator('[data-hl="p"] p').allTextContents()
    await highlight(page, 'p', paras[1].trim().slice(-8), paras[2].replace(/^[A-Z]\s*/, '').slice(0, 8))
    await page.evaluate(() => getSelection()!.removeAllRanges())
    await rightClick(page, await pointAt(page, 'p', words[0]))
    await menu(page).getByRole('menuitem', { name: '清除高亮' }).click()
    const kept = await marked(page)
    await page.waitForTimeout(700)
    await page.reload()
    await page.locator('[data-hl="q"]').waitFor({ state: 'attached' })
    await expect.poll(() => marked(page).then((m) => [...m].sort())).toEqual([...kept].sort())
  })

  test('听力切 Part 再回来还在；交卷后原文能高亮，隐藏再显示还在', async ({ page }) => {
    await open(page, 'l')
    const q1 = (await page.locator('[data-hl="q"] li p').first().textContent())!.slice(0, 10)
    await highlight(page, 'q', q1)
    await page.getByRole('tab', { name: 'Part 2', exact: true }).click()
    await expect.poll(() => marked(page)).toEqual([])
    await page.getByRole('tab', { name: 'Part 1', exact: true }).click()
    await expect.poll(() => marked(page)).toEqual([q1])

    await submit(page)
    await page.getByRole('tab', { name: 'Part 1', exact: true }).click()
    await highlight(page, 't', 'Good morning')
    await expect.poll(() => marked(page).then((m) => m.length)).toBe(2)
    await page.getByRole('button', { name: '隐藏原文' }).click()
    await page.getByRole('button', { name: '显示原文' }).click()
    await expect.poll(() => marked(page).then((m) => m.length)).toBe(2)
  })

  test('登录后另一台设备看到相同高亮', async ({ browser }) => {
    const email = `e2e-hl-${Date.now()}@example.test`
    const a = await (await browser.newContext()).newPage()
    await codeLogin(a, email)
    await open(a, 'r1')
    await highlight(a, 'p', 'less than one percent')

    const b = await (await browser.newContext()).newPage()
    await codeLogin(b, email)
    // 推送有 2 秒防抖
    await expect(async () => {
      await open(b, 'r1')
      expect(await marked(b)).toEqual(['less than one percent'])
    }).toPass({ timeout: 15_000 })
  })
})

const latestCode = async (to: string) => {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
    const { messages } = (await res.json()) as { messages: { ID: string }[] }
    if (messages?.[0]) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string }
      const m = /验证码是：(\d{6})/.exec(msg.Text)
      if (m) return m[1]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Mailpit 里没有发给 ${to} 的验证码`)
}

const codeLogin = async (page: Page, email: string) => {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { method: 'DELETE' })
  await payload.delete({ collection: 'email-sends', where: { email: { equals: email } } }) // 同一邮箱第二次发码不被限频
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-tab-code').click()
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-send').click()
  await page.getByTestId('login-code').fill(await latestCode(email))
  await page.getByTestId('login-submit').click()
  // 登录后跳回首页，开发模式首页渲染约 3.5 秒，默认 5 秒不够（2026-10-19）
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 })
}
