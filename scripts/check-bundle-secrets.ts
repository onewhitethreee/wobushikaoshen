// pnpm build && pnpm check:secrets：确认服务端密钥没有进浏览器（010 research R8、attack-matrix A9）。
// 拿本机 .env 和数据库里密钥的实际值，去搜构建产物（浏览器脚本、预渲染页面）和匿名请求的接口响应。
// 命中只打印位置不打印值；有命中退出码为 1。接口部分需要站点在 NEXT_PUBLIC_SERVER_URL 上运行，否则跳过
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'

const payload = await getPayload({ config })
const ai = (await payload.findGlobal({ slug: 'ai-settings', overrideAccess: true, showHiddenFields: true })) as unknown as Record<string, unknown>
const mail = (await payload.db.findGlobal({ slug: 'mail-settings' })) as unknown as Record<string, Record<string, unknown> | undefined>

const secrets: Record<string, unknown> = {
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  PREVIEW_SECRET: process.env.PREVIEW_SECRET,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  'ai-settings.apiKey': ai.apiKey,
  'mail-settings.primary.password': mail.primary?.password,
  'mail-settings.backup.password': mail.backup?.password,
}
// 太短的值（示例占位、空串）搜出来全是误报
const targets = Object.entries(secrets).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length >= 8)
console.log(`要搜的密钥：${targets.map(([k]) => k).join('、') || '（无）'}`)

const hits: string[] = []
const scan = (where: string, text: string) => {
  for (const [name, value] of targets) if (text.includes(value)) hits.push(`${name} → ${where}`)
}

const walk = (dir: string, keep: (f: string) => boolean): string[] =>
  !fs.existsSync(dir)
    ? []
    : fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const p = path.join(dir, d.name)
        return d.isDirectory() ? walk(p, keep) : keep(p) ? [p] : []
      })

const files = [
  ...walk('.next/static', () => true),
  ...walk('.next/server/app', (f) => /\.(html|rsc|body|meta)$/.test(f)),
]
if (!files.length) console.warn('没有找到 .next 构建产物，先跑 pnpm build')
for (const f of files) scan(f, fs.readFileSync(f, 'latin1'))
console.log(`构建产物：搜了 ${files.length} 个文件`)

const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const urls = [
  '/', '/writing', '/listening', '/reading', '/login',
  ...['header', 'footer', 'band-scales', 'ai-settings', 'mail-settings'].map((g) => `/api/globals/${g}`),
  ...payload.config.collections.map((c) => `/api/${c.slug}?limit=5&depth=2`),
]
const up = await fetch(base).then(() => true, () => false)
if (up) {
  for (const u of urls) scan(`GET ${u}`, await (await fetch(base + u)).text())
  console.log(`接口：匿名请求了 ${urls.length} 个地址`)
} else {
  console.warn(`${base} 没有在运行，跳过接口检查`)
}

if (hits.length) {
  console.error(`发现 ${hits.length} 处密钥外泄：\n${hits.join('\n')}`)
  process.exit(1)
}
console.log('没有发现密钥')
process.exit(0)
