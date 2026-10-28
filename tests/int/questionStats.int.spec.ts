// @vitest-environment node
// 035 题目作答统计：服务端判分、去重、首次作答、限频、模考拆单元、权限
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getMockPaper } from '@/content/mockPaper'
import { getPracticeUnit } from '@/content/practiceUnit'
import { statsEndpoints } from '@/endpoints/stats'
import type { PracticeUnit } from '@/exam/practice'
import { answerLines } from '@/exam/scoring'
import { allow } from '@/stats/limit'
import { drizzle, recordAttempt, whoOf } from '@/stats/record'
import { sql } from '@payloadcms/db-postgres'
import type { Unit } from '@/payload-types'

let payload: Payload
const PREFIX = 'fixture-stats-'
const [postEp] = statsEndpoints
let unit: PracticeUnit
let unitDoc: Unit
let n = 0
const device = () => `00000000-0000-4000-8000-${String(Date.now() % 1e6).padStart(6, '0')}${String(n++).padStart(6, '0')}`

// 去掉数组里的 id，复制成新单元
const strip = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, x]) => [k, strip(x)])) : v

const query = async (q: unknown) => (await drizzle(payload).execute(q)).rows
const tallies = (unitKey: string) =>
  query(sql`SELECT number::int, answer, unknown, credit::int, count::int, first_count::int FROM answer_tallies WHERE unit_key = ${unitKey} ORDER BY number, answer`)
const attempts = (unitKey: string) => query(sql`SELECT unit_id, first, score::int, total::int FROM stat_attempts WHERE unit_key = ${unitKey} ORDER BY id`)

const post = async (body: Record<string, unknown>, user: unknown = null) => {
  const req = { payload, user, headers: new Headers(), text: async () => JSON.stringify(body) } as unknown as PayloadRequest
  return ((await postEp.handler(req)) as Response).status
}

const cleanStats = async (unitKey: string) => {
  await query(sql`DELETE FROM stat_attempts WHERE unit_key = ${unitKey}`)
  await query(sql`DELETE FROM answer_tallies WHERE unit_key = ${unitKey}`)
  await query(sql`DELETE FROM question_keys WHERE unit_key = ${unitKey}`)
}
const cleanup = async () => {
  const old = await payload.find({ collection: 'units', where: { sourceId: { like: PREFIX } }, draft: true, depth: 0, limit: 10, overrideAccess: true })
  for (const u of old.docs) await cleanStats(`u${u.id}`)
  await payload.delete({ collection: 'units', where: { sourceId: { like: PREFIX } }, overrideAccess: true })
}

// 第一题的标准答案（取第一行）和一个肯定错的答案
const firstQ = () => unit.sections[0].groups.flatMap((g) => g.questions.map((q) => ({ g, q })))[0]
const right = () => answerLines(firstQ().q.answers)[0]
const multiQ = () => unit.sections[0].groups.filter((g) => g.type === 'multi_choice').flatMap((g) => g.questions)[0]

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
  // 复制本机题库里一个带多选题的已发布阅读单元（原单元只读不改）
  const src = await payload.find({ collection: 'units', where: { and: [{ _status: { equals: 'published' } }, { module: { equals: 'reading' } }, { exam: { not_in: ['cet4', 'cet6'] } }] }, depth: 0, limit: 300, overrideAccess: true })
  const pick = src.docs.find((u) => u.groups?.some((g) => g.type === 'multi_choice')) ?? src.docs[0]
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = pick
  unitDoc = await payload.create({
    collection: 'units',
    overrideAccess: true,
    draft: false,
    data: { ...(strip(rest) as Unit), title: `${PREFIX}${pick.title}`, sourceId: `${PREFIX}${Date.now()}`, _status: 'published' },
  })
  unit = (await getPracticeUnit(`u${unitDoc.id}`))!
}, 60_000)
afterAll(cleanup)

