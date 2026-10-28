// 栏目页数据：读已发布内容，生成 sample/index.ts 里同样形状的 ColumnConfig。
// 某个栏目还没有任何已发布内容时，退回示例数据（页面上标着"示例数据"），开发阶段不会是空页。
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'

import { doneCounts } from '@/stats/read'

import { getPlatform } from '@/account/credits'
import { groupStats, type GroupSummary } from '@/exam/groupStats'
import { listeningType, readingType } from '@/exam/typeNames'
import { categoryLabel, WRITING_CATEGORIES } from '@/exam/writingCategories'
import { getRandomPool } from '@/content/mockPaper'
import { SLOTS } from '@/exam/mock'
import { API_TAG } from '@/contentApi/request'
import { cetPartName, IELTS, paperLabel, type Cet } from '@/exam/cet'
import type { MockPaper, SpeakingQuestion, Test, Unit, WritingTask } from '@/payload-types'
import {
  columns as sample,
  type Action,
  type ColumnConfig,
  type ColumnSlug,
  type Cost,
  type Filter,
  type PracticeRow,
} from '@/sample'

const free: Cost = { kind: 'free' }
const quota1: Cost = { kind: 'quota', amount: 1 }
const status: Filter = { id: 'status', label: '状态', options: ['全部', '未做', '已做'] }

const practice = (id: string): Action => ({
  label: '开始练习',
  doneLabel: '再做一遍',
  href: `/practice/${id}`,
  cost: free,
})

const distinct = (xs: string[]) => ['全部', ...new Set(xs)]

const SORT = { tests: '-code', units: 'title', 'writing-tasks': '-updatedAt', 'speaking-questions': '-updatedAt' }

// 035 栏目"N 人做过"：缓存 5 分钟（FR-013、SC-006）
const cachedDone = unstable_cache(async () => doneCounts(await getPayload({ config: configPromise })), ['stats-done'], { revalidate: 300 })

// 不设条数上限：练习单元有几百条（R10 的 ponytail 注释写了改服务端分页的时机）
const published = async <T>(collection: keyof typeof SORT, module?: 'listening' | 'reading') => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection,
    // 033：单元、写作题只取雅思；四 / 六级走 cetColumn
    where: {
      _status: { equals: 'published' },
      ...(module ? { module: { equals: module } } : {}),
      ...(collection === 'units' || collection === 'writing-tasks' ? IELTS : {}),
    },
    depth: 0,
    sort: SORT[collection],
    // 单元只取列表要用的字段：不读原文 / 文章，也不读题组小题（用保存时算好的 summary；读小题在开发模式下要 5 秒以上）
    ...(collection === 'units'
      ? { select: { title: true, module: true, part: true, sourceTag: true, summary: true, createdAt: true } }
      : {}),
    pagination: false,
  })
  return res.docs as T[]
}

