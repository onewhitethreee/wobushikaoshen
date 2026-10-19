import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { cardContent, fileName, INK, MUTED, PAPER, qrTarget } from '@/practice/shareCard'

// 025 成绩分享卡片：内容整理与二维码目标（research R1–R4）
describe('shareCard', () => {
  it('文件名', () => {
    expect(fileName(new Date('2026-10-19T21:30').getTime())).toBe('我不是考神-成绩-20261019.png')
  })

  it('二维码：有链接且勾选 → 邀请链接；否则首页', () => {
    const link = 'https://wobushikaoshen.com/i/KFPUAD84'
    expect(qrTarget({ link, include: true, origin: 'https://wobushikaoshen.com' })).toEqual({ url: link, caption: '扫码注册，你和我都能领额度', code: 'KFPUAD84' })
    for (const o of [{ link, include: false }, { link: null, include: true }])
      expect(qrTarget({ ...o, origin: 'https://wobushikaoshen.com' })).toEqual({ url: 'https://wobushikaoshen.com/', caption: '扫码免费练听力阅读', code: null })
  })

  it('卡片内容：科目行、正确率取整、Band 只在整套、用时', () => {
    const base = { module: 'reading' as const, part: 'Passage 1', title: 'Carnivorous Plants', score: 9, total: 13, at: new Date('2026-10-19T10:00').getTime() }
    expect(cardContent(base)).toEqual({
      subject: '阅读 · Passage 1',
      title: 'Carnivorous Plants',
      score: '9 / 13',
      percent: '69%',
      band: null,
      time: null,
      date: '2026 年 10 月 19 日',
    })
    expect(cardContent({ ...base, module: 'listening', part: 'Part 2', band: 7, duration: 1122 })).toMatchObject({ subject: '听力 · Part 2', band: '7', time: '18:42' })
    expect(cardContent({ ...base, band: 7.5 }).band).toBe('7.5')
  })

  it('图片配色与浅色主题令牌相同', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8')
    const v = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1].toLowerCase()
    expect([PAPER, INK, MUTED]).toEqual([v('gray-1'), v('gray-12'), v('gray-11')])
  })
})
