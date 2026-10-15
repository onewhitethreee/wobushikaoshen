// 写作转换（007 US1）：out/题目_json/写作/Task 1|Task 2/*/exam.json → 导入包 kind "writing"
import fs from 'node:fs'
import path from 'node:path'

import { categoryLabel } from '../../src/exam/writingCategories'

export type RawWriting = {
  task: 'Task 1' | 'Task 2'
  type: string
  category?: string
  title: string
  title_zh?: string
  instructions?: string
  prompt: string
  image?: string
}

export type WritingItem = {
  taskType: 'task1' | 'task2'
  category: string
  title: string
  titleZh?: string
  prompt: string
  image?: string
  minWords: number
  suggestedMinutes: number
  sourceType: 'repost'
  sourceId: string
  sourceSets: string
}

// 原始 type → 网站分类（对照 写作/README.md「题型对照」）
const CATEGORY: Record<string, string> = {
  task1_data_chart: 'data',
  task1_map: 'map',
  task1_process: 'process',
  task1_diagram: 'diagram',
  task2_opinion: 'opinion',
  task2_discussion: 'discussion',
  task2_report: 'report',
  task2_mixed: 'mixed',
  task2_comparison: 'comparison',
  task2_advantage_disadvantage: 'advantage',
}

/** 文件夹名末尾的数字即原始编号，如 "地图 Accommodation Renovation 1000000000000000001" */
export const sourceIdOf = (folder: string): string | null =>
  /(\d{6,})\s*$/.exec(folder)?.[1] ?? null

/** 单题映射；返回错误文字表示这题不能导入 */
export const toWritingItem = (raw: RawWriting, folder: string): WritingItem | string => {
  const sourceId = sourceIdOf(folder)
  if (!sourceId) return `文件夹名里没有原始编号：${folder}`
  const category = CATEGORY[raw.type]
  if (!category) return `未知题型 ${raw.type}：${folder}`
  const task1 = raw.task === 'Task 1'
  if (task1 && !raw.image) return `Task 1 缺少配图：${folder}`
  return {
    taskType: task1 ? 'task1' : 'task2',
    category,
    title: raw.title.trim(),
    titleZh: raw.title_zh?.trim() || undefined,
    prompt: raw.prompt.trim(),
    image: raw.image ? `img/${sourceId}${path.extname(raw.image)}` : undefined,
    minWords: task1 ? 150 : 250,
    suggestedMinutes: task1 ? 20 : 40,
    sourceType: 'repost',
    sourceId,
    sourceSets: '写作',
  }
}

const dedupeKey = (w: Pick<WritingItem, 'title' | 'prompt'>) =>
  `${w.title}\n${w.prompt}`.toLowerCase().replace(/\s+/g, ' ')

/** 按"标题 + 题目"去重，保留先出现的一份 */
export const dedupe = (items: WritingItem[]) => {
  const seen = new Map<string, WritingItem>()
  const dropped: string[] = []
  for (const w of items) {
    const k = dedupeKey(w)
    if (seen.has(k)) dropped.push(`${w.sourceId}（与 ${seen.get(k)!.sourceId} 重复）`)
    else seen.set(k, w)
  }
  return { items: [...seen.values()], dropped }
}

export const convertWriting = (src: string, out: string) => {
  const base = path.join(src, '写作')
  const items: WritingItem[] = []
  const errors: string[] = []
  const images = new Map<string, string>() // 导入包内路径 → 原图路径
  for (const task of ['Task 1', 'Task 2']) {
    for (const folder of fs.readdirSync(path.join(base, task)).sort()) {
      const dir = path.join(base, task, folder)
      const file = path.join(dir, 'exam.json')
      if (!fs.existsSync(file)) continue
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawWriting
      const r = toWritingItem(raw, folder)
      if (typeof r === 'string') {
        errors.push(r)
        continue
      }
      if (r.image) {
        const from = path.join(dir, raw.image!)
        if (!fs.existsSync(from)) {
          errors.push(`配图文件不存在：${from}`)
          continue
        }
        images.set(r.image, from)
      }
      items.push(r)
    }
  }
  const { items: unique, dropped } = dedupe(items)

  const pack = path.join(out, 'writing', 'batch-001')
  fs.rmSync(pack, { recursive: true, force: true })
  fs.mkdirSync(path.join(pack, 'img'), { recursive: true })
  for (const w of unique)
    if (w.image) fs.copyFileSync(images.get(w.image)!, path.join(pack, w.image))
  fs.writeFileSync(
    path.join(pack, 'import.json'),
    JSON.stringify({ kind: 'writing', publish: true, data: unique }, null, 2),
  )

  const byCat = new Map<string, number>()
  for (const w of unique) byCat.set(w.category, (byCat.get(w.category) ?? 0) + 1)
  const t1 = unique.filter((w) => w.taskType === 'task1').length
  const report = [
    '# 写作转换报告',
    '',
    `- 可导入：${unique.length}（Task 1 ${t1}，Task 2 ${unique.length - t1}）`,
    `- 出错：${errors.length}`,
    `- 去重丢弃：${dropped.length}`,
    '',
    '## 分类',
    '',
    '| 分类 | 题数 |',
    '|---|---|',
    ...[...byCat].map(([c, n]) => `| ${categoryLabel[c]} | ${n} |`),
    ...(errors.length ? ['', '## 出错', '', ...errors.map((e) => `- ${e}`)] : []),
    ...(dropped.length ? ['', '## 去重丢弃', '', ...dropped.map((e) => `- ${e}`)] : []),
    '',
  ].join('\n')
  fs.writeFileSync(path.join(out, 'writing', '报告.md'), report)
  return { count: unique.length, errors, dropped, pack }
}