const testColumn = (slug: 'listening' | 'reading', tests: Test[], units: Unit[]): ColumnConfig | null => {
  const isL = slug === 'listening'
  const typeName = isL ? listeningType : readingType
  const m = isL ? 'l' : 'r'
  const rows: PracticeRow[] = []

  // 练习单元（007）：每个题组一行 + 整篇 / 整个 Part 一行；题集只用中性标签 sourceTag
  // 每日精选（029）排最前、新的在上，其余照旧按标题
  const daily = (u: Unit) => u.sourceTag === API_TAG
  const mine = units.filter((x) => x.module === slug)
  const ordered = [...mine.filter(daily).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), ...mine.filter((u) => !daily(u))]
  for (const u of ordered) {
    const label = `${isL ? 'Part' : 'Passage'} ${u.part}`
    const lead = `${isL ? 'P' : 'R'}${u.part}`
    const tag: Record<string, string> = u.sourceTag ? { tag: u.sourceTag } : {}
    let total = 0
    ;((u.summary ?? []) as GroupSummary[]).forEach((g, gi) => {
      const { count, range } = g
      total += count
      const id = `u${u.id}-g${gi + 1}`
      rows.push({
        id,
        lead,
        leadSub: range ? `${range} 题` : undefined,
        title: `${u.title} · ${typeName[g.type]}`,
        meta: [typeName[g.type], u.sourceTag ?? ''].filter(Boolean),
        count,
        facets: { kind: 'group', type: typeName[g.type], part: label, ...tag },
        actions: [practice(id)],
      })
    })
    rows.push({
      id: `u${u.id}`,
      lead,
      leadSub: isL ? '整个 Part' : '整篇',
      title: u.title,
      meta: [label, u.sourceTag ?? ''].filter(Boolean),
      count: total,
      minutes: isL ? undefined : 20,
      facets: { kind: 'unit', part: label, ...tag },
      actions: [practice(`u${u.id}`)],
    })
  }

  for (const t of tests) {
    const sections = isL
      ? (t.listening?.parts ?? []).map((p, i) => ({
          label: `Part ${i + 1}`,
          lead: `P${i + 1}`,
          groups: p.groups ?? [],
          title: '',
        }))
      : (t.reading?.passages ?? []).map((p, i) => ({
          label: `Passage ${i + 1}`,
          lead: `R${i + 1}`,
          groups: p.groups ?? [],
          title: p.title ?? '',
        }))
    if (!sections.length) continue
    sections.forEach((s, si) =>
      s.groups.forEach((g, gi) => {
        const { count, range } = groupStats(g)
        const id = `t${t.id}-${m}${si + 1}-g${gi + 1}`
        rows.push({
          id,
          lead: s.lead,
          leadSub: range ? `${range} 题` : undefined,
          title: s.title
            ? `${s.title} · ${typeName[g.type]}`
            : `${t.title} · ${s.label} ${typeName[g.type]}`,
          meta: [typeName[g.type], t.code],
          count,
          facets: { kind: 'group', type: typeName[g.type], part: s.label },
          actions: [practice(id)],
        })
      }),
    )
    rows.push({
      id: `t${t.id}-${m}`,
      lead: t.code,
      leadSub: '整套',
      title: `${t.title}${isL ? '听力' : '阅读'}`,
      meta: [isL ? '4 个 Part' : '3 篇文章'],
      count: 40,
      minutes: isL ? 30 : 60,
      facets: { kind: 'set' },
      actions: [practice(`t${t.id}-${m}`)],
    })
  }
  if (!rows.length) return null

  const types = distinct(rows.filter((r) => r.facets.kind === 'group').map((r) => r.facets.type))
  // 至少两个题集才显示"题集"筛选（distinct 会带上"全部"）
  const tags = distinct(rows.map((r) => r.facets.tag).filter((t): t is string => Boolean(t)))
  const tagFilter: Filter[] = tags.length > 2 ? [{ id: 'tag', label: '题集', options: tags }] : []
  const hasUnits = rows.some((r) => r.facets.kind === 'unit')
  const hasSets = rows.some((r) => r.facets.kind === 'set')
  const parts = isL
    ? ['全部', 'Part 1', 'Part 2', 'Part 3', 'Part 4']
    : ['全部', 'Passage 1', 'Passage 2', 'Passage 3']
  const base = sample[slug]
  return {
    ...base,
    tabs: [
      {
        id: 'type',
        label: '按题型练',
        match: { kind: 'group' },
        filters: [{ id: 'type', label: '题型', options: types }, ...tagFilter, status],
      },
      {
        id: 'part',
        label: isL ? '按 Part 练' : '按 Passage 练',
        match: { kind: 'group' },
        filters: [{ id: 'part', label: isL ? 'Part' : 'Passage', options: parts }, ...tagFilter, status],
      },
      ...(hasUnits
        ? [
            {
              id: 'unit',
              label: isL ? '整个 Part 练' : '整篇练',
              match: { kind: 'unit' },
              filters: [{ id: 'part', label: isL ? 'Part' : 'Passage', options: parts }, ...tagFilter, status],
            },
          ]
        : []),
      ...(hasSets ? [{ id: 'set', label: '整套练', match: { kind: 'set' }, filters: [status] }] : []),
    ],
    rows,
  }
}

const writingColumn = (tasks: WritingTask[]): ColumnConfig | null => {
  if (!tasks.length) return null
  const rows: PracticeRow[] = tasks.map((w) => {
    const task = w.taskType === 'task1' ? '1' : '2'
    const category = w.category ? categoryLabel[w.category] : undefined
    return {
      id: String(w.id),
      lead: `T${task}`,
      leadSub: `${w.minWords ?? (task === '1' ? 150 : 250)} 词`,
      title: w.title,
      meta: [category, w.titleZh].filter((m): m is string => Boolean(m)),
      minutes: w.suggestedMinutes ?? undefined,
      facets: { task, ...(category ? { category } : {}) },
      actions: [
        { label: '开始写', doneLabel: '再写一遍', href: `/writing/${w.id}`, cost: free },
        { label: 'AI 批改', href: `/writing/${w.id}#review`, cost: quota1 },
      ],
    }
  })
  // 每个 Task 的分类筛选只列出该 Task 实际有的分类，按 WRITING_CATEGORIES 的顺序
  const categories = (task: '1' | '2') => {
    const have = new Set(rows.filter((r) => r.facets.task === task).map((r) => r.facets.category))
    return [
      '全部',
      ...WRITING_CATEGORIES[`task${task}`].map((c) => c.label).filter((l) => have.has(l)),
    ]
  }
  return {
    ...sample.writing,
    tabs: (['1', '2'] as const).map((t) => ({
      id: `t${t}`,
      label: `Task ${t}`,
      match: { task: t },
      filters: [{ id: 'category', label: '分类', options: categories(t) }, status],
    })),
    rows,
  }
}