describe('提交', () => {
  it('服务端判分：客户端传的 items / score 被忽略', async () => {
    const id = device()
    const { q } = firstQ()
    expect(await post({ unitId: unit.id, at: Date.now(), device: id, answers: { [q.number]: 'zzz-wrong' }, score: 99, items: [{ number: q.number, correct: true }] })).toBe(204)
    const [a] = await attempts(unit.id)
    expect(a.score).toBe(0)
    const t = (await tallies(unit.id)).find((r) => r.number === q.number && r.answer === 'zzz-wrong')!
    expect(t.credit).toBe(0)
    expect(t.first_count).toBe(1)
  })

  it('题号不在单元里、作答类型不对、单元不存在、没设备号 → 4xx 且不写', async () => {
    await cleanStats(unit.id)
    const id = device()
    expect(await post({ unitId: unit.id, at: 1, device: id, answers: { 9999: 'x' } })).toBe(400)
    expect(await post({ unitId: unit.id, at: 1, device: id, answers: { [firstQ().q.number]: ['x'] } })).toBe(firstQ().g.type === 'multi_choice' ? 204 : 400)
    expect(await post({ unitId: 'u999999', at: 1, device: id, answers: {} })).toBe(404)
    expect(await post({ unitId: unit.id, at: 1, device: 'not-a-uuid', answers: {} })).toBe(400)
    if (firstQ().g.type !== 'multi_choice') expect(await attempts(unit.id)).toHaveLength(0)
  })

  it('同一次交卷提交 100 次只记 1 次（SC-005）', async () => {
    await cleanStats(unit.id)
    const who = whoOf(null, device())!
    const at = Date.now()
    for (let i = 0; i < 100; i++) await recordAttempt(payload, { who, unit, answers: { [firstQ().q.number]: right() }, at, source: 'live' })
    expect(await attempts(unit.id)).toHaveLength(1)
    const t = (await tallies(unit.id)).find((r) => r.number === firstQ().q.number && r.credit === 1)!
    expect(t.count).toBe(1)
  })

  it('首次作答：第二次不算；u-g 之后的整篇不算；整篇之后再做题组不算', async () => {
    await cleanStats(unit.id)
    const who = whoOf(null, device())!
    await recordAttempt(payload, { who, unit, answers: {}, at: 1, source: 'live' })
    await recordAttempt(payload, { who, unit, answers: {}, at: 2, source: 'live' })
    expect((await attempts(unit.id)).map((a) => a.first)).toEqual([true, false])

    const who2 = whoOf(null, device())!
    const g1 = (await getPracticeUnit(`${unit.id}-g1`))!
    await recordAttempt(payload, { who: who2, unit: g1, answers: {}, at: 3, source: 'live' })
    await recordAttempt(payload, { who: who2, unit, answers: {}, at: 4, source: 'live' })
    const rows = await attempts(unit.id)
    expect(rows.slice(2).map((a) => [a.unit_id, a.first])).toEqual([[`${unit.id}-g1`, true], [unit.id, false]])
  })

  it('多选题算一行：作答排序后连接，credit 为对的个数', async () => {
    const mq = multiQ()
    expect(mq, '本机题库要有一个带多选题的已发布阅读单元').toBeTruthy()
    await cleanStats(unit.id)
    const keys = answerLines(mq.answers)
    const who = whoOf(null, device())!
    await recordAttempt(payload, { who, unit, answers: { [mq.number]: [keys[1], 'Z'] }, at: 5, source: 'live' })
    const row = (await tallies(unit.id)).find((r) => r.number === mq.number)!
    expect(row.answer).toBe([keys[1].toLowerCase(), 'z'].sort().join(', '))
    expect(row.credit).toBe(1)
    expect((await tallies(unit.id)).filter((r) => r.number === mq.number + 1)).toHaveLength(0)
  })

  it('限频：同一考生同一单元 1 分钟第 4 次被丢弃', () => {
    const t = 1_000_000
    expect([1, 2, 3, 4].map((i) => allow('unknown', 'w-limit', 'u1', t + i))).toEqual([true, true, true, false])
    expect(allow('unknown', 'w-limit', 'u1', t + 61_000)).toBe(true)
    expect(Array.from({ length: 21 }, (_, i) => allow('9.9.9.9', `w${i}`, 'u1', t + i)).at(-1)).toBe(false)
  })
})

