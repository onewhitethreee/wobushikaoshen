// 成绩分享卡片（025 contracts/ui.md）：内容整理（纯函数）+ canvas 画图。颜色固定为浅色主题的色值，图片不随主题变
import { fmt } from '@/practice/timer'

export const W = 1080
export const H = 1440
export const PAPER = '#fcf7ec' // 浅色 --gray-1
export const INK = '#22201c' // 浅色 --gray-12
export const MUTED = '#5d584e' // 浅色 --gray-11
export const SUN = '#ffbc19' // 标志的黄
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif'

export type ShareResult = {
  module: 'listening' | 'reading'
  part: string
  title: string
  score: number
  total: number
  band?: number | null
  duration?: number
  at: number
}
export type CardContent = {
  subject: string
  title: string
  score: string
  percent: string
  band: string | null
  time: string | null
  date: string
}
export type QrTarget = { url: string; caption: string; code: string | null }
export type QrMatrix = { size: number; isDark: (r: number, c: number) => boolean }

const pad = (n: number) => String(n).padStart(2, '0')

export const fileName = (at: number) => {
  const d = new Date(at)
  return `我不是考神-成绩-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.png`
}

/** 有邀请链接且勾选：二维码指向邀请链接；否则指向首页 */
export const qrTarget = (o: { link: string | null; include: boolean; origin: string }): QrTarget => {
  const code = o.link && o.include ? (/\/i\/([^/?#]+)$/.exec(o.link)?.[1] ?? null) : null
  return code && o.link
    ? { url: o.link, caption: '扫码注册，你和我都能领额度', code }
    : { url: `${o.origin}/`, caption: '扫码免费练听力阅读', code: null }
}

export const cardContent = (r: ShareResult): CardContent => {
  const d = new Date(r.at)
  return {
    subject: `${r.module === 'listening' ? '听力' : '阅读'} · ${r.part}`,
    title: r.title,
    score: `${r.score} / ${r.total}`,
    percent: `${Math.round((r.total ? r.score / r.total : 0) * 100)}%`,
    band: r.band === null || r.band === undefined ? null : r.band.toFixed(1).replace(/\.0$/, ''),
    time: typeof r.duration === 'number' ? fmt(r.duration) : null,
    date: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`,
  }
}

/** 按宽度折行，最多 maxLines 行，超出加"…"（中英文混排按字符切） */
const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) => {
  const lines: string[] = []
  let cur = ''
  for (const ch of [...text]) {
    if (ctx.measureText(cur + ch).width > width && cur) {
      lines.push(cur)
      cur = ch.trimStart()
      if (lines.length === maxLines) break
    } else cur += ch
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  else if (lines.length === maxLines && cur) {
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1)
    lines[maxLines - 1] = last + '…'
  }
  return lines
}

export const drawCard = (canvas: HTMLCanvasElement, c: CardContent, target: QrTarget, qr: QrMatrix | null, icon: HTMLImageElement | null) => {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 不可用')
  const X = 80
  const font = (size: number, weight = 400) => `${weight} ${size}px ${FONT}`
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // 顶部：图标 + 站名
  if (icon) ctx.drawImage(icon, X - 8, 72, 112, 112)
  ctx.fillStyle = INK
  ctx.font = font(52, 600)
  ctx.fillText('我不是考神', X + 116, 146)
  ctx.fillStyle = MUTED
  ctx.font = font(30)
  ctx.textAlign = 'right'
  ctx.fillText('雅思学术类备考', W - X, 142)
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.fillRect(X, 222, W - 2 * X, 3)

  // 做的是哪篇
  ctx.fillStyle = MUTED
  ctx.font = font(36)
  ctx.fillText(c.subject, X, 310)
  ctx.fillStyle = INK
  ctx.font = font(58, 600)
  const titleLines = wrap(ctx, c.title, W - 2 * X, 2)
  titleLines.forEach((l, i) => ctx.fillText(l, X, 392 + i * 76))

  // 成绩：紧跟在标题后面（标题一行时整体上移）
  const top = 392 + (titleLines.length - 1) * 76
  ctx.fillStyle = MUTED
  ctx.font = font(36)
  ctx.fillText('答对', X, top + 150)
  ctx.fillStyle = INK
  ctx.font = font(170, 700)
  ctx.fillText(c.score, X - 6, top + 330)
  const scoreW = ctx.measureText(c.score).width
  ctx.font = font(64, 600)
  ctx.fillText(c.percent, X + scoreW + 36, top + 330)

  let y = top + 430
  let x = X
  if (c.band) {
    ctx.font = font(52, 700)
    const label = `Band ${c.band}`
    const w = ctx.measureText(label).width + 56
    ctx.fillStyle = SUN
    ctx.fillRect(x, y - 58, w, 80)
    ctx.fillStyle = INK
    ctx.fillText(label, x + 28, y)
    x += w + 40
  }
  if (c.time) {
    ctx.fillStyle = INK
    ctx.font = font(44)
    ctx.fillText(`用时 ${c.time}`, x, y)
  }
  y += 80
  ctx.fillStyle = MUTED
  ctx.font = font(34)
  ctx.fillText(c.date, X, y)

  // 底部：二维码 + 说明
  ctx.fillStyle = INK
  ctx.fillRect(X, 1100, W - 2 * X, 2)
  const QR = 240
  const qy = 1140
  if (qr) {
    // 每个模块取整数像素，避免模块之间出现细缝；四周留 4 个模块宽的白边（二维码规范的静区）
    const cell = Math.floor(QR / qr.size)
    const size = cell * qr.size
    const ox = X + Math.floor((QR - size) / 2)
    const oy = qy + Math.floor((QR - size) / 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(ox - cell * 4, oy - cell * 4, size + cell * 8, size + cell * 8)
    ctx.fillStyle = INK
    for (let r = 0; r < qr.size; r++) for (let col = 0; col < qr.size; col++) if (qr.isDark(r, col)) ctx.fillRect(ox + col * cell, oy + r * cell, cell, cell)
  }
  const tx = X + QR + 56
  ctx.fillStyle = INK
  ctx.font = font(40, 600)
  ctx.fillText(target.caption, tx, qy + 70)
  if (target.code) {
    ctx.font = font(36)
    ctx.fillText(`邀请码 ${target.code}`, tx, qy + 134)
  }
  ctx.fillStyle = MUTED
  ctx.font = font(30)
  ctx.fillText(target.url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\/i\/.*$/, ''), tx, qy + 196)
}