const speakingColumn = (qs: SpeakingQuestion[]): ColumnConfig | null => {
  if (!qs.length) return null
  const rows: PracticeRow[] = qs.map((q) => {
    const n = q.questions?.length ?? 0
    return {
      id: String(q.id),
      lead: `P${q.part}`,
      leadSub: q.part === '2' ? '题卡' : `${n} 题`,
      title: q.part === '2' ? (q.cueCard?.split('\n')[0] ?? q.topic) : q.topic,
      meta: [q.part === '2' ? q.topic : '', q.season ?? ''].filter(Boolean),
      count: q.part === '2' ? undefined : n,
      facets: { part: q.part },
      actions: [
        { label: '看题', doneLabel: '再看一遍', href: `/speaking?start=${q.id}`, cost: free },
        { label: '口语批改', href: `/speaking?mock=${q.id}`, cost: quota1 },
      ],
    }
  })
  return {
    ...sample.speaking,
    tabs: (['1', '2', '3'] as const).map((p) => ({
      id: `p${p}`,
      label: `Part ${p}`,
      match: { part: p },
      filters: [status],
    })),
    rows,
  }
}

// 028 模考卷：卷子已发布且 7 个单元都已发布才列出（FR-024）
const mockColumn = async (): Promise<ColumnConfig | null> => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'mock-papers',
    where: { _status: { equals: 'published' } },
    depth: 1,
    select: { no: true, title: true, l1: true, l2: true, l3: true, l4: true, r1: true, r2: true, r3: true },
    populate: { units: { _status: true } },
    sort: 'no',
    pagination: false,
  })
  const papers = (res.docs as MockPaper[]).filter((p) =>
    SLOTS.every((s) => {
      const u = p[s.key]
      return typeof u === 'object' && u?._status === 'published'
    }),
  )
  // 随机一场（站长 2026-10-20 追加）放第一行：每个位置都有可用单元才显示
  const pool = await getRandomPool()
  const random: PracticeRow[] = SLOTS.every((s) => pool[s.key].length)
    ? [
        {
          id: 'm0',
          lead: '随机',
          title: '随机模考',
          meta: ['每次随机抽 4 个 Part + 3 篇，优先没做过的', '约 2 小时', '免费'],
          count: 80,
          facets: { kind: 'set', scope: '听力阅读' },
          actions: [{ label: '开始随机一场', doneLabel: '再随机一场', href: '/mock/random', cost: free, desktopOnly: true }],
        },
      ]
    : []
  if (!papers.length && !random.length) return null
  const rows: PracticeRow[] = random.concat(papers.map((p) => ({
    id: `m${p.no}`,
    lead: String(p.no),
    title: p.title,
    meta: ['听力 4 Part + 阅读 3 篇', '约 2 小时', '免费'],
    count: 80,
    facets: { kind: 'set', scope: '听力阅读' },
    actions: [{ label: '进入模考', doneLabel: '再考一次', href: `/mock/${p.no}`, cost: free, desktopOnly: true }],
  })))
  return { ...sample.mock, tabs: [{ id: 'all', label: '全部模考卷', match: { kind: 'set' }, filters: [status] }], rows }
}

