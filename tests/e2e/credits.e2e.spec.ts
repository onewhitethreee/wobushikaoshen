import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import type { MailSetting } from '../../src/payload-types'

// 011 额度账户：邀请链接双方得额度、笔记提交与审核、截图别人打不开；016 注册赠送、兑换码。
// 发信走本机 Mailpit（ielts-mail），测试邮箱以 e2e-credits- 开头，测完删除
const BASE = 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:8025'
const A = `e2e-credits-a-${Date.now()}@example.test`
const B = `e2e-credits-b-${Date.now()}@example.test`
const C = `e2e-credits-c-${Date.now()}@example.test`
const NOTE = 'https://www.xiaohongshu.com/explore/'

let payload: Payload
let original: MailSetting

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

const login = async (page: Page, email: string) => {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { method: 'DELETE' })
  await payload.delete({ collection: 'email-sends', where: { email: { equals: email } } })
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-send').click()
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.getByTestId('login-code').fill(await latestCode(email))
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-menu')).toContainText('***@example.test', { timeout: 15_000 })
}

const cleanup = async () => {
  const like = { like: 'e2e-credits-' }
  await payload.delete({ collection: 'members', where: { email: like } })
  await payload.delete({ collection: 'login-codes', where: { email: like } })
  await payload.delete({ collection: 'email-sends', where: { email: like } })
}

const review = async (data: Record<string, unknown>) => {
  const s = (await payload.find({ collection: 'note-submissions', where: { status: { equals: 'pending' } }, sort: '-createdAt', limit: 1 })).docs[0]
  const admin = (await payload.find({ collection: 'users', limit: 1 })).docs[0]
  await payload.update({ collection: 'note-submissions', id: s.id, data, user: { ...admin, collection: 'users' }, overrideAccess: false })
}

const uploadNote = async (page: Page, text: string, file: string) => {
  await page.getByTestId('note-text').fill(text)
  await page.getByTestId('note-file').setInputFiles(file)
  await page.getByTestId('note-submit').click()
}

