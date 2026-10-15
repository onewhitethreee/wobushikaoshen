// 阅读 / 听力共用的后半段（007 T022–T024、T034）：答案（规则 / AI / 检查）→ 覆盖与抽查 → 发布校验 → 分包 → 报告与复核表
import fs from 'node:fs'
import path from 'node:path'

import { typeLabel } from '../../src/collections/Tests/questionTypes'
import { validateUnit } from '../../src/exam/validate'
import type { AiSettings } from './aiSettings'
import { aiAnswers, checkAnswer, ruleAnswer, type AiCache, type Overrides } from './answers'
import type { ConvertedGroup, UnitGroup } from './questions'
import { pickSpot, section, stratumOf, table, type QRecord } from './report'

/** 转换中的单元：导入包字段 + 转换用的附加信息（写包时去掉） */
export type BaseUnit = {
  module: 'reading' | 'listening'
  part: number
  title: string
  sourceType: 'repost'
  sourceId: string
  sourceSets: string
  sourceTag: string
  passage?: { label?: string; sentences: { n: number; text: string }[] }[]
  groups: UnitGroup[]
  converted: ConvertedGroup[]
  media: Map<string, string> // 包内路径 → 原文件（配图、音频）
  errors: string[]
}

const readJson = <T>(f: string, fallback: T): T => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as T) : fallback)