// 033 四 / 六级：按试卷分组（research R4）。每个单元、每道写作 / 翻译题一行；试卷新的在上，同套 听力 → 阅读 → 写作 → 翻译
const SUBJECT_ORDER = ['听力', '阅读', '写作', '翻译']
const cetColumn = async (exam: Cet): Promise<ColumnConfig | null> => {
  const payload = await getPayload({ config: configPromise })
  const where: Where = { and: [{ _status: { equals: 'published' } }, { exam: { equals: exam } }] }
  const [units, tasks] = await Promise.all([
    payload.find({
      collection: 'units',
      where,
      depth: 0,
      select: { title: true, module: true, part: true, paper: true, summary: true },
      pagination: false,
    }),
    payload.find({
      collection: 'writing-tasks',
      where,
      depth: 0,
      select: { title: true, titleZh: true, taskType: true, paper: true, minWords: true, maxWords: true, suggestedMinutes: true },
      pagination: false,
    }),
  ])
  type Item = { row: PracticeRow; paper: string; subject: string; part: number }
  const items: Item[] = []
  for (const u of units.docs as Unit[]) {
    const isL = u.module === 'listening'
    const subject = isL ? '听力' : '阅读'
    const name = cetPartName(u.module, u.part)
    const type = name.replace(/^Section [A-C] /, '').replace(/ \d$/, '')
    const count = ((u.summary ?? []) as GroupSummary[]).reduce((n, g) => n + g.count, 0)
    const paper = u.paper ?? ''
    items.push({
      paper,
      subject,
      part: u.part,
      row: {
        id: `u${u.id}`,
        lead: isL ? 'ABC'[u.part - 1] ?? String(u.part) : `R${u.part}`,
        title: isL ? name : u.title,
        meta: isL ? [] : [name],
        count,
        group: paperLabel(paper),
        facets: { kind: 'unit', subject, type, year: paper.slice(0, 4) },
        actions: [practice(`u${u.id}`)],
      },
    })
  }
  for (const w of tasks.docs as WritingTask[]) {
    const subject = w.taskType === 'cet_translation' ? '翻译' : '写作'
    const words = [w.minWords, w.maxWords].filter(Boolean).join('–')
    const paper = w.paper ?? ''
    items.push({
      paper,
      subject,
      part: 0,
      row: {
        id: String(w.id),
        lead: subject === '翻译' ? 'T' : 'W',
        leadSub: words && subject === '写作' ? `${words} 词` : undefined,
        title: w.titleZh ?? w.title,
        meta: [subject],
        minutes: w.suggestedMinutes ?? undefined,
        group: paperLabel(paper),
        facets: { kind: 'unit', subject, type: subject, year: paper.slice(0, 4) },
        actions: [
          { label: subject === '翻译' ? '开始翻译' : '开始写', doneLabel: '再写一遍', href: `/writing/${w.id}`, cost: free },
          // 034：四 / 六级写作、翻译也能 AI 批改
          { label: 'AI 批改', href: `/writing/${w.id}#review`, cost: quota1 },
        ],
      },
    })
  }
  if (!items.length) return null
  // paper 是 YYYY-MM-N，字符串倒序即新的在上
  items.sort(
    (a, b) =>
      b.paper.localeCompare(a.paper) || SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || a.part - b.part,
  )
  const rows = items.map((x) => x.row)
  const opts = (key: string, order?: string[]) => {
    const have = new Set(rows.map((r) => r.facets[key]))
    return ['全部', ...(order ? order.filter((o) => have.has(o)) : [...have].sort().reverse())]
  }
  const types = distinct(rows.map((r) => r.facets.type))
  return {
    ...sample[exam],
    tabs: [
      {
        id: 'paper',
        label: '按试卷',
        match: { kind: 'unit' },
        filters: [
          { id: 'subject', label: '科目', options: opts('subject', SUBJECT_ORDER) },
          { id: 'type', label: '题型', options: types },
          { id: 'year', label: '年份', options: opts('year') },
          status,
        ],
      },
    ],
    rows,
  }
}

export const getColumn = async (slug: ColumnSlug): Promise<ColumnConfig> => {
  let real: ColumnConfig | null = null
  if (slug === 'cet4' || slug === 'cet6') real = await cetColumn(slug)
  if (slug === 'listening' || slug === 'reading')
    real = testColumn(slug, ...(await Promise.all([published<Test>('tests'), published<Unit>('units', slug)])))
  if (slug === 'writing') real = writingColumn(await published<WritingTask>('writing-tasks'))
  if (slug === 'speaking')
    real = speakingColumn(await published<SpeakingQuestion>('speaking-questions'))
  if (slug === 'mock') real = await mockColumn()
  const notePlatform = await getPlatform(await getPayload({ config: configPromise }))
  // 035："N 人做过"，只有首次作答 ≥ 20 的行有；整套套题、模考卷行在统计里没有对应 id，不显示
  if (real) {
    const done = await cachedDone()
    real = { ...real, rows: real.rows.map((r) => (done[r.id] ? { ...r, people: done[r.id] } : r)) }
  }
  return { ...(real ?? { ...sample[slug], isSample: true }), notePlatform }
}

export { listeningType, readingType }