test.describe('额度账户', () => {
  let png: string

  test.beforeAll(async () => {
    payload = await getPayload({ config: await config })
    original = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
    await payload.updateGlobal({
      slug: 'mail-settings',
      overrideAccess: true,
      data: {
        primary: { enabled: true, host: '127.0.0.1', port: 1025, secure: 'none', fromAddress: 'noreply@example.test', fromName: '我不是考神' },
      },
    })
    await cleanup()
    png = test.info().outputPath('note.png')
    await sharp({ create: { width: 40, height: 40, channels: 3, background: '#4a7' } }).png().toFile(png)
  })

  test.afterAll(async () => {
    await payload.db.updateGlobal({ slug: 'mail-settings', data: { primary: original.primary, backup: original.backup } })
    await cleanup()
  })

  test('邀请好友 → 双方得额度；提交笔记 → 审核通过 / 驳回', async ({ browser }) => {
    const s = await payload.findGlobal({ slug: 'credit-settings' })

    // A 登录，拿邀请链接
    const ctxA = await browser.newContext()
    const pageA = await ctxA.newPage()
    await login(pageA, A)
    await pageA.goto(`${BASE}/me/credits`)
    // 016：新账号先得注册赠送
    const g = s.signupReward
    await expect(pageA.getByTestId('credit-balance')).toHaveText(String(g))
    if (g > 0) await expect(pageA.getByTestId('credit-entry').first()).toContainText('注册赠送')
    const link = await pageA.getByTestId('invite-link').inputValue()
    expect(link).toMatch(/\/i\/[A-Z0-9]{8}$/)

    // B 在另一个浏览器打开链接，用新邮箱注册
    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()
    await pageB.goto(link.replace(/^https?:\/\/[^/]+/, BASE))
    await expect(pageB).toHaveURL(`${BASE}/`)
    await login(pageB, B)
    await expect(pageB).toHaveURL(/\/me\/credits/)
    await expect(pageB.getByTestId('invite-welcome')).toHaveText(
      g > 0
        ? `你得到 ${s.inviteeReward + g} 额度（含注册赠送 ${g}），邀请人也得到 ${s.inviteeReward} 额度`
        : `你和邀请人各得 ${s.inviteeReward} 额度`,
    )
    await expect(pageB.getByTestId('credit-balance')).toHaveText(String(s.inviteeReward + g))

    await pageA.reload()
    await expect(pageA.getByTestId('credit-balance')).toHaveText(String(s.inviterReward + g))
    await expect(pageA.getByTestId('invite-stats')).toContainText('已邀请 1 人')

    // B 提交笔记：没找到链接时提示；正常提交后显示审核中
    await uploadNote(pageB, '随便写点', png)
    await expect(pageB.getByTestId('note-error')).toHaveText('没找到小红书笔记链接')
    const id = Date.now().toString(16).padStart(24, '0').slice(-24)
    await uploadNote(pageB, `看看 ${NOTE}${id} 吧`, png)
    await expect(pageB.getByTestId('note-status').first()).toHaveText('审核中')

    // 截图：本人能打开，A 打不开
    const shot = await pageB.getByTestId('note-row').first().locator('img').getAttribute('src')
    // 在页面里 fetch，带的是浏览器真实的登录 cookie
    const status = (p: Page) => p.evaluate(async (u) => (await fetch(u)).status, shot!)
    expect(await status(pageB)).toBe(200)
    expect(await status(pageA)).toBe(403)

    // 后台通过，额度改成 15
    await review({ status: 'approved', amount: 15 })
    await pageB.reload()
    await expect(pageB.getByTestId('credit-balance')).toHaveText(String(s.inviteeReward + g + 15))
    await expect(pageB.getByTestId('note-status').first()).toHaveText('已通过 +15')
    // 栏目侧栏显示同一个余额
    await pageB.goto(`${BASE}/writing`)
    await expect(pageB.locator('aside')).toContainText(`剩余 ${s.inviteeReward + g + 15} 额度`)
    await pageB.goto(`${BASE}/me/credits`)

    // 同一篇再交：提示已提交过
    await uploadNote(pageB, `${NOTE}${id}`, png)
    await expect(pageB.getByTestId('note-error')).toHaveText('这篇笔记已经提交过')

    // 另一篇被驳回
    await pageB.reload()
    await uploadNote(pageB, `${NOTE}${'f'.repeat(24)}`, png)
    await expect(pageB.getByTestId('note-status').first()).toHaveText('审核中')
    await review({ status: 'rejected', rejectPreset: '截图和链接对不上' })
    await pageB.reload()
    await expect(pageB.getByTestId('note-status').first()).toHaveText('未通过：截图和链接对不上')
    await expect(pageB.getByTestId('credit-balance')).toHaveText(String(s.inviteeReward + g + 15))

    await ctxA.close()
    await ctxB.close()
  })

  test('兑换码：小写去横线也能兑换，再兑换提示已用过（016）', async ({ browser }) => {
    const c = await payload.create({ collection: 'redeem-codes', overrideAccess: true, data: { amount: 5, maxUses: 1, note: 'e2e-credits' } as never })
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    try {
      await login(page, C)
      await page.goto(`${BASE}/me/credits`)
      const before = Number(await page.getByTestId('credit-balance').textContent())
      await page.getByTestId('redeem-code').fill(c.code.toLowerCase().replace(/-/g, ''))
      await page.getByTestId('redeem-submit').click()
      await expect(page.getByTestId('redeem-result')).toHaveText('得到 5 额度')
      await expect(page.getByTestId('credit-balance')).toHaveText(String(before + 5))
      await expect(page.getByTestId('credit-entry').first()).toContainText('兑换码')
      await page.getByTestId('redeem-code').fill(c.code)
      await page.getByTestId('redeem-submit').click()
      await expect(page.getByTestId('redeem-result')).toHaveText('你已经用过这个兑换码')
    } finally {
      await ctx.close()
      await payload.delete({ collection: 'redeem-codes', id: c.id, overrideAccess: true })
    }
  })
})