describe('模考', () => {
  it('m{no}-l 拆成来源单元，各自一条、各自去重', async () => {
    const papers = await payload.find({ collection: 'mock-papers', where: { _status: { equals: 'published' } }, limit: 1, depth: 0, overrideAccess: true })
    expect(papers.docs.length, '本机要有已发布的模考卷').toBeGreaterThan(0)
    const paper = (await getMockPaper(papers.docs[0].no))!
    const ids = paper.l.sections.map((s) => s.groups[0].key.replace(/-g\d+$/, ''))
    const answers = Object.fromEntries(paper.l.sections.map((s) => [s.groups[0].questions[0].number, 'zzz']))
    const body = { unitId: paper.l.id, at: Date.now(), device: null, answers }
    // 直接走接口：同一 who 用账号
    const member = await payload.create({ collection: 'members', overrideAccess: true, data: { email: `e2e-stats-${Date.now()}@example.test`, password: 'x'.repeat(32) } })
    try {
      const user = { ...member, collection: 'members' }
      expect(await post(body, user)).toBe(204)
      expect(await post(body, user)).toBe(204)
      const mw = whoOf(member.id, null)!
      const rows = await query(sql`SELECT unit_id FROM stat_attempts WHERE who = ${mw} ORDER BY unit_id`)
      expect(rows.map((r) => r.unit_id).sort()).toEqual([...ids].sort())
    } finally {
      // 本机库里这几个单元的统计都是测试写的，整个清掉
      for (const id of ids) await cleanStats(id)
      await payload.delete({ collection: 'members', id: member.id, overrideAccess: true })
    }
  })
})

describe('权限与快照', () => {
  it('第一次记入时写好答案快照', async () => {
    await cleanStats(unit.id)
    await recordAttempt(payload, { who: whoOf(null, device())!, unit, answers: {}, at: 6, source: 'live' })
    const keys = await query(sql`SELECT number::int, answers FROM question_keys WHERE unit_key = ${unit.id} ORDER BY number`)
    expect(keys.length).toBe(unit.sections[0].groups.flatMap((g) => g.questions).length)
  })
})

describe('改答案（US1）', () => {
  // 改第一组第一题的答案并发布；groups 保留 id，原样回写
  const setFirstAnswers = async (fn: (old: string) => string, opts: { draft?: boolean; explanation?: string } = {}) => {
    const doc = await payload.findByID({ collection: 'units', id: unitDoc.id, depth: 0, draft: true, overrideAccess: true })
    const groups = structuredClone(doc.groups ?? [])
    const q = groups[0].questions![0]
    q.answers = fn(q.answers)
    if (opts.explanation !== undefined) q.explanation = opts.explanation
    await payload.update({ collection: 'units', id: unitDoc.id, data: { groups, _status: opts.draft ? 'draft' : 'published' }, draft: opts.draft, overrideAccess: true })
  }
  const keyRow = async (number: number) => (await query(sql`SELECT answers, reset_at FROM question_keys WHERE unit_key = ${unit.id} AND number = ${number}`))[0]
  const seed = async (answer: string, times = 1) => {
    for (let i = 0; i < times; i++) await recordAttempt(payload, { who: whoOf(null, device())!, unit, answers: { [firstQ().q.number]: answer, [second()]: 'zzz' }, at: 100 + i, source: 'live' })
  }
  const second = () => unit.sections[0].groups.flatMap((g) => g.questions)[1].number

  beforeAll(async () => {
    await cleanStats(unit.id)
  })

  it('只加一行可接受答案 → 重判、不清零；存草稿不动', async () => {
    const isText = ['completion', 'short_answer', 'labelling'].includes(firstQ().g.type)
    const alt = isText ? 'statsalt' : 'Z'
    await seed(alt, 2)
    const n = firstQ().q.number
    const before = (await tallies(unit.id)).find((r) => r.number === n && r.answer === alt.toLowerCase())!
    expect(before.credit).toBe(0)

    await setFirstAnswers((old) => `${old}\n${alt}`, { draft: true })
    expect((await tallies(unit.id)).find((r) => r.number === n && r.answer === alt.toLowerCase())!.credit).toBe(0)

    await setFirstAnswers((old) => old)
    const after = (await tallies(unit.id)).find((r) => r.number === n && r.answer === alt.toLowerCase())!
    expect(after.credit).toBe(1)
    expect(after.count).toBe(2)
    expect((await keyRow(n)).reset_at).toBeNull()
  })

  it('只改解析不动统计', async () => {
    const n = firstQ().q.number
    const before = await tallies(unit.id)
    await setFirstAnswers((old) => old, { explanation: 'fixture 解析' })
    expect(await tallies(unit.id)).toEqual(before)
    expect((await keyRow(n)).reset_at).toBeNull()
  })

  it('改掉一行 → 这题清零、记 resetAt；同单元其他题不变', async () => {
    const n = firstQ().q.number
    const others = (await tallies(unit.id)).filter((r) => r.number !== n)
    await setFirstAnswers((old) => ['different', ...old.split('\n').slice(1)].join('\n'))
    const rows = await tallies(unit.id)
    expect(rows.filter((r) => r.number === n)).toHaveLength(0)
    expect(rows.filter((r) => r.number !== n)).toEqual(others)
    expect((await keyRow(n)).reset_at).not.toBeNull()
  })

  it('题号不在单元里了 → 删掉它的快照和 tally', async () => {
    await seed('x')
    const doc = await payload.findByID({ collection: 'units', id: unitDoc.id, depth: 0, overrideAccess: true })
    const groups = structuredClone(doc.groups ?? [])
    const last = groups.at(-1)!
    const removed = last.questions!.at(-1)!
    if (last.questions!.length < 2 || (removed.span ?? 1) > 1) return // 删掉会让题组为空或动到多选，跳过
    last.questions = last.questions!.slice(0, -1)
    await payload.update({ collection: 'units', id: unitDoc.id, data: { groups, _status: 'published' }, overrideAccess: true })
    expect((await tallies(unit.id)).filter((r) => r.number === removed.number)).toHaveLength(0)
    expect(await keyRow(removed.number)).toBeUndefined()
    unit = (await getPracticeUnit(`u${unitDoc.id}`))!
  })
})

