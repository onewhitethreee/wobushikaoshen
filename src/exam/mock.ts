// 028 全真模考：卷子的位置、题号校验、Band 折算（research R2、R7）。纯函数
import { listeningDefaults, readingDefaults } from './bandScaleDefaults'
import { bandFor } from './practice'

export const SLOTS = [
  { key: 'l1', module: 'listening', part: 1 },
  { key: 'l2', module: 'listening', part: 2 },
  { key: 'l3', module: 'listening', part: 3 },
  { key: 'l4', module: 'listening', part: 4 },
  { key: 'r1', module: 'reading', part: 1 },
  { key: 'r2', module: 'reading', part: 2 },
  { key: 'r3', module: 'reading', part: 3 },
] as const

export type Slot = (typeof SLOTS)[number]['key']
export type SlotUnit = { slot: Slot; module: 'listening' | 'reading'; part: number; numbers: number[] }

const NAME = { listening: '听力', reading: '阅读' } as const

/** 7 个位置齐全、模块和 Part 号对得上、同一科题号不重复且正好 40 题；返回中文错误 */
export const checkPaper = (units: SlotUnit[]): string[] => {
  const errors: string[] = []
  for (const s of SLOTS) {
    const u = units.find((x) => x.slot === s.key)
    if (!u) errors.push(`${s.key}：缺少单元`)
    else if (u.module !== s.module || u.part !== s.part)
      errors.push(`${s.key}：位置要放${NAME[s.module]} ${s.module === 'listening' ? 'Part' : 'Passage'} ${s.part}`)
  }
  for (const m of ['listening', 'reading'] as const) {
    const nums = units.filter((u) => u.module === m).flatMap((u) => u.numbers)
    if (new Set(nums).size !== nums.length) errors.push(`${NAME[m]}题号有重复`)
    if (nums.length !== 40) errors.push(`${NAME[m]}一共 ${nums.length} 题，应为 40 题`)
  }
  return errors
}

/** 题数不是 40 时按正确率折算到 40 题再查表 */
export const bandOf = (score: number, total: number, scale: { min: number; max: number; band: number }[] = listeningDefaults) => {
  const n = total === 40 ? score : total ? Math.round((score / total) * 40) : 0
  return bandFor(n, scale) ?? bandFor(n, scale === readingDefaults ? readingDefaults : listeningDefaults) ?? 0
}

/** 两科平均：官方总分规则，.25 进到 .5、.75 进到整数 */
export const overall = (l: number, r: number) => Math.ceil(((l + r) / 2) * 2 - 1e-9) / 2

export type ComposeUnit = { id: number; module: 'listening' | 'reading'; part: number; sourceSets?: string | null; numbers: number[] }
export type ComposedPaper = { no: number; title: string } & Record<Slot, number>

const RANGES: Record<string, [number, number]> = {
  listening1: [1, 10], listening2: [11, 20], listening3: [21, 30], listening4: [31, 40],
  reading1: [1, 13], reading2: [14, 26], reading3: [27, 40],
}

const setOf = (u: ComposeUnit) => (u.sourceSets ?? '').split(/[,，]/)[0].trim()

/**
 * 组卷（research R9）：只用没进过卷子的单元，每个最多进一张；阅读三篇优先同一题集，凑不齐再跨题集；
 * 组数 = 听力四个 Part 与阅读组数里最少的那个。题号不合规的单元跳过
 */
