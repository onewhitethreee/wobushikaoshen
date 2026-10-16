// @vitest-environment node
// 查词（013 FR-002、FR-003、research R1–R2）：候选词规则、CSV 解析、导入规则、接口
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dictEndpoint } from '@/endpoints/dict'
import { candidates, clean } from '@/vocab/lookup'
import { buildRows, csvParser } from '../../scripts/import-dict'

describe('候选词', () => {
  it.each([
    ['Studies', ['studies']],
    ["company's", ["company's", 'company', 'companys']],
    ["you'll", ["you'll", 'you', 'youll']],
    ['don’t', ["don't", 'don', 'dont']],
    ['well-known', ['well-known', 'well']],
    ['"mitigate,"', ['mitigate']],
  ])('%s', (raw, out) => expect(candidates(raw)).toEqual(out))

  it('数字、中文、空白、超长都不是单词', () => {
    for (const raw of ['123', '中文', '  ', '', 'a'.repeat(65), 'abc123']) expect(clean(raw)).toBeNull()
  })
})

describe('导入', () => {
  it('CSV：引号里的逗号、跨行、"" 转义', () => {
    const parse = csvParser()
    expect(parse('a,"b, c","say ""hi"""')).toEqual(['a', 'b, c', 'say "hi"'])
    expect(parse('x,"line1')).toBeNull()
    expect(parse('line2",y')).toEqual(['x', 'line1\nline2', 'y'])
  })

  it('小写键、优先原本小写的行、跳过非单词和无释义、补出没有单独一行的变形', () => {
    const { rows, forms } = buildRows([
      { word: 'North', phonetic: 'n', translation: '北（大写行）', exchange: '' },
      { word: 'north', phonetic: 'n', translation: '北', exchange: '' },
      { word: 'trip', phonetic: 't', translation: '旅行', exchange: 's:trips/p:tripped' },
      { word: 'tripped', phonetic: '', translation: '绊倒（过去式）', exchange: '0:trip/1:p' },
      { word: 'C++', phonetic: '', translation: '语言', exchange: '' },
      { word: 'empty', phonetic: '', translation: '  ', exchange: '' },
    ])
    const by = Object.fromEntries(rows.map((r) => [r.word, r]))
    expect(by.north.translation).toBe('北')
    expect(by['c++']).toBeUndefined()
    expect(by.empty).toBeUndefined()
    expect(by.trips).toMatchObject({ lemma: 'trip', translation: '' })
    expect(by.tripped.translation).toBe('绊倒（过去式）') // 自己有行的不补
    expect(forms).toBe(1)
  })
})

describe('GET /api/dict', () => {
  let payload: Payload
  // fixture 词不会和真实词条撞键；测完删除
  const rows = [
    ['fixturestudy', "'fixture", 'n. 测试研究\\nvt. 测试学习', 's:fixturestudies/p:fixturestudied', null],
    ['fixturestudied', null, 'vt. 测试学习（过去式）', '0:fixturestudy/1:pd', null],
    ['fixturestudies', null, null, '0:fixturestudy/1:s', 'fixturestudy'],
  ] as const
  type Db = { execute: (q: unknown) => Promise<unknown> }
  const db = () => (payload.db as unknown as { drizzle: Db }).drizzle
  const clear = () => db().execute(sql`DELETE FROM dict_entries WHERE word LIKE 'fixture%'`)
  const get = (w: string) =>
    dictEndpoint.handler({ payload, searchParams: new URLSearchParams({ w }) } as unknown as PayloadRequest) as Promise<Response>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await clear()
    for (const [word, phonetic, translation, exchange, lemma] of rows)
      await db().execute(sql`INSERT INTO dict_entries (word, phonetic, translation, exchange, lemma) VALUES (${word}, ${phonetic}, ${translation}, ${exchange}, ${lemma})`)
  })
  afterAll(clear)

  it('命中原形：释义按行拆开，带缓存头', async () => {
    const res = await get('Fixturestudy')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    expect(await res.json()).toEqual({ word: 'fixturestudy', phonetic: "'fixture", meanings: ['n. 测试研究', 'vt. 测试学习'] })
  })

  it('自己有释义的变形词：返回原形，form 带上 1: 的全部类型', async () => {
    expect(await (await get('fixturestudied')).json()).toMatchObject({ word: 'fixturestudy', form: { word: 'fixturestudied', type: 'pd' } })
  })

  it('只有 lemma 的补充行：返回原形', async () => {
    expect(await (await get('fixturestudies')).json()).toMatchObject({ word: 'fixturestudy', form: { word: 'fixturestudies', type: 's' } })
  })

  it('查不到 404，不是单词 400', async () => {
    expect((await get('fixturenothing')).status).toBe(404)
    expect((await get('42')).status).toBe(400)
    expect((await get('x'.repeat(65))).status).toBe(400)
  })
})
