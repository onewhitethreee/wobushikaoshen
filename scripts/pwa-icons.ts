// 019 PWA 图标（research R3）：从站点标志生成清单用的三张图。换标志后重跑：pnpm exec tsx scripts/pwa-icons.ts
import path from 'path'
import sharp from 'sharp'

const pub = path.resolve(process.cwd(), 'public')
const logo = path.join(pub, 'logo-1024.png')
const BG = '#fcf7ec' // 浅色 --gray-1

const main = async () => {
  for (const size of [192, 512]) await sharp(logo).resize(size, size).png().toFile(path.join(pub, `icon-${size}.png`))
  // maskable：安全区是中心 80% 的圆，标志缩到 70% 放在浅色底上
  const inner = await sharp(logo).resize(360, 360).png().toBuffer()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(path.join(pub, 'icon-maskable-512.png'))
}

void main()