describe('后台逐题查询（US1）', () => {
  it('min、排序、前 3 个错误答案、未作答；unknown 行不进错误答案；下架后不出现', async () => {
    const { questionRows } = await import('@/stats/read')
    await cleanStats(unit.id)
    const n = firstQ().q.number
    const ans = (a: string) => ({ [n]: a })
    for (const [a, k] of [['wa', 3], ['wb', 2], ['wc', 1], ['wd', 1], ['', 1]] as const)
      for (let i = 0; i < k; i++) await recordAttempt(payload, { who: whoOf(null, device())!, unit, answers: ans(a), at: 200 + i, source: 'live' })
    await recordAttempt(payload, { who: whoOf(null, device())!, unit, answers: {}, at: 300, source: 'backfill', items: [{ groupKey: '', number: n, type: firstQ().g.type, correct: false }] })

    expect((await questionRows(payload, { unitKey: unit.id, min: 100 })).rows).toHaveLength(0)
    const { rows } = await questionRows(payload, { unitKey: unit.id, min: 0 })
    const row = rows.find((r) => r.number === n)!
    expect(row.people).toBe(9) // 8 次实时 + 1 次回填（unknown）
    expect(row.blank).toBe(1) // unknown 行不算未作答
    expect(row.wrong).toEqual([{ a: 'wa', n: 3 }, { a: 'wb', n: 2 }, { a: 'wc', n: 1 }])
    // 没人答对时正确率是 0，不是 null（FILTER 求和为空要 COALESCE）
    expect(row.rate).toBe(0)
    expect(rows.map((r) => r.rate ?? 0)).toEqual([...rows.map((r) => r.rate ?? 0)].sort((a, b) => a - b))

    await payload.update({ collection: 'units', id: unitDoc.id, data: { _status: 'draft' }, overrideAccess: true })
    expect((await questionRows(payload, { unitKey: unit.id, min: 0 })).rows).toHaveLength(0)
    await payload.update({ collection: 'units', id: unitDoc.id, data: { _status: 'published' }, overrideAccess: true })
    expect((await questionRows(payload, { unitKey: unit.id, min: 0 })).rows.length).toBeGreaterThan(0)
  })

  it('回填的无作答记录重复跑只记一次', async () => {
    const who = whoOf(999_000_001, null)!
    const items = [{ groupKey: '', number: firstQ().q.number, type: firstQ().g.type, correct: true }]
    expect(await recordAttempt(payload, { who, unit, answers: {}, at: 400, source: 'backfill', items })).toBe(true)
    expect(await recordAttempt(payload, { who, unit, answers: {}, at: 400, source: 'backfill', items })).toBe(false)
  })
})

