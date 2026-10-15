// 发信主备切换与密码不外泄（009 US5、FR-011、SC-007）。需要本机 Mailpit（ielts-mail，SMTP 1025）
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MailUnavailable, sendMail } from '@/account/mail'
import type { MailSetting, User } from '@/payload-types'

let payload: Payload
let original: MailSetting
let admin: User

const TO = 'e2e-mail@example.test'
const box = (port: number, enabled = true) => ({
  enabled,
  host: '127.0.0.1',
  port,
  secure: 'none' as const,
  user: 'u',
  password: 'secret-pass-123',
  fromAddress: 'noreply@example.test',
  fromName: '我不是考神',
})
const set = (data: Partial<MailSetting>) => payload.updateGlobal({ slug: 'mail-settings', data, overrideAccess: true })

describe('发信', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    original = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
    admin = (await payload.find({ collection: 'users', limit: 1 })).docs[0] as User
  })

  afterAll(async () => {
    // 直接写库还原（绕过"空密码保留旧值"的钩子），不留下测试用的假密码
    const blank = { ...Object.fromEntries(Object.keys(box(0)).map((k) => [k, null])), passwordSet: null, lastError: null, lastErrorAt: null }
    await payload.db.updateGlobal({
      slug: 'mail-settings',
      data: { primary: { ...blank, ...original.primary }, backup: { ...blank, ...original.backup } },
    })
    await payload.delete({ collection: 'email-sends', where: { email: { equals: TO } } })
  })

  it('主用失败时自动改用备用，并记下主用的失败原因', async () => {
    await set({ primary: box(1026), backup: box(1025) })
    expect(await sendMail(payload, { to: TO, subject: '测试', text: '主备', kind: 'test' })).toBe('backup')
    const s = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true })) as MailSetting
    expect(s.primary?.lastError).toBeTruthy()
    expect(s.primary?.lastErrorAt).toBeTruthy()
    // 记录失败原因时没有把密码冲掉
    expect(s.primary?.password).toBe('secret-pass-123')
  })

  it('两套都停用时报"发不出去"', async () => {
    await set({ primary: box(1025, false), backup: box(1025, false) })
    await expect(sendMail(payload, { to: TO, subject: '测试', text: '停用', kind: 'test' })).rejects.toBeInstanceOf(MailUnavailable)
  })

  it('管理员读设置也拿不到密码，只看到"已设置"', async () => {
    await set({ primary: box(1025), backup: box(1025) })
    const s = (await payload.findGlobal({
      slug: 'mail-settings',
      overrideAccess: false,
      user: { ...admin, collection: 'users' },
    })) as MailSetting
    expect(JSON.stringify(s)).not.toContain('secret-pass-123')
    expect(s.primary?.passwordSet).toBe(true)
  })

  it('提交空密码不会清掉已有密码', async () => {
    await set({ primary: { ...box(1025), password: '' } })
    const s = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true })) as MailSetting
    expect(s.primary?.password).toBe('secret-pass-123')
  })

  it('后台输入框 newPassword 写进密码，本身不回显', async () => {
    await payload.updateGlobal({
      slug: 'mail-settings',
      overrideAccess: false,
      user: { ...admin, collection: 'users' },
      data: { primary: { ...box(1025), password: undefined, newPassword: 'from-admin-456' } },
    })
    const raw = (await payload.findGlobal({ slug: 'mail-settings', overrideAccess: true, showHiddenFields: true })) as MailSetting
    expect(raw.primary?.password).toBe('from-admin-456')
    const seen = await payload.findGlobal({ slug: 'mail-settings', overrideAccess: false, user: { ...admin, collection: 'users' } })
    expect(JSON.stringify(seen)).not.toContain('from-admin-456')
    await set({ primary: { ...box(1025), password: 'secret-pass-123' } })
  })

  it('每次发信都留一条记录', async () => {
    const logs = await payload.find({ collection: 'email-sends', where: { email: { equals: TO } } })
    expect(logs.docs.some((d) => d.via === 'backup' && d.ok)).toBe(true)
    expect(logs.docs.some((d) => d.via === 'none' && !d.ok)).toBe(true)
  })
})
