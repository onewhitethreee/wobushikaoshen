/**
 * 006 色阶生成：OKLCH → 12 级 sRGB 十六进制，浅色、深色各一套（深色单独设定明度，不反转）。
 * 每级用途见 specs/006-color-system/data-model.md。
 *
 *   npx tsx scripts/palette.ts gray=85 sun=82,0.835,0.168,0.835 teal=202,0.5,0.065,0.62 ok=150,0.6,0.13 err=27,0.55,0.17
 *
 * `名称=色相,第9级明度,第9级彩度[,深色第9级明度]`；只给色相的是中性灰（暖纸方向，research R10）。
 * 输出可直接贴进 globals.css 的 CSS 变量。
 */

type RGB = [number, number, number]

/** OKLCH → 线性 sRGB（Björn Ottosson 的 OKLab 矩阵） */
const oklchToLinear = (l: number, c: number, h: number): RGB => {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}
const encode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
const inGamut = (rgb: RGB) => rgb.every((x) => x >= -1e-4 && x <= 1 + 1e-4)

/** 超出 sRGB 时按 0.002 步长降彩度，直到可显示 */
export const oklchToHex = (l: number, c: number, h: number): string => {
  let lin = oklchToLinear(l, c, h)
  while (!inGamut(lin) && c > 0) lin = oklchToLinear(l, (c = Math.max(0, c - 0.002)), h)
  return '#' + lin.map((x) => Math.round(Math.min(1, Math.max(0, encode(x))) * 255).toString(16).padStart(2, '0')).join('')
}

// 第 9、10 级由参数决定；其余级的明度固定，彩度按第 9 级的比例收窄
const LIGHT_L = [0.993, 0.982, 0.958, 0.935, 0.91, 0.88, 0.835, 0.765, 0, 0, 0.5, 0.27]
const DARK_L = [0.175, 0.205, 0.25, 0.28, 0.315, 0.355, 0.415, 0.5, 0, 0, 0.8, 0.94]
const C_RATIO = [0.06, 0.12, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1, 1, 0.85, 0.45]
// 中性灰：暖纸方向（research R10），每级明度、彩度直接给定；1/3/6/11/12 级对准定稿色
// 浅色 ≈ #FBF7EC、#EFE7D3、#E3DACA、#5E584E、#22201C；第 8 级对第 1 级 ≥ 3:1（输入框边框）
const GRAY_L = [0.976, 0.955, 0.929, 0.915, 0.903, 0.891, 0.8, 0.64, 0.58, 0.53, 0.463, 0.244]
const GRAY_C = [0.015, 0.022, 0.028, 0.027, 0.026, 0.024, 0.022, 0.02, 0.02, 0.019, 0.018, 0.008]
const GRAY_DARK_L = [0.18, 0.205, 0.235, 0.26, 0.285, 0.31, 0.37, 0.5, 0.56, 0.62, 0.78, 0.95]
const GRAY_DARK_C = [0.008, 0.01, 0.012, 0.013, 0.014, 0.015, 0.016, 0.018, 0.018, 0.018, 0.02, 0.015]

export const scale = (h: number, l9: number | null, c9: number, dark: boolean, darkL9?: number): string[] => {
  if (l9 === null) {
    const [ls, cs] = dark ? [GRAY_DARK_L, GRAY_DARK_C] : [GRAY_L, GRAY_C]
    return ls.map((l, i) => oklchToHex(l, cs[i], h))
  }
  const ls = (dark ? DARK_L : LIGHT_L).slice()
  // 深色模式的实心级略提亮，避免在深底上发闷；明黄这类本来就亮的色可直接给深色第 9 级明度
  ls[8] = dark ? (darkL9 ?? Math.min(l9 + 0.08, 0.7)) : l9
  ls[9] = dark ? ls[8] + 0.05 : l9 - 0.05
  return ls.map((l, i) => oklchToHex(l, c9 * C_RATIO[i], h))
}

const main = (args: string[]) => {
  const specs = args.map((a) => {
    const [name, v] = a.split('=')
    const [h, l, c, d] = v.split(',').map(Number)
    return { name, h, l: Number.isNaN(l) || l === undefined ? null : l, c: c ?? 0, d: Number.isNaN(d) ? undefined : d }
  })
  for (const dark of [false, true]) {
    console.log(dark ? "\n[data-theme='dark'] {" : ':root {')
    for (const s of specs) {
      const steps = scale(s.h, s.l, s.c, dark, s.d)
      console.log(steps.map((hex, i) => `  --${s.name}-${i + 1}: ${hex};`).join('\n'))
    }
    console.log('}')
  }
}

// 自检：白、黑与 OKLCH 文献值的换算误差 < 1/255
const near = (hex: string, want: string) => {
  const d = [1, 3, 5].map((i) => Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(want.slice(i, i + 2), 16)))
  if (Math.max(...d) > 1) throw new Error(`换算偏差：得到 ${hex}，期望 ${want}`)
}
near(oklchToHex(1, 0, 0), '#ffffff')
near(oklchToHex(0, 0, 0), '#000000')
near(oklchToHex(0.627955, 0.257683, 29.234), '#ff0000')
near(oklchToHex(0.452014, 0.313214, 264.052), '#0000ff')

// 暖纸中性灰对准定稿色（每个分量误差 ≤ 3/255）
const warm = scale(85, null, 0, false)
const close = (hex: string, want: string) => {
  const d = [1, 3, 5].map((i) => Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(want.slice(i, i + 2), 16)))
  if (Math.max(...d) > 3) throw new Error(`暖纸灰偏差：得到 ${hex}，期望 ${want}`)
}
;([[0, '#fbf7ec'], [2, '#efe7d3'], [5, '#e3daca'], [10, '#5e584e'], [11, '#22201c']] as const).forEach(([i, w]) => close(warm[i], w))

if (process.argv.length > 2) main(process.argv.slice(2))
