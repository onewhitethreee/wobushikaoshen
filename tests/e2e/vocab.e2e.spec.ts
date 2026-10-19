import { expect, test, type Page } from '@playwright/test'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { MailSetting } from '../../src/payload-types'

// 013 取词与背单词。不依赖本机是否导入过整本词典：用到的词条缺了就插入，测完只删自己插入的。
// 验证码从 Mailpit（ielts-mail）取；测试邮箱以 e2e-vocab- 开头，测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const VOCAB_KEY = 'ybz:vocab:v1'

let payload: Payload
let original: MailSetting
const inserted: string[] = []
type Db = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> }
const db = () => (payload.db as unknown as { drizzle: Db }).drizzle

const ensureWord = async (word: string, translation: string | null, exchange: string | null) => {
  const { rows } = await db().execute(sql`SELECT 1 FROM dict_entries WHERE word = ${word}`)
  if (rows.length) return
  await db().execute(sql`INSERT INTO dict_entries (word, translation, exchange) VALUES (${word}, ${translation}, ${exchange})`)
  inserted.push(word)
}

/** 本机单词本里放几个新词（背单词测试用） */
const seedWords = (page: Page, words: string[]) =>
  page.evaluate(
    ([key, ws]) => {
      const now = Date.now()
      const entries = ws.map((w, i) => [w, { at: now, on: true, added: now + i, meaning: `释义-${w}`, src: [{ text: `A sentence with ${w} inside.`, href: '/reading', title: 'T', at: now }] }])
      localStorage.setItem(key, JSON.stringify({ words: Object.fromEntries(entries), vocab: { at: 0, newPerDay: 20, accent: 'gb' } }))
    },
    [VOCAB_KEY, words] as const,
  )

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
  await payload.delete({ collection: 'email-sends', where: { email: { equals: email } } })
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-tab-code').click()
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-send').click()
  await page.getByTestId('login-code').fill(await latestCode(email))
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 })
}

/** 在阅读练习页上塞一段带 mitigated 的句子（data-section + #s999，和真实句子一样的结构），返回这个词的定位器。
 *  挂在 body 下、等页面稳定后再塞：塞进 React 管的文章区域会在重新渲染时被删掉 */
const injectSentence = async (page: Page) => {
  await page.goto(`${BASE}/practice/latest-r1`)
  await page.getByTestId('passage-pane').locator('[id^="s"]').first().waitFor()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => {
    const host = document.createElement('div')
    host.dataset.section = '0'
    host.style.cssText = 'position:fixed;top:120px;left:40px;z-index:20;background:#fff;padding:8px'
    host.innerHTML = '<p><span id="s999">Measures <span data-w>mitigated</span> the risk.</span></p>'
    document.body.append(host)
  })
  return page.locator('[data-w]')
}

