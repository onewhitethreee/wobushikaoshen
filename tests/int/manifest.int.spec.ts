import { readFileSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import manifest from '@/app/manifest'
import { THEME_DARK, THEME_LIGHT } from '@/utilities/site'

// 019 PWA：清单字段、图标尺寸、主题色与颜色令牌同值（research R2、R3、R4）
const root = process.cwd()

describe('PWA 清单', () => {
  const m = manifest()

  it('字段', () => {
    expect(m).toMatchObject({
      id: '/',
      name: '我不是考神',
      short_name: '考神',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'zh-CN',
      background_color: '#fcf7ec',
      theme_color: '#fcf7ec',
    })
    expect(m.icons?.map((i) => [i.src, i.sizes, i.purpose])).toEqual([
      ['/icon-192.png', '192x192', 'any'],
      ['/icon-512.png', '512x512', 'any'],
      ['/icon-maskable-512.png', '512x512', 'maskable'],
    ])
  })

  it('图标文件存在且尺寸与清单一致', async () => {
    for (const icon of m.icons ?? []) {
      const meta = await sharp(path.join(root, 'public', icon.src)).metadata()
      expect(`${meta.width}x${meta.height}`).toBe(icon.sizes)
      expect(meta.format).toBe('png')
    }
  })

  it('主题色等于浅色 / 深色的 --gray-1', () => {
    const css = readFileSync(path.join(root, 'src/app/(frontend)/globals.css'), 'utf8')
    const grays = [...css.matchAll(/--gray-1:\s*(#[0-9a-f]{6})/gi)].map((x) => x[1].toLowerCase())
    expect(grays.slice(0, 2)).toEqual([THEME_LIGHT, THEME_DARK])
  })
})
