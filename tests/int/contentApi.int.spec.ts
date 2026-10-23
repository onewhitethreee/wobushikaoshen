import { describe, expect, it } from 'vitest'

import { validateUnit, type UnitData } from '@/exam/validate'
import { EXAMPLE, FORMAT } from '@/contentApi/format'
import { badKeys, badKeyWait, BAD_KEY_LIMIT, bearer, hashKey, newKey, recordBadKey, verifyKey } from '@/contentApi/key'
import { cnDate, dayStart } from '@/contentApi/quota'
import { checkRequest, decodeFiles, MAX_IMAGE } from '@/contentApi/request'

// 029 内容接口：密钥、北京时间日界、请求检查、配图、格式说明示例
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const JPG = Buffer.from('ffd8ffe000104a464946', 'hex')
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')])
const b64 = (b: Buffer) => b.toString('base64')
const unit = (over: Record<string, unknown> = {}) => ({ ...EXAMPLE.data[0], sourceId: 'e2e-int-1', ...over })

describe('密钥', () => {
  it('cak_ 前缀、每次不同、只认对应摘要', () => {
    const a = newKey()
    const b = newKey()
    expect(a).toMatch(/^cak_[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
    const h = hashKey(a)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(verifyKey(a, h)).toBe(true)
    expect(verifyKey(b, h)).toBe(false)
    expect(verifyKey(a, '')).toBe(false)
    expect(verifyKey(a, null)).toBe(false)
    expect(verifyKey('', h)).toBe(false)
    expect(verifyKey(a, 'abcd')).toBe(false)
  })

  it('Bearer 头', () => {
    expect(bearer(new Headers({ authorization: 'Bearer cak_x' }))).toBe('cak_x')
    expect(bearer(new Headers({ authorization: 'bearer  cak_x ' }))).toBe('cak_x')
    expect(bearer(new Headers({ authorization: 'JWT cak_x' }))).toBeNull()
    expect(bearer(new Headers())).toBeNull()
  })

  it('同一地址一小时错 20 次后暂停，窗口滑过恢复', () => {
    badKeys.clear()
    const t = Date.UTC(2026, 9, 23)
    for (let i = 0; i < BAD_KEY_LIMIT - 1; i++) recordBadKey('1.2.3.4', t + i)
    expect(badKeyWait('1.2.3.4', t + 100)).toBeNull()
    recordBadKey('1.2.3.4', t + 100)
    expect(badKeyWait('1.2.3.4', t + 200)).toBeGreaterThan(3500)
    expect(badKeyWait('5.6.7.8', t + 200)).toBeNull()
    expect(badKeyWait('1.2.3.4', t + 60 * 60 * 1000 + 50)).toBeNull()
  })
})

describe('北京时间日界', () => {
  it('当天 0 点与日期', () => {
    // 北京时间 2026-10-23 07:59 = UTC 10-22 23:59
    expect(dayStart(new Date('2026-10-22T23:59:00Z')).toISOString()).toBe('2026-10-22T16:00:00.000Z')
    // 北京时间 10-23 23:59 仍是同一天
    expect(dayStart(new Date('2026-10-23T15:59:00Z')).toISOString()).toBe('2026-10-22T16:00:00.000Z')
    // 北京时间 10-24 00:00 换日
    expect(dayStart(new Date('2026-10-23T16:00:00Z')).toISOString()).toBe('2026-10-23T16:00:00.000Z')
    expect(cnDate(new Date('2026-10-22T16:00:00Z'))).toBe('2026-10-23')
  })
})

describe('checkRequest', () => {
  it('合规的单元：去掉系统字段，改写来源标记', () => {
    const r = checkRequest({ publish: true, data: [unit({ summary: [1], pendingCount: 3, paraphrases: {}, viaApi: false, _status: 'published', id: 9, sourceTag: '9月高频', sourceSets: '' })] })
    expect(r.errors).toEqual([])
    expect(r.publish).toBe(true)
    const it = r.items[0]
    for (const k of ['summary', 'pendingCount', 'paraphrases', '_status', 'id']) expect(it).not.toHaveProperty(k)
    expect(it).toMatchObject({ viaApi: true, sourceTag: '每日精选', sourceSets: '内容接口' })
    expect(checkRequest({ data: [unit()] }).items[0].sourceSets).toBe('Example Science Weekly')
    expect(checkRequest({ data: [unit()] }).publish).toBe(false)
  })

  it('module、sourceType、sourceUrl', () => {
    const errs = (o: Record<string, unknown>) => checkRequest({ data: [unit(o)] }).errors
    expect(errs({ module: 'listening' })).toEqual(['第 1 项（e2e-int-1）：module 只能是 reading'])
    expect(errs({ sourceType: 'repost' })[0]).toContain('sourceType 只能是')
    expect(errs({ sourceType: 'original' })[0]).toContain('sourceType 只能是')
    expect(errs({ sourceUrl: undefined })).toEqual(['第 1 项（e2e-int-1）：缺少原文链接 sourceUrl'])
    expect(errs({ sourceUrl: 'ftp://x.com/a' })[0]).toContain('http:// 或 https://')
    expect(errs({ sourceType: 'ai_generated' })).toEqual([])
  })

  it('数量与形状', () => {
    expect(checkRequest({ data: [] }).errors[0]).toContain('非空数组')
    expect(checkRequest(null).errors[0]).toContain('JSON 对象')
    expect(checkRequest([unit()]).errors[0]).toContain('JSON 对象')
    expect(checkRequest({ data: Array.from({ length: 11 }, (_, i) => unit({ sourceId: `e2e-${i}` })) }).errors).toContain('一次最多上传 10 个单元，本次 11 个，请分批')
    expect(checkRequest({ publish: 'yes', data: [unit()] }).errors).toContain('publish 必须是 true 或 false')
  })
})

describe('decodeFiles', () => {
  it('三种格式按文件头通过，可带 data: 前缀', () => {
    const r = decodeFiles([
      { name: 'a.png', data: `data:image/png;base64,${b64(PNG)}` },
      { name: 'b.jpg', data: b64(JPG) },
      { name: 'c.JPEG', data: b64(JPG) },
      { name: 'd.webp', data: b64(WEBP) },
    ])
    expect(r.errors).toEqual([])
    expect([...r.files.keys()]).toEqual(['a.png', 'b.jpg', 'c.JPEG', 'd.webp'])
    expect(r.files.get('a.png')!.data.equals(PNG)).toBe(true)
    expect(decodeFiles(undefined)).toEqual({ errors: [], files: new Map() })
  })

  it('不合规的都报错', () => {
    const errs = (files: unknown) => decodeFiles(files).errors
    expect(errs([{ name: 'a.png', data: b64(JPG) }])[0]).toContain('与扩展名不符')
    expect(errs([{ name: 'a.svg', data: b64(Buffer.from('<svg/>')) }])[0]).toContain('不合规')
    expect(errs([{ name: 'a.gif', data: b64(Buffer.from('GIF89a')) }])[0]).toContain('不合规')
    expect(errs([{ name: '../a.png', data: b64(PNG) }])[0]).toContain('不合规')
    expect(errs([{ name: '图.png', data: b64(PNG) }])[0]).toContain('不合规')
    expect(errs([{ name: 'a.png', data: b64(PNG) }, { name: 'a.png', data: b64(PNG) }])[0]).toContain('重复')
    expect(errs([{ name: 'a.png', data: '%%%not base64' }])[0]).toContain('base64')
    expect(errs([{ name: 'a.png', data: b64(Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE)])) }])[0]).toContain('超过 2 MB')
    expect(errs([{ name: 'a.png', data: b64(Buffer.from('hello world')) }])[0]).toContain('不是 png / jpg / webp')
    expect(errs({ name: 'a.png' })[0]).toContain('必须是数组')
  })
})

describe('格式说明', () => {
  it('示例换个 sourceId 就能通过接口检查和单元校验', () => {
    const r = checkRequest({ ...EXAMPLE, data: [unit()] })
    expect(r.errors).toEqual([])
    expect(validateUnit(r.items[0] as UnitData)).toEqual([])
  })

  it('不出现商标字样', () => {
    expect(FORMAT + JSON.stringify(EXAMPLE)).not.toMatch(/ielts/i)
  })
})