/** 并发执行，保持顺序 */
const pool = async <T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export const finishUnits = async <U extends BaseUnit>(opts: {
  kind: 'reading' | 'listening'
  units: U[]
  out: string
  batch: number
  ai: AiSettings | null
  errors: string[]
  dropped: string[]
}) => {
  const { kind, units, out, batch, ai, errors, dropped } = opts
  // 3. 答案：规则 + AI + 检查
  const cacheDir = path.join(out, '..', '转换缓存')
  fs.mkdirSync(cacheDir, { recursive: true })
  const cacheFile = path.join(cacheDir, 'answers.json')
  const cache = readJson<AiCache>(cacheFile, {})
  const overrides = readJson<Overrides>(path.join(cacheDir, 'overrides.json'), {})

  const jobs = units.flatMap((u) => u.converted.map((c) => ({ u, c })))
  let done = 0
  const aiResults = await pool(jobs, ai ? 8 : 1, async ({ u, c }) => {
    const r = ai ? await aiAnswers(ai, cache, `${u.sourceId}#${c.group.questions[0]?.number}`, c.group, c) : null
    if (ai && ++done % 50 === 0) {
      console.log(`AI 抽取 ${done}/${jobs.length}`)
      fs.writeFileSync(cacheFile, JSON.stringify(cache)) // 中途断了也不白花钱
    }
    return r
  })
  if (ai) fs.writeFileSync(cacheFile, JSON.stringify(cache))

  const records: QRecord[] = []
  jobs.forEach(({ u, c }, i) => {
    const labels = (u.passage ?? []).map((p) => p.label).filter((l): l is string => Boolean(l))
    c.group.questions.forEach((q, qi) => {
      const raws = c.raw[qi]
      const rule = raws.map((r) => ruleAnswer(c.group, r)).filter((x): x is string => Boolean(x))
      const aiOut = aiResults[i]
      const aiAns = aiOut ? raws.flatMap((r) => aiOut[r.no] ?? []) : null
      const { answers, reasons } = checkAnswer(c.group, q, raws, { rule, ai: aiAns }, labels)
      q.answers = answers.join('\n')
      q.answerStatus = reasons.length ? 'pending' : 'auto'
      records.push({ key: `${u.sourceId}#${q.number}`, sourceId: u.sourceId, set: u.sourceSets.split(', ')[0], title: u.title, group: c.group, q, raws, rule, ai: aiAns, reasons })
    })
  })

  // 4. 抽查与覆盖（contracts/convert-cli.md「复核回填」）
  const strata = new Map<string, string[]>()
  for (const r of records.filter((r) => r.q.answerStatus === 'auto')) {
    const s = stratumOf(r)
    strata.set(s, [...(strata.get(s) ?? []), r.key])
  }
  const spot = pickSpot(strata, new Set(Object.keys(overrides).filter((k) => overrides[k] === 'ok')))
  const failedStrata = new Set<string>()
  const unreviewed = new Set<string>() // 抽查未回填 → 所在单元不进包
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  for (const r of records.filter((r) => spot.has(r.key))) {
    const o = overrides[r.key]
    if (o === undefined) unreviewed.add(r.sourceId)
    // 站长答案与自动答案完全没有交集才算"抽查发现错误"；只增删写法（4 days / four days）不算
    else if (o !== 'ok' && !o.some((a) => r.q.answers.split('\n').some((b) => same(a, b)))) failedStrata.add(stratumOf(r))
  }
  for (const r of records) {
    const o = overrides[r.key]
    if (Array.isArray(o)) {
      r.q.answers = o.join('\n')
      r.q.answerStatus = 'confirmed'
    } else if (o === 'ok' && r.q.answerStatus === 'auto') r.q.answerStatus = 'confirmed'
    else if (failedStrata.has(stratumOf(r)) && r.q.answerStatus === 'auto') {
      r.q.answerStatus = 'pending'
      r.reasons.push('同题集同题型的抽查发现错误，整批退回')
    }
  }

  // 5. 可导入：无结构错误、无待确认、抽查已回填、通过发布校验
  const pendingBy = new Map<string, number>()
  for (const r of records) if (r.q.answerStatus === 'pending') pendingBy.set(r.sourceId, (pendingBy.get(r.sourceId) ?? 0) + 1)
  const ok: U[] = []
  for (const u of units) {
    if (!u.errors.length && !pendingBy.has(u.sourceId) && !unreviewed.has(u.sourceId)) {
      u.errors.push(...validateUnit({ ...u, groups: u.groups as never }))
      if (!u.errors.length) ok.push(u)
    }
  }

  // 6. 写导入包
  const dir = path.join(out, kind)
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (d.startsWith('batch-')) fs.rmSync(path.join(dir, d), { recursive: true })
  const packs: string[] = []
  for (let b = 0; b * batch < ok.length; b++) {
    const pack = path.join(dir, `batch-${String(b + 1).padStart(3, '0')}`)
    const slice = ok.slice(b * batch, (b + 1) * batch)
    fs.mkdirSync(pack, { recursive: true })
    for (const u of slice)
      for (const [to, from] of u.media) {
        fs.mkdirSync(path.dirname(path.join(pack, to)), { recursive: true })
        fs.copyFileSync(from, path.join(pack, to))
      }
    const data = slice.map(({ converted: _c, media: _m, errors: _e, ...u }) => ({
      ...u,
      groups: u.groups.map((g) => ({ ...g, image: g.image ?? null })),
    }))
    fs.writeFileSync(path.join(pack, 'import.json'), JSON.stringify({ kind: 'unit', publish: true, data }, null, 2))
    packs.push(pack)
  }

  // 7. 报告与复核表
  const pending = records.filter((r) => r.q.answerStatus === 'pending')
  const spotRecs = records.filter((r) => spot.has(r.key))
  const bad = units.filter((u) => u.errors.length)
  const typeCount = new Map<string, number>()
  for (const u of units) for (const g of u.groups) typeCount.set(g.type, (typeCount.get(g.type) ?? 0) + 1)
  const from = { both: 0, ai: 0, rule: 0, none: 0 }
  for (const r of records) from[r.ai?.length && r.rule.length ? 'both' : r.ai?.length ? 'ai' : r.rule.length ? 'rule' : 'none']++
  const status = { auto: 0, confirmed: 0, pending: 0 }
  for (const r of records) status[r.q.answerStatus]++

  const report = [
    `# ${kind === 'reading' ? '阅读' : '听力'}转换报告`,
    '',
    `- 单元（去重后）：${units.length}；可导入 ${ok.length}，含待确认 ${pendingBy.size}，抽查未回填 ${[...unreviewed].filter((id) => !pendingBy.has(id)).length}，出错 ${bad.length}`,
    `- 小题：${records.length}；自动通过 ${status.auto}，人工确认 ${status.confirmed}，待确认 ${status.pending}`,
    `- 答案来源：规则与 AI 都有 ${from.both}，仅 AI ${from.ai}，仅规则 ${from.rule}，都没有 ${from.none}（AI：${ai ? ai.model : '未启用'}）`,
    `- 抽查：${spotRecs.length} 题，整批退回 ${failedStrata.size} 个「题集 × 题型」`,
    `- 导入包：${packs.length} 个，每包 ≤ ${batch} 个单元`,
    '',
    '## 题型分布（题组数）',
    '',
    table(['题型', '题组'], [...typeCount].sort((a, b) => b[1] - a[1]).map(([t, n]) => [typeLabel[t] ?? t, n])),
    ...(errors.length ? ['', '## 原始数据错误', '', ...errors.map((e) => `- ${e}`)] : []),
    ...(bad.length ? ['', '## 出错单元', '', ...bad.map((u) => `- ${u.sourceId} ${u.title}：${u.errors.join('；')}`)] : []),
    ...(dropped.length ? ['', '## 去重', '', ...dropped.map((d) => `- ${d}`)] : []),
    '',
  ].join('\n')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '报告.md'), report)
  fs.writeFileSync(
    path.join(dir, '待确认.md'),
    ['# 待确认', '', `共 ${pending.length} 题。把每节末尾那行改成正确答案后放进 \`转换缓存/overrides.json\`，重跑转换。`, '', ...pending.map((r) => section(r, r.q.answers ? r.q.answers.split('\n') : []))].join('\n'),
  )
  fs.writeFileSync(
    path.join(dir, '抽查.md'),
    [
      '# 抽查',
      '',
      `共 ${spotRecs.length} 题（每个「题集 × 题型」10%，至少 1 题）。答案正确就把值改成 "ok"；不对就填正确答案（该「题集 × 题型」会整批退回待确认）。`,
      '',
      ...spotRecs.map((r) => section(r, r.q.answers.split('\n'), overrides[r.key] === undefined ? '状态：未回填' : `状态：已回填 ${JSON.stringify(overrides[r.key])}`)),
    ].join('\n'),
  )

  return { units: units.length, ok: ok.length, pending: pending.length, spot: spotRecs.length, errors: [...errors, ...bad.map((u) => u.sourceId)], packs, dir }
}
