// pnpm chart:data [--redo 4,12] [--only-failed] [--limit N]：用看图模型把 Task 1 图表转成文字，写进写作题的 chartData（015 research R7）。
// 默认只处理没有图表数据的已发布 Task 1；失败的题号写进 chart-data.failed.txt，--only-failed 只重跑它们。
// 图片优先读本地 public/media，配了对象存储时按媒体 url 下载；以 base64 发送，不依赖公网地址
import 'dotenv/config'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { chat, loadAi } from '../src/ai/chat'
import type { Media, WritingTask } from '../src/payload-types'

const FAILED = 'chart-data.failed.txt'
const CONCURRENCY = 4
const TIMEOUT = 180_000

const PROMPT = `You convert an IELTS Academic Writing Task 1 visual into plain text data for an examiner who cannot see the image.
Write in English, plain text, no commentary or advice. Include:
1. Chart type and title.
2. Axes, categories, units, and time periods.
3. ALL data points, as a Markdown table when the visual is numeric (estimate carefully when values sit between gridlines; say "approx.").
4. For maps / plans: every area or feature in each version and what changed. For processes / diagrams: every stage in order.
5. The main trends, highest / lowest values, and key comparisons a good overview would mention.`

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i < 0 ? undefined : (process.argv[i + 1] ?? '')
}
const ids = (s: string | undefined) => (s ?? '').split(/[\s,]+/).filter(Boolean).map(Number)

const payload = await getPayload({ config })
const ai = await loadAi(payload)
if (!ai) {
  console.error('后台「AI 设置」没有填 API key')
  process.exit(1)
}

const redo = arg('--redo')
const onlyFailed = process.argv.includes('--only-failed')
const limit = Number(arg('--limit')) || undefined
const picked = redo !== undefined ? ids(redo) : onlyFailed ? ids(existsSync(FAILED) ? readFileSync(FAILED, 'utf8') : '') : null

const { docs: all } = await payload.find({
  collection: 'writing-tasks',
  overrideAccess: true,
  depth: 1,
  pagination: false,
  sort: 'id',
  where: {
    taskType: { equals: 'task1' },
    _status: { equals: 'published' },
    ...(picked ? { id: { in: picked } } : {}),
  },
})
const todo = (picked ? all : all.filter((t) => !t.chartData?.trim())).slice(0, limit)
const skipped = all.length - todo.length

const imageData = async (m: Media) => {
  const local = path.resolve('public/media', m.filename ?? '')
  const buf = m.filename && existsSync(local) ? readFileSync(local) : Buffer.from(await (await fetch(m.url!)).arrayBuffer())
  return `data:${m.mimeType ?? 'image/png'};base64,${buf.toString('base64')}`
}

const failed: number[] = []
let ok = 0
let tokens = 0
const one = async (t: WritingTask) => {
  const t0 = Date.now()
  try {
    if (!t.image || typeof t.image !== 'object') throw new Error('没有图片')
    const { content, usage } = await chat(ai, {
      model: ai.visionModel,
      timeoutMs: TIMEOUT,
      maxTokens: 16000, // 看图模型带推理，实测单张最多约 9,500
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Task prompt: ${t.prompt}` },
            { type: 'image_url', image_url: { url: await imageData(t.image) } },
          ],
        },
      ],
    })
    tokens += usage.prompt + usage.completion
    await payload.update({
      collection: 'writing-tasks',
      id: t.id,
      overrideAccess: true,
      data: { chartData: content.trim(), chartSource: 'vision', chartChecked: false },
    })
    ok++
    console.log(`#${t.id} ok ${((Date.now() - t0) / 1000).toFixed(1)}s ${usage.prompt}+${usage.completion} tokens`)
  } catch (e) {
    failed.push(t.id)
    console.log(`#${t.id} failed: ${(e as Error).message}`)
  }
}

const queue = [...todo]
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let t = queue.shift(); t; t = queue.shift()) await one(t)
}))

writeFileSync(FAILED, failed.sort((a, b) => a - b).join('\n'))
console.log(`成功 ${ok}，失败 ${failed.length}，跳过 ${skipped}，共 ${tokens} tokens${failed.length ? `；失败题号见 ${FAILED}` : ''}`)
process.exit(0)