describe('单元、题型、前台（US2 / US3 / US4）', () => {
  it('unitRows：没人做过的已发布单元作答 0；按考试、科目筛选', async () => {
    const { unitRows } = await import('@/stats/read')
    await cleanStats(unit.id)
    const all = await unitRows(payload, { exam: 'ielts', module: 'reading', sort: '-count' })
    const mine = all.rows.find((r) => r.unitKey === unit.id)
    expect(mine?.attempts ?? 0).toBe(0)
    expect(all.rows.every((r) => r.exam === 'ielts' && r.module === 'reading')).toBe(true)
    const cet = await unitRows(payload, { exam: 'cet4', module: 'reading' })
    expect(cet.rows.every((r) => r.exam === 'cet4' && r.module === 'reading')).toBe(true)

    // 作答次数降序：做过一次的单元排在没人做过的前面
    await recordAttempt(payload, { who: whoOf(null, device())!, unit, answers: {}, at: 500, source: 'live' })
    const after = await unitRows(payload, { exam: 'ielts', module: 'reading' })
    expect(after.rows[0].attempts).toBeGreaterThanOrEqual(1)
    expect(after.rows.map((r) => r.attempts)).toEqual([...after.rows.map((r) => r.attempts)].sort((a, b) => b - a))
  })

  it('typeRows：汇总等于逐题之和', async () => {
    const { questionRows, typeRows } = await import('@/stats/read')
    await cleanStats(unit.id)
    for (let i = 0; i < 3; i++) await recordAttempt(payload, { who: whoOf(null, device())!, unit, answers: { [firstQ().q.number]: right() }, at: 600 + i, source: 'live' })
    const qs = (await questionRows(payload, { unitKey: unit.id, min: 0 })).rows
    const types = await typeRows(payload, { exam: 'ielts' })
    // 本机库可能还有别的统计：只比这道题型在本单元的人数不超过汇总
    const t = types.find((x) => x.module === 'reading' && x.qType === firstQ().g.type)!
    expect(t.people).toBeGreaterThanOrEqual(qs.filter((q) => q.qType === firstQ().g.type).reduce((n, q) => n + q.people, 0))
  })

  it('unitPublic：19 人不返回、20 人返回；没有任何作答文本', async () => {
    const { unitPublic, doneCounts } = await import('@/stats/read')
    await cleanStats(unit.id)
    const nums = unit.sections.flatMap((s) => s.groups.flatMap((g) => g.questions.map((q) => q.number)))
    const add = (i: number) => recordAttempt(payload, { who: whoOf(null, device())!, unit, answers: { [firstQ().q.number]: i % 2 ? right() : 'secretwrong' }, at: 700 + i, source: 'live' })
    for (let i = 0; i < 19; i++) await add(i)
    let r = await unitPublic(payload, unit.id, nums)
    expect(r.unit).toBeNull()
    expect(r.questions[firstQ().q.number]).toBeUndefined()
    expect((await doneCounts(payload))[unit.id]).toBeUndefined()

    await add(19)
    r = await unitPublic(payload, unit.id, nums)
    expect(r.unit?.people).toBe(20)
    expect(r.questions[firstQ().q.number]).toEqual({ people: 20, rate: 0.5 })
    expect(JSON.stringify(r)).not.toContain('secretwrong')
    expect((await doneCounts(payload))[unit.id]).toBe(20)
  })

  it('beatPercent 边界', async () => {
    const { beatPercent } = await import('@/practice/statClient')
    expect(beatPercent({ 3: 2, 5: 2 }, 3)).toBe(0)
    expect(beatPercent({ 3: 2, 5: 2 }, 6)).toBe(100)
    expect(beatPercent({ 3: 2, 5: 2 }, 5)).toBe(50)
    expect(beatPercent({}, 5)).toBe(0)
  })
})
