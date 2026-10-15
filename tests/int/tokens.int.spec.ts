import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// 006 FR-030 / SC-003：语义令牌的文字 / 底色对比度（浅色、深色两套），配对见 specs/006-color-system/contracts/palette.md
// 006 SC-004：前台组件里不出现颜色字面量
// 宪章原则 VIII：globals.css 里没有紫色（OKLCH 色相 270°–330° 且彩度 > 0.03）
const root = path.resolve(__dirname, '../..')
const css = fs.readFileSync(path.join(root, 'src/app/(frontend)/globals.css'), 'utf8')

const block = (selector: string) => {
  const start = css.indexOf(selector + ' {')
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

type RGBA = [number, number, number, number]
const parse = (v: string): RGBA => {
  const hex = /^#([0-9a-f]{6})$/i.exec(v)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as RGBA
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(v)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] ? Number(rgb[4]) : 1]
  throw new Error(`无法解析颜色 ${v}`)
}
/** 半透明色叠加到不透明底色上 */
const over = (c: RGBA, base: RGBA): RGBA => [0, 1, 2].map((i) => c[i] * c[3] + base[i] * (1 - c[3])).concat(1) as RGBA
const lum = ([r, g, b]: RGBA) =>
  [r, g, b]
    .map((x) => x / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (a: RGBA, b: RGBA) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TEXT: [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['sun-foreground', 'sun'],
  ['mark-foreground', 'mark'],
  // 题号、选项字母、对错圆标：页面底色的字压在实心成功色 / 错误色上
  ['background', 'success'],
  ['background', 'error'],
  ...['success', 'warning', 'error'].flatMap((k): [string, string][] => [
    [k, 'background'],
    [k, 'chip'],
    [k, `${k}-soft`],
  ]),
]
const GRAPHIC: [string, string][] = [
  ['input', 'background'],
  ['ring', 'background'],
  ['mark', 'background'],
  ['primary', 'background'],
]

for (const [theme, selector] of [
  ['浅色', ':root'],
  ['深色', "[data-theme='dark']"],
] as const) {
  describe(`${theme}令牌对比度`, () => {
    // 深色块只覆盖取值，未覆盖的沿用 :root；var(--x) 在同一主题内解析
    const t = { ...block(':root'), ...block(selector) }
    const resolve = (v: string): string => {
      const ref = /^var\(--([\w-]+)\)$/.exec(v)
      return ref ? resolve(t[ref[1]]) : v
    }
    const card = parse(resolve(t.card))
    const color = (k: string) => over(parse(resolve(t[k])), card)
    for (const [fg, bg] of TEXT)
      it(`${fg} 在 ${bg} 上 ≥ 4.5`, () => expect(ratio(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5))
    for (const [fg, bg] of GRAPHIC)
      it(`${fg} 在 ${bg} 上 ≥ 3`, () => expect(ratio(color(fg), color(bg))).toBeGreaterThanOrEqual(3))
  })
}

describe('前台组件无颜色字面量', () => {
  const dirs = ['src/app/(frontend)', 'src/components', 'src/Header', 'src/Footer'].map((d) => path.join(root, d))
  const files = dirs.flatMap((d) =>
    fs
      .readdirSync(d, { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.tsx'))
      .map((f) => path.join(f.parentPath, f.name)),
  )
  for (const f of files) {
    it(path.relative(root, f), () => {
      const hits = fs.readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []
      expect(hits).toEqual([])
    })
  }
})

/** sRGB 十六进制 → OKLCH 的彩度与色相（Björn Ottosson 的 OKLab 矩阵） */
const oklch = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { c: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 }
}

describe('禁用紫色', () => {
  it('换算自检：#7c3aed 是紫色，#2f6e73 不是', () => {
    expect(oklch('#7c3aed').h).toBeGreaterThan(270)
    expect(oklch('#2f6e73').h).toBeLessThan(270)
  })
  it('globals.css 中没有紫色取值', () => {
    const purple = [...new Set(css.match(/#[0-9a-fA-F]{6}/g) ?? [])].filter((hex) => {
      const { c, h } = oklch(hex)
      return c > 0.03 && h >= 270 && h <= 330
    })
    expect(purple).toEqual([])
  })
})
