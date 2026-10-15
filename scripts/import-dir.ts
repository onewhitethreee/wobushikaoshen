// pnpm import:dir <导入包目录>：在服务器本机读导入包（import.json + 媒体），用 Payload Local API 导入。
// 与后台"导入文件夹"共用 importPackage()；大批量（听力音频）走这里，不经浏览器上传。
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLocalReq, getPayload } from 'payload'

import config from '../src/payload.config.js'
import { importPackage } from '../src/import/importPackage'

const dir = process.argv[2]
if (!dir) {
  console.error('用法：pnpm import:dir <导入包目录>')
  process.exit(1)
}

const root = path.resolve(dir)
const manifest = await fs.readFile(path.join(root, 'import.json'), 'utf8').catch(() => null)
if (manifest === null) {
  console.error(`${root} 下没有 import.json`)
  process.exit(1)
}

const payload = await getPayload({ config })
// 以系统身份导入（与后台登录用户等价的写权限）
const req = await createLocalReq({ user: { id: 0, collection: 'users' } as never }, payload)
const { status, body } = await importPackage(req, manifest, async (p) => {
  const data = await fs.readFile(path.join(root, p)).catch(() => null)
  return data ? { data, size: data.length } : null
})

console.log(JSON.stringify(body, null, 2))
if (body.ok) {
  const updated = body.created.filter((c) => c.updated).length
  console.log(`完成：新建 ${body.created.length - updated}，更新 ${updated}（HTTP ${status}）`)
}
process.exit(body.ok ? 0 : 1)
