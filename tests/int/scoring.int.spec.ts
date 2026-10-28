import { describe, expect, it } from 'vitest'

import { countWords, expandOptional, isCorrect, numberToWords, scoreMulti } from '@/exam/scoring'

// FR-070 每条规则至少一个判对、一个判错（SC-006）
const fill = (maxWords?: number, numberAllowed = false) => ({ type: 'completion' as const, maxWords, numberAllowed })

describe('判分规则', () => {
  it('忽略大小写和首尾空格', () => {
    expect(isCorrect(' River Bank ', 'river bank', fill())).toBe(true)
    expect(isCorrect('River Banks', 'river bank', fill())).toBe(false)
  })

  it('可选词 (the) 两种写法都对', () => {
    expect(expandOptional('(the) river bank').sort()).toEqual(['river bank', 'the river bank'])
    expect(isCorrect('river bank', '(the) river bank', fill())).toBe(true)
    expect(isCorrect('the river bank', '(the) river bank', fill())).toBe(true)
    expect(isCorrect('bank', '(the) river bank', fill())).toBe(false)
  })

  it('多个可接受答案任一即对', () => {
    expect(isCorrect('March 15', '15 March\nMarch 15', fill())).toBe(true)
    expect(isCorrect('March 16', '15 March\nMarch 15', fill())).toBe(false)
  })

  it('数字和英文单词写法互通', () => {
    expect(numberToWords(21)).toBe('twenty-one')
    expect(numberToWords(105)).toBe('one hundred and five')
    expect(isCorrect('fifteen', '15', fill())).toBe(true)
    expect(isCorrect('15', 'fifteen', fill())).toBe(true)
    expect(isCorrect('twenty one', '21', fill())).toBe(true)
    expect(isCorrect('16', '15', fill())).toBe(false)
  })

  it('超过字数限制直接判错', () => {
    expect(isCorrect('river bank', '(the) river bank', fill(2))).toBe(true)
    expect(isCorrect('the river bank', '(the) river bank', fill(2))).toBe(false)
  })

  it('AND/OR A NUMBER：数字不计入字数', () => {
    expect(countWords('25 Hill Street', true)).toBe(2)
    expect(countWords('22nd January', true)).toBe(1)
    expect(countWords('£8.50', true)).toBe(0)
    expect(countWords('4.30pm', true)).toBe(0)
    expect(countWords('22nd January', false)).toBe(2)
    expect(countWords('HE25 4EU', true)).toBe(0)
    expect(isCorrect('25 Hill Street', '25 Hill Street', fill(2, true))).toBe(true)
    expect(isCorrect('25 Hill Street', '25 Hill Street', fill(2, false))).toBe(false)
  })

  it('带连字符的词算一个词', () => {
    expect(countWords('well-known area')).toBe(2)
    expect(isCorrect('well-known area', 'well-known area', fill(2))).toBe(true)
    expect(isCorrect('well known area', 'well-known area', fill(2))).toBe(false)
  })

  it('拼写必须正确', () => {
    expect(isCorrect('rivr bank', 'river bank', fill())).toBe(false)
  })

  it('多选按交集计分，与顺序无关', () => {
    expect(scoreMulti(['C', 'A'], 'A\nC')).toBe(2)
    expect(scoreMulti(['A', 'B'], 'A\nC')).toBe(1)
    expect(scoreMulti(['B', 'D'], 'A\nC')).toBe(0)
  })

  it('判断题完全一致才对', () => {
    expect(isCorrect('not given', 'NOT GIVEN', { type: 'tfng' })).toBe(true)
    expect(isCorrect('NG', 'NOT GIVEN', { type: 'tfng' })).toBe(false)
  })

  it('选择题比较选项字母', () => {
    expect(isCorrect('b', 'B', { type: 'single_choice' })).toBe(true)
    expect(isCorrect('C', 'B', { type: 'single_choice' })).toBe(false)
  })

  it('全角字母、数字、空格按半角判', () => {
    expect(isCorrect('Ｒｉｖｅｒ　Ｂａｎｋ', 'river bank', fill())).toBe(true)
    expect(isCorrect('１５', 'fifteen', fill())).toBe(true)
    expect(isCorrect('１６', 'fifteen', fill())).toBe(false)
  })

  // 2026-10-27 放宽：AI 审核答案时发现的、雅思评分都算对的写法
  it('序数词：18th、eighteenth、18 互通', () => {
    expect(isCorrect('eighteenth', '18th', fill())).toBe(true)
    expect(isCorrect('18', '18th', fill())).toBe(true)
    expect(isCorrect('twenty-first', '21st', fill())).toBe(true)
    expect(isCorrect('seventeenth', '18th', fill())).toBe(false)
  })

  it('日期：日月顺序、the / of、序数写法互通', () => {
    expect(isCorrect('26 September', 'September 26th\nSeptember 26', fill())).toBe(true)
    expect(isCorrect('January the twelfth', '12 January', fill())).toBe(true)
    expect(isCorrect('the 12th of January', 'January 12', fill())).toBe(true)
    expect(isCorrect('24 August 1979', 'August 24th 1979', fill())).toBe(true)
    expect(isCorrect('27 September', 'September 26', fill())).toBe(false)
    expect(isCorrect('26 October', 'September 26', fill())).toBe(false)
  })

  it('长串数字（电话、编号）忽略中间的空格和连字符', () => {
    expect(isCorrect('89460733', '8946 0733', fill())).toBe(true)
    expect(isCorrect('077896245', '077-896-245', fill())).toBe(true)
    expect(isCorrect('0407 625 4633', '04076254633', fill())).toBe(true)
    expect(isCorrect('89460734', '8946 0733', fill())).toBe(false)
    expect(isCorrect('018699925', '018 669 925', fill())).toBe(false)
  })

  it('英美拼写互通', () => {
    expect(isCorrect('theater', 'Theatre', fill())).toBe(true)
    expect(isCorrect('organizational', 'organisational', fill())).toBe(true)
    expect(isCorrect('color', 'colour', fill())).toBe(true)
    expect(isCorrect('theatres', 'Theatre', fill())).toBe(false)
  })

  it('连字符和空格互通，但字数照算', () => {
    expect(isCorrect('cost effective', 'cost effective', fill())).toBe(true)
    expect(isCorrect('cost-effective', 'cost effective', fill())).toBe(true)
    expect(isCorrect('cost effective', 'cost-effective', fill())).toBe(true)
    expect(isCorrect('cost effective', 'cost-effective', fill(1))).toBe(false)
  })

  it('百分比：% 与 percent / per cent 互通', () => {
    expect(isCorrect('1.3 percent', '1.3%', fill())).toBe(true)
    expect(isCorrect('50 per cent', '50%', fill())).toBe(true)
    expect(isCorrect('1.4%', '1.3%', fill())).toBe(false)
  })

  it('AND/OR A NUMBER：用英文写的数字同样不计字数', () => {
    expect(countWords('four weeks', true)).toBe(1)
    expect(countWords('twenty-one days', true)).toBe(1)
    expect(countWords('four weeks', false)).toBe(2)
    expect(isCorrect('four weeks', '4 weeks', fill(1, true))).toBe(true)
    expect(isCorrect('four long weeks', '4 weeks', fill(1, true))).toBe(false)
  })

  it('放宽后单复数、拼错仍然判错', () => {
    expect(isCorrect('colleague', 'colleagues', fill())).toBe(false)
    expect(isCorrect('satellite', 'satellites', fill())).toBe(false)
    expect(isCorrect('Grately', 'Grateley', fill())).toBe(false)
  })
})