export const composePapers = (all: ComposeUnit[], used: Set<number>, startNo: number) => {
  const skipped: number[] = []
  // 每个单元的题号必须正好是它所在位置的标准范围（Part 1 = 1–10 …），拼起来才不会冲突
  const ok = (u: ComposeUnit) => {
    const [lo, hi] = RANGES[`${u.module}${u.part}`] ?? [0, -1]
    const fine = u.numbers.length === hi - lo + 1 && new Set(u.numbers).size === u.numbers.length && u.numbers.every((n) => n >= lo && n <= hi)
    if (!fine) skipped.push(u.id)
    return fine
  }
  const free = all.filter((u) => !used.has(u.id)).sort((a, b) => a.id - b.id).filter(ok)
  const byPart = (m: ComposeUnit['module'], p: number, list = free) => list.filter((u) => u.module === m && u.part === p)

  const listening = [1, 2, 3, 4].map((p) => byPart('listening', p))

  // 阅读：先同题集成组，剩下的跨题集
  const reading: [ComposeUnit, ComposeUnit, ComposeUnit][] = []
  const left = new Set(free.filter((u) => u.module === 'reading'))
  const sets = [...new Set(free.filter((u) => u.module === 'reading').map(setOf))]
  for (const name of sets) {
    const inSet = [...left].filter((u) => setOf(u) === name)
    const [p1, p2, p3] = [1, 2, 3].map((p) => byPart('reading', p, inSet))
    for (let i = 0; i < Math.min(p1.length, p2.length, p3.length); i++) {
      reading.push([p1[i], p2[i], p3[i]])
      ;[p1[i], p2[i], p3[i]].forEach((u) => left.delete(u))
    }
  }
  const rest = [1, 2, 3].map((p) => byPart('reading', p, [...left]))
  for (let i = 0; i < Math.min(...rest.map((x) => x.length)); i++) reading.push([rest[0][i], rest[1][i], rest[2][i]])

  const count = Math.min(...listening.map((x) => x.length), reading.length)
  const papers: ComposedPaper[] = Array.from({ length: count }, (_, i) => {
    const no = startNo + i
    return {
      no,
      title: `模考 ${no}`,
      l1: listening[0][i].id,
      l2: listening[1][i].id,
      l3: listening[2][i].id,
      l4: listening[3][i].id,
      r1: reading[i][0].id,
      r2: reading[i][1].id,
      r3: reading[i][2].id,
    }
  })
  const sameSet = papers.filter((p) => new Set([p.r1, p.r2, p.r3].map((id) => setOf(all.find((u) => u.id === id)!))).size === 1).length
  return { papers, skipped, sameSet }
}

// —— 随机一场（站长 2026-10-20 追加）——
export type Pool = Record<Slot, number[]>

/** 单元 summary（[{ count, range }]）是否正好覆盖这个位置的标准题号 */
export const fitsSlot = (module: 'listening' | 'reading', part: number, summary: { count?: number; range?: string }[] | null | undefined) => {
  const [lo, hi] = RANGES[`${module}${part}`] ?? [0, -1]
  const list = summary ?? []
  const nums = list.flatMap((g) => (g.range ?? '').split('–').map(Number)).filter((n) => Number.isFinite(n))
  const count = list.reduce((s, g) => s + (g.count ?? 0), 0)
  return count === hi - lo + 1 && nums.length > 0 && Math.min(...nums) === lo && Math.max(...nums) === hi
}

/** 每个位置随机抽一个：优先没做过的，这个位置都做过了就在全部里抽 */
export const drawPaper = (pool: Pool, done: Set<number>, rand = Math.random): Record<Slot, number> | null => {
  const out = {} as Record<Slot, number>
  for (const s of SLOTS) {
    const all = pool[s.key] ?? []
    if (!all.length) return null
    const fresh = all.filter((id) => !done.has(id))
    const list = fresh.length ? fresh : all
    out[s.key] = list[Math.floor(rand() * list.length)]
  }
  return out
}

/** 做过的单元 id：交卷记录的 u{id} 和题组键 u{id}-g{k} */
export const doneUnits = (records: { unitId: string; items: { groupKey: string }[] }[]) => {
  const ids = new Set<number>()
  for (const r of records) {
    const m = /^u(\d+)/.exec(r.unitId)
    if (m) ids.add(Number(m[1]))
    for (const x of r.items) {
      const g = /^u(\d+)-g/.exec(x.groupKey)
      if (g) ids.add(Number(g[1]))
    }
  }
  return ids
}
