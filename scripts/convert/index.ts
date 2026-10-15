// pnpm convert <writing|reading|listening> --src <out/题目_json> --out <out/导入包> [--batch N] [--no-ai]
// 只读原始数据，输出导入包与报告到仓库外（specs/007-question-bank-import/contracts/convert-cli.md）
import path from 'node:path'

import { loadAiSettings } from './aiSettings'
import { convertListening } from './listening'
import { convertReading } from './reading'
import { convertWriting } from './writing'

const args = process.argv.slice(2)
const kind = args[0]
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const src = opt('src')
const out = opt('out')

if (!['writing', 'reading', 'listening'].includes(kind ?? '') || !src || !out) {
  console.error(
    '用法：pnpm convert <writing|reading|listening> --src <out/题目_json> --out <out/导入包> [--batch N] [--no-ai]',
  )
  process.exit(1)
}

const batch = Number(opt('batch')) || (kind === 'listening' ? 20 : 30)

if (kind === 'writing') {
  const r = convertWriting(path.resolve(src), path.resolve(out))
  console.log(`写作：可导入 ${r.count}，出错 ${r.errors.length}，去重丢弃 ${r.dropped.length}`)
  console.log(`导入包：${r.pack}`)
  console.log(`报告：${path.join(path.resolve(out), 'writing', '报告.md')}`)
  process.exit(r.errors.length ? 1 : 0)
}

// AI 配置来自本机数据库的后台「AI 设置」（research R13）；没填 key 或 --no-ai → 只跑规则
const ai = args.includes('--no-ai') ? null : await loadAiSettings()
console.log(ai ? `AI：${ai.model}（${ai.baseUrl}）` : 'AI：未启用，只跑规则与检查')

if (kind === 'reading') {
  const r = await convertReading(path.resolve(src), path.resolve(out), batch, ai)
  console.log(`阅读：单元 ${r.units}，可导入 ${r.ok}，待确认 ${r.pending} 题，抽查 ${r.spot} 题，出错 ${r.errors.length}`)
  console.log(`导入包 ${r.packs.length} 个；报告与复核表：${r.dir}`)
  process.exit(0)
}

const r = await convertListening(path.resolve(src), path.resolve(out), batch, ai)
console.log(`听力：单元 ${r.units}，可导入 ${r.ok}，待确认 ${r.pending} 题，抽查 ${r.spot} 题，出错 ${r.errors.length}`)
console.log(`导入包 ${r.packs.length} 个；报告与复核表：${r.dir}`)
process.exit(0)