test.describe('取词与背单词', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ensureWord('mitigate', 'vt. 使缓和，使减轻', 'p:mitigated/d:mitigated')
    await ensureWord('mitigated', null, '0:mitigate/1:pd')
    original = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
    await payload.updateGlobal({
      slug: 'mail-settings',
      overrideAccess: true,
      data: { primary: { enabled: true, host: '127.0.0.1', port: 1025, secure: 'none', fromAddress: 'noreply@example.test', fromName: '我不是考神' } },
    })
  })

  test.afterAll(async () => {
    for (const w of inserted) await db().execute(sql`DELETE FROM dict_entries WHERE word = ${w}`)
    await payload.db.updateGlobal({ slug: 'mail-settings', data: { primary: original.primary, backup: original.backup } })
    const like = { like: 'e2e-vocab-' }
    await payload.delete({ collection: 'members', where: { email: like } })
    await payload.delete({ collection: 'login-codes', where: { email: like } })
    await payload.delete({ collection: 'email-sends', where: { email: like } })
  })

  test('双击查词：变形显示原形，Esc 关闭；输入框里不弹', async ({ page }) => {
    const w = await injectSentence(page)
    await w.dblclick()
    const card = page.getByTestId('lookup-card')
    await expect(card).toContainText('mitigate')
    await expect(card).toContainText(/mitigated 是 mitigate 的过去(式|分词)/)
    await page.keyboard.press('Escape')
    await expect(card).toBeHidden()

    await page.evaluate(() => {
      const i = document.createElement('input')
      i.value = 'mitigated'
      i.dataset.e2e = 'box'
      document.querySelector('[data-section="0"]')!.prepend(i)
    })
    await page.locator('[data-e2e="box"]').dblclick()
    await page.waitForTimeout(500)
    await expect(card).toBeHidden()
  })

  test('触屏设备上双击不弹卡片', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 760 } })
    const page = await ctx.newPage()
    const w = await injectSentence(page)
    await w.dblclick()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('lookup-card')).toBeHidden()
    await ctx.close()
  })

  test('加入单词本 → 单词本有原句和出处 → 点出处回到原文并高亮', async ({ page }) => {
    const w = await injectSentence(page)
    await w.dblclick()
    await page.getByTestId('lookup-add').click()
    await expect(page.getByTestId('lookup-in-book')).toContainText('已在单词本 · 新词')
    // 塞进去的句子刷新后就没了；把出处改成文章里真实的第一句，再测"回到原文"
    const firstId = await page.getByTestId('passage-pane').locator('[id^="s"]:not(#s999)').first().getAttribute('id')
    await page.evaluate(
      ([key, id]) => {
        const v = JSON.parse(localStorage.getItem(key)!)
        v.words.mitigate.src[0].href = `${location.pathname}#p0-${id}`
        localStorage.setItem(key, JSON.stringify(v))
      },
      [VOCAB_KEY, firstId!] as const,
    )
    await page.goto(`${BASE}/me/words`)
    const row = page.getByTestId('word-row').filter({ hasText: 'mitigate' })
    await expect(row).toContainText('Measures mitigated the risk.')
    await expect(row).toContainText('第 1 部分')
    await row.getByRole('link').click()
    await expect(page.locator(`#${firstId}`)).toHaveAttribute('data-highlight', 'true')

    await page.goto(`${BASE}/me/words`)
    await page.getByTestId('word-row').filter({ hasText: 'mitigate' }).getByTestId('word-remove').click()
    await expect(page.getByTestId('word-row')).toHaveCount(0)
    await page.getByTestId('word-undo').click()
    await expect(page.getByTestId('word-row')).toHaveCount(1)
  })

  test('背单词：正面没有释义，"忘了"的稍后再出现，全部完成', async ({ page }) => {
    await page.goto(`${BASE}/me/review`)
    await seedWords(page, ['alpha', 'bravo', 'charlie'])
    await page.reload()
    await expect(page.getByTestId('review-today')).toHaveText('今天：新词 3 · 复习 0')
    await page.getByTestId('review-start').click()
    await expect(page.getByText('释义-alpha')).toBeHidden()
    const seen: string[] = []
    let undid = false
    for (let i = 0; i < 20 && !(await page.getByTestId('review-done').isVisible()); i++) {
      seen.push((await page.getByTestId('review-word').textContent())?.trim() ?? '')
      await page.keyboard.press('Space')
      await expect(page.getByTestId('review-back')).toBeVisible()
      await page.keyboard.press(seen.length === 1 ? '1' : '3')
      // 第二张答完撤销一次：回到同一张，再答
      if (seen.length === 2 && !undid) {
        undid = true
        await page.keyboard.press('z')
        await expect(page.getByTestId('review-word')).toHaveText(seen[1])
        seen.pop()
      }
    }
    await expect(page.getByTestId('review-done')).toContainText('新学 3 个')
    expect(seen.filter((w) => w === 'alpha').length).toBeGreaterThanOrEqual(2)
  })

  test('设置：每天新词改为 1，刷新后还在', async ({ page }) => {
    await page.goto(`${BASE}/me/review`)
    await seedWords(page, ['delta', 'echo', 'foxtrot'])
    await page.reload()
    const input = page.getByTestId('review-new-per-day')
    await input.fill('1')
    await input.blur()
    await expect(page.getByTestId('review-today')).toHaveText('今天：新词 1 · 复习 0')
    await page.reload()
    await expect(page.getByTestId('review-today')).toHaveText('今天：新词 1 · 复习 0')
  })

  test('375px 宽：背单词没有横向滚动', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/me/review`)
    await seedWords(page, ['golf'])
    await page.reload()
    await page.getByTestId('review-start').click()
    await page.getByTestId('review-show').click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await ctx.close()
  })

  test('未登录加的词登录后进账号；另一台设备看到，并同步复习进度', async ({ browser }) => {
    const email = `e2e-vocab-${Date.now()}@example.test`
    const a = await (await browser.newContext()).newPage()
    await a.goto(`${BASE}/me/words`)
    await seedWords(a, ['hotel', 'india'])
    await codeLogin(a, email)

    const b = await (await browser.newContext()).newPage()
    await codeLogin(b, email)
    await b.goto(`${BASE}/me/words`)
    await expect(b.getByTestId('word-row')).toHaveCount(2)

    await b.goto(`${BASE}/me/review`)
    await b.getByTestId('review-start').click()
    for (let i = 0; i < 6 && !(await b.getByTestId('review-done').isVisible()); i++) {
      await b.keyboard.press('Space')
      await b.keyboard.press('4')
    }
    await expect(b.getByTestId('review-done')).toBeVisible()

    // 推送有 2 秒防抖
    await expect(async () => {
      await a.goto(`${BASE}/me/words`)
      await expect(a.getByTestId('word-row').filter({ hasText: 'hotel' })).toContainText('学习中', { timeout: 1000 })
    }).toPass({ timeout: 15_000 })
  })
})
