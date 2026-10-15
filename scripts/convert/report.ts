// 复核表与抽查（007 T023，research R6、contracts/convert-cli.md）
import { typeLabel } from '../../src/collections/Tests/questionTypes'
import type { RawQuestion, UnitGroup, UnitQuestion } from './questions'

/** 一道题在转换中的全部信息（复核表与抽查都用它） */
export type QRecord = {
  key: string // sourceId#题号
  sourceId: string
  set: string // 主题集（抽查按"题集 × 题型"分层）
  title: string
  group: UnitGroup
  q: UnitQuestion
  raws: RawQuestion[]
  rule: string[]
  ai: string[] | null
  reasons: string[]
}

export const SPOT_SEED = 20261009

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * 每个"题集 × 题型"抽 10%（至少 1 题），固定种子；输入顺序无关。
 * 已复核过的题（reviewed）优先算进样本，不够再随机补：池子里一题状态变了，不会让整层样本重抽、前面的复核白做。
 */
export const pickSpot = (keysByStratum: Map<string, string[]>, reviewed: Set<string> = new Set(), seed = SPOT_SEED): Set<string> => {
  const picked = new Set<string>()
  for (const stratum of [...keysByStratum.keys()].sort()) {
    const keys = [...keysByStratum.get(stratum)!].sort()
    const n = Math.max(1, Math.ceil(keys.length * 0.1))
    const rnd = mulberry32(seed ^ [...stratum].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0))
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[keys[i], keys[j]] = [keys[j], keys[i]]
    }
    const order = [...keys.filter((k) => reviewed.has(k)), ...keys.filter((k) => !reviewed.has(k))]
    for (const k of order.slice(0, n)) picked.add(k)
  }
  return picked
}

export const stratumOf = (r: Pick<QRecord, 'set' | 'group'>) => `${r.set} × ${typeLabel[r.group.type] ?? r.group.type}`

const opts = (r: QRecord) => {
  const o = r.group.type === 'single_choice' ? r.q.options ?? [] : r.group.options
  return o.length ? o.map((x) => `${x.key}. ${x.text}`).join('；') : '—'
}

const nums = (q: UnitQuestion) => (q.span > 1 ? `${q.number}–${q.number + q.span - 1}` : String(q.number))

/** 每题一节；末尾给出可直接粘进 overrides.json 的一行 */
export const section = (r: QRecord, answer: string[], extra?: string): string =>
  [
    `### ${r.key}`,
    '',
    `- 题集 / 篇目：${r.set} / ${r.title}`,
    `- 题号 / 题型：${nums(r.q)} / ${typeLabel[r.group.type] ?? r.group.type}`,
    `- 说明：${r.group.instructions.replace(/\n/g, ' ')}`,
    ...(r.group.content ? [`- 正文：${r.group.content.replace(/\n/g, ' ／ ').slice(0, 600)}`] : []),
    `- 题干：${r.q.prompt ?? '（见正文空位）'}`,
    `- 选项：${opts(r)}`,
    `- 解析：${r.q.explanation ?? '—'}`,
    `- 引用原句：${r.q.quote ?? '—'}`,
    `- 规则答案：${r.rule.join('、') || '—'}`,
    `- AI 答案：${r.ai === null ? '未调用' : r.ai.join('、') || '—'}`,
    ...(r.reasons.length ? [`- 原因：${r.reasons.join('；')}`] : []),
    ...(extra ? [`- ${extra}`] : []),
    '',
    '```json',
    `"${r.key}": ${JSON.stringify(answer)},`,
    '```',
    '',
  ].join('\n')

export const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
