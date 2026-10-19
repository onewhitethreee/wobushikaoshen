import { describe, expect, it } from 'vitest'

import { isSyncData, mergeData } from '@/account/sync'
import { canon, checkWord, compare, pickBlanks } from '@/practice/dictation'
import { emptyStore, recordDictation, type DictEntry } from '@/practice/store'

// 023 听写宽松比对（research R1–R3）
const same = (a: string, b: string) => expect(canon(a).map((t) => t.t)).toEqual(canon(b).map((t) => t.t))

describe('canon 等价', () => {
  it('大小写、标点、多余空格', () => same('Hello,  World!', 'hello world'))
  it('连字符拆词；撇号所有格', () => {
    same('well-known', 'well known')
    same("the woman's bag", 'the womans bag')
  })
  it('缩写', () => {
    same("don't", 'do not')
    same("can't", 'can not')
    same("won't", 'will not')
    same("I'm", 'I am')
    same("they're", 'they are')
    same("we'll", 'we will')
    same("I've", 'I have')
    same("she'd", 'she would')
    same("let's", 'let us')
    same("it's", 'it is')
    same("there's", 'there is')
  })
  it('数字', () => {
    same('15', 'fifteen')
    same('twenty-five', '25')
    same('twenty five people', '25 people')
    same('one hundred and twenty', '120')
    same('2,000', 'two thousand')
    same('three hundred', '300')
  })
  it('英美拼写', () => {
    same('colour', 'color')
    same('favourite', 'favorite')
    same('centre', 'center')
    same('kilometres', 'kilometers')
    same('organise', 'organize')
    same('organisation', 'organization')
    same('analyse', 'analyze')
    same('travelling', 'traveling')
    same('cancelled', 'canceled')
    same('grey', 'gray')
    same('programme', 'program')
    same('licence', 'license')
  })
  it('不同的词不等价', () => {
    expect(canon('filled')[0].t).not.toBe(canon('filed')[0].t)
    expect(canon('for')[0].t).not.toBe(canon('four')[0].t)
  })
})

describe('compare', () => {
  const st = (r: ReturnType<typeof compare>) => r.words.map((w) => w.status)

  it('照原文写（大小写、标点不同）全对', () => {
    const r = compare('They need to do a course, which begins on the 27th of June.', 'they need to do a course which begins on the 27th of june')
    expect(r.ok).toBe(true)
    expect(st(r).every((s) => s === 'ok')).toBe(true)
  })

  it('漏一个词 → 缺；写错一个词 → 错并带上我写的', () => {
    const r = compare('I think he needs to build his confidence', 'I think he need to build confidence')
    expect(r.ok).toBe(false)
    expect(r.words.map((w) => [w.text, w.status, w.typed])).toEqual([
      ['I', 'ok', undefined],
      ['think', 'ok', undefined],
      ['he', 'ok', undefined],
      ['needs', 'wrong', 'need'],
      ['to', 'ok', undefined],
      ['build', 'ok', undefined],
      ['his', 'missing', undefined],
      ['confidence', 'ok', undefined],
    ])
    expect(r.extra).toEqual([])
  })

  it('多写的词单独列出', () => {
    const r = compare('That is fine', 'that is very fine')
    expect(st(r)).toEqual(['ok', 'ok', 'ok'])
    expect(r.extra).toEqual(['very'])
    expect(r.ok).toBe(false)
  })

  it('数字词跨两个原词：两个词状态一致', () => {
    expect(st(compare('twenty five people', '25 people'))).toEqual(['ok', 'ok', 'ok'])
    expect(st(compare('twenty five people', '26 people'))).toEqual(['wrong', 'wrong', 'ok'])
  })

  it('空输入全缺', () => {
    const r = compare('Good morning', '')
    expect(st(r)).toEqual(['missing', 'missing'])
    expect(r.ok).toBe(false)
  })
})

describe('pickBlanks / checkWord', () => {
  it('答案词优先，再取长实词，最多 3 个', () => {
    const text = 'Well, my daughter would like to try surfing this wonderful summer holiday'
    const blanks = pickBlanks(text, ['surfing'])
    const words = text.split(/\s+/)
    expect(blanks.map((i) => words[i])).toContain('surfing')
    expect(blanks.length).toBeLessThanOrEqual(3)
    expect(blanks.map((i) => words[i])).not.toContain('would')
  })
  it('答案带可省略部分：(the) river bank → 挖 river、bank', () => {
    const text = 'We walked along the river bank yesterday afternoon'
    const words = text.split(/\s+/)
    expect(pickBlanks(text, ['(the) river bank']).slice(0, 2).map((i) => words[i]).sort()).toEqual(['bank', 'river'])
  })
  it('短句不挖', () => expect(pickBlanks('Part one.', [])).toEqual([]))
  it('判定用同样的宽松规则', () => {
    expect(checkWord('colour.', 'Color')).toBe(true)
    expect(checkWord('fifteen', '15')).toBe(true)
    expect(checkWord('surfing', 'surfin')).toBe(false)
  })
})

describe('听写错句的存储与同步', () => {
  const e = (at: number, extra: Partial<DictEntry> = {}): DictEntry => ({ at, unitId: 'u1', n: 3, text: 'Hello world', input: 'hello', mode: 'full', state: 'wrong', ...extra })

  it('有错记 wrong；全对且已在 → mastered；全对且不在 → 不记', () => {
    const s = emptyStore()
    recordDictation(s, { at: 1, unitId: 'u1', n: 1, text: 'a b', input: 'a', mode: 'full' }, true)
    expect(s.dictation).toEqual({})
    recordDictation(s, { at: 2, unitId: 'u1', n: 1, text: 'a b', input: 'a', mode: 'full' }, false)
    expect(s.dictation['u1#1#full'].state).toBe('wrong')
    // 挖空写对不抵消整句的错
    recordDictation(s, { at: 3, unitId: 'u1', n: 1, text: 'a b', input: 'b', mode: 'blank' }, true)
    expect(s.dictation['u1#1#full'].state).toBe('wrong')
    expect(s.dictation['u1#1#blank']).toBeUndefined()
    recordDictation(s, { at: 4, unitId: 'u1', n: 1, text: 'a b', input: 'a b', mode: 'full' }, true)
    expect(s.dictation['u1#1#full']).toMatchObject({ state: 'mastered', input: 'a b', at: 4 })
  })

  it('合并取新；校验拒绝超长和非法值', () => {
    const m = mergeData({ dictation: { 'u1#3': e(1) } }, { dictation: { 'u1#3': e(2, { state: 'mastered' }) } })
    expect(m.dictation!['u1#3'].state).toBe('mastered')
    expect(isSyncData({ dictation: { 'u1#3': e(1) } })).toBe(true)
    expect(isSyncData({ dictation: { 'u1#3': e(1, { text: 'x'.repeat(501) }) } })).toBe(false)
    expect(isSyncData({ dictation: { 'u1#3': { ...e(1), state: 'done' } } })).toBe(false)
    expect(isSyncData({ dictation: { 'u1#3': e(1, { n: -1 }) } })).toBe(false)
  })
})
