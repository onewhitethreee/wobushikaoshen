// 考生账号不能越权（009 FR-053、research R2）：读不到 AI 设置、草稿、后台账号，也改不了题库
import { createLocalReq, getAccessResults, getPayload, type Payload, type PayloadRequest, type Where } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { memberDataEndpoint } from '@/endpoints/memberData'
import type { Member } from '@/payload-types'

let payload: Payload
let member: Member
let other: Member

const asMember = (m: Member) => ({ user: { ...m, collection: 'members' as const }, overrideAccess: false })

describe('考生账号权限', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.delete({ collection: 'members', where: { email: { like: 'e2e-access-' } } })
    const mk = (email: string) =>
      payload.create({ collection: 'members', data: { email, password: 'x'.repeat(32) } })
    member = await mk('e2e-access-a@example.test')
    other = await mk('e2e-access-b@example.test')
  })

  afterAll(async () => {
    await payload.delete({ collection: 'members', where: { email: { like: 'e2e-access-' } } })
  })

  it('读不到 AI 设置', async () => {
    await expect(payload.findGlobal({ slug: 'ai-settings', ...asMember(member) })).rejects.toThrow()
  })

  it('读不到后台账号', async () => {
    await expect(payload.find({ collection: 'users', ...asMember(member) })).rejects.toThrow()
  })

  it('读题库只限已发布（草稿不可见）', () => {
    const req = { user: { ...member, collection: 'members' } } as unknown as PayloadRequest
    expect(authenticatedOrPublished({ req } as never)).toEqual({ _status: { equals: 'published' } })
  })

  it('改不了题库', async () => {
    const one = await payload.find({ collection: 'units', limit: 1 })
    if (!one.docs[0]) return
    // 写回原标题：万一权限坏了也不改动数据
    await expect(
      payload.update({ collection: 'units', id: one.docs[0].id, data: { title: one.docs[0].title }, ...asMember(member) }),
    ).rejects.toThrow()
  })

  it('考生列表只看得到自己', async () => {
    const res = await payload.find({ collection: 'members', ...asMember(member) })
    expect(res.docs.map((d) => d.id)).toEqual([member.id])
    await expect(payload.findByID({ collection: 'members', id: other.id, ...asMember(member) })).rejects.toThrow()
  })

  it('通配查询、按别人 id 查也只拿到自己；改不了别人（010 A6）', async () => {
    const wheres: Where[] = [{ email: { like: '%' } }, { email: { like: 'e2e-access-b' } }, { id: { equals: other.id } }, { id: { not_equals: member.id } }]
    for (const where of wheres) {
      const res = await payload.find({ collection: 'members', where, ...asMember(member) })
      expect(res.docs.every((d) => d.id === member.id)).toBe(true)
    }
    await expect(
      payload.update({ collection: 'members', id: other.id, data: { lastLoginAt: new Date().toISOString() }, ...asMember(member) }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'members', id: other.id, ...asMember(member) })).rejects.toThrow()
  })

  it('不能自己注册或改资料', async () => {
    await expect(
      payload.create({ collection: 'members', data: { email: 'e2e-access-c@example.test', password: 'x'.repeat(32) }, ...asMember(member) }),
    ).rejects.toThrow()
    await expect(
      payload.update({ collection: 'members', id: member.id, data: { email: 'e2e-access-z@example.test' }, ...asMember(member) }),
    ).rejects.toThrow()
  })

  it('密码登录被关闭', async () => {
    await expect(
      payload.login({ collection: 'members', data: { email: member.email, password: 'x'.repeat(32) } }),
    ).rejects.toThrow()
  })

  describe('/api/me/data 只读写自己的数据', () => {
    const call = (user: unknown, body: unknown) =>
      memberDataEndpoint.handler({
        user,
        payload,
        headers: new Headers(),
        text: async () => JSON.stringify(body),
      } as unknown as PayloadRequest) as Promise<Response>
    const rec = (unitId: string, at: number) => ({ unitId, at, score: 1, total: 1, items: [] })
    const me = (m: Member) => ({ ...m, collection: 'members' })

    it('未登录或后台账号都不行', async () => {
      expect((await call(null, { baseRev: -1, data: {} })).status).toBe(401)
      const admin = (await payload.find({ collection: 'users', limit: 1 })).docs[0]
      expect((await call({ ...admin, collection: 'users' }, { baseRev: -1, data: {} })).status).toBe(401)
    })

    it('数据形状不对整体拒收', async () => {
      expect((await call(me(member), { baseRev: -1, data: { records: [{ unitId: 1 }] } })).status).toBe(400)
      expect((await call(me(member), { baseRev: 'x', data: {} })).status).toBe(400)
    })

    it('A、B 各存各的，互相看不到', async () => {
      await call(me(member), { baseRev: -1, data: { records: [rec('u-a', 1)] } })
      await call(me(other), { baseRev: -1, data: { records: [rec('u-b', 2)] } })
      const a = (await (await call(me(member), { baseRev: -1, data: {} })).json()) as { data: { records: { unitId: string }[] } }
      expect(a.data.records.map((r) => r.unitId)).toEqual(['u-a'])
    })

    it('同一账号并发推送不丢记录', async () => {
      await Promise.all(Array.from({ length: 5 }, (_, i) => call(me(member), { baseRev: 0, data: { records: [rec(`u-p${i}`, 10 + i)] } })))
      const a = (await (await call(me(member), { baseRev: -1, data: {} })).json()) as { data: { records: { unitId: string }[] } }
      for (let i = 0; i < 5; i++) expect(a.data.records.map((r) => r.unitId)).toContain(`u-p${i}`)
    })

    it('考生不能直接读学习数据集合', async () => {
      await expect(payload.find({ collection: 'member-data', ...asMember(member) })).rejects.toThrow()
    })

    it('删除考生时学习数据一起删', async () => {
      const tmp = await payload.create({ collection: 'members', data: { email: 'e2e-access-tmp@example.test', password: 'x'.repeat(32) } })
      await call(me(tmp), { baseRev: -1, data: { records: [rec('u-t', 1)] } })
      await payload.delete({ collection: 'members', id: tmp.id })
      expect((await payload.count({ collection: 'member-data', where: { member: { equals: tmp.id } } })).totalDocs).toBe(0)
    })
  })
})

// 访问矩阵（010 research R5、attack-matrix A5）：遍历全部集合与全局，含插件和 Payload 内部集合。
// 新增集合不在下表里会直接失败，必须先表态
const PUBLIC_READ = [
  'pages', 'posts', 'media', 'categories', 'tests', 'units', 'writing-tasks', 'speaking-questions', 'redirects', 'search',
  'header', 'footer', 'band-scales',
]
const PRIVATE = [
  'users', 'members', 'email-sends', 'login-codes', 'member-data', 'ai-settings', 'mail-settings',
  'credit-entries', 'note-submissions', 'note-screenshots', 'credit-settings', 'writing-reviews', 'answer-explanations', 'explanation-unlocks',
  'payload-folders', 'payload-locked-documents', 'payload-preferences', 'payload-migrations', 'payload-kv', 'payload-jobs',
]
// 谁都不能经 Payload 读写（管理员也不行）：013 词典只由 /api/dict 直接查表
const DENY_ALL = ['dict-entries']
// 考生能读的私有集合：都只限自己的（members 上面"考生列表只看得到自己"已测，011 的三个在 credits.int.spec.ts 测）
const MEMBER_EXTRA_READ = ['members', 'credit-entries', 'note-submissions', 'note-screenshots']

describe('访问矩阵', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })
  // 权限函数只看身份，不查库，假考生即可
  const fakeMember = { id: -1, email: 'e2e-access-matrix@example.test', collection: 'members' }
  // 无条件允许是 true，带条件允许是 { permission: true, where }，拒绝时缺省
  type Perm = boolean | { permission?: boolean } | undefined
  type Results = { collections?: Record<string, Record<string, Perm>>; globals?: Record<string, Record<string, Perm>> }
  const allowed = (r: Results, slug: string, op: string) => {
    const p = (r.collections?.[slug] ?? r.globals?.[slug])?.[op]
    return p === true || Boolean(typeof p === 'object' && p.permission)
  }
  const resultsFor = async (user: unknown) =>
    (await getAccessResults({ req: await createLocalReq({ user: user as never }, payload) })) as Results
  const slugs = () => [
    ...payload.config.collections.map((c) => ({ slug: c.slug, ops: ['create', 'read', 'update', 'delete'] })),
    ...payload.config.globals.map((g) => ({ slug: g.slug, ops: ['read', 'update'] })),
  ]

  it('每个集合 / 全局都在期望表里', () => {
    const unknown = slugs().map((s) => s.slug).filter((s) => !PUBLIC_READ.includes(s) && !PRIVATE.includes(s) && !DENY_ALL.includes(s))
    expect(unknown).toEqual([])
  })

  it('匿名：公开内容只读，其余一律拒绝', async () => {
    const r = await resultsFor(null)
    const got = slugs().flatMap(({ slug, ops }) => ops.filter((op) => allowed(r, slug, op)).map((op) => `${slug}:${op}`))
    expect(got.sort()).toEqual(PUBLIC_READ.map((s) => `${s}:read`).sort())
  })

  it('考生：公开内容只读 + 自己的账号，任何写操作都不行', async () => {
    const r = await resultsFor(fakeMember)
    const got = slugs().flatMap(({ slug, ops }) => ops.filter((op) => allowed(r, slug, op)).map((op) => `${slug}:${op}`))
    expect(got.sort()).toEqual([...PUBLIC_READ, ...MEMBER_EXTRA_READ].map((s) => `${s}:read`).sort())
  })

  it('管理员：本站的私有集合都能读（payload-* 内部集合由 Payload 自己管）', async () => {
    const admin = (await payload.find({ collection: 'users', limit: 1 })).docs[0]
    if (!admin) return
    const r = await resultsFor({ ...admin, collection: 'users' })
    expect(PRIVATE.filter((s) => !s.startsWith('payload-') && !allowed(r, s, 'read'))).toEqual([])
    expect(DENY_ALL.flatMap((s) => ['create', 'read', 'update', 'delete'].filter((op) => allowed(r, s, op)))).toEqual([])
  })
})
