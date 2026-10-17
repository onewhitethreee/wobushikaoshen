// 栏目页数据：读已发布内容，生成 sample/index.ts 里同样形状的 ColumnConfig。
// 某个栏目还没有任何已发布内容时，退回示例数据（页面上标着"示例数据"），开发阶段不会是空页。
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { groupStats, type GroupSummary } from '@/exam/groupStats'
import { listeningType, readingType } from '@/exam/typeNames'
import { categoryLabel, WRITING_CATEGORIES } from '@/exam/writingCategories'
import type { SpeakingQuestion, Test, Unit, WritingTask } from '@/payload-types'
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

// 不设条数上限：练习单元有几百条（R10 的 ponytail 注释写了改服务端分页的时机）
const published = async <T>(collection: keyof typeof SORT, module?: 'listening' | 'reading') => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection,
    where: { _status: { equals: 'published' }, ...(module ? { module: { equals: module } } : {}) },
    depth: 0,
    sort: SORT[collection],
    // 单元只取列表要用的字段：不读原文 / 文章，也不读题组小题（用保存时算好的 summary；读小题在开发模式下要 5 秒以上）
    ...(collection === 'units'
      ? { select: { title: true, module: true, part: true, sourceTag: true, summary: true } }
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
  for (const u of units.filter((x) => x.module === slug)) {
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

const mockColumn = (tests: Test[]): ColumnConfig | null => {
  if (!tests.length) return null
  const rows: PracticeRow[] = tests.map((t) => {
    const has = {
      听力: Boolean(t.listening?.parts?.length),
      阅读: Boolean(t.reading?.passages?.length),
      写作: Boolean(t.writing?.task1 && t.writing?.task2),
      口语: Boolean(t.speaking?.part2),
    }
    const modules = Object.entries(has)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const full = has.写作 || has.口语
    return {
      id: String(t.id),
      lead: t.code,
      title: `${t.title} · ${modules.join(' + ')}`,
      meta: [full ? '听力阅读免费，写作口语批改用额度' : '免费'],
      count: (has.听力 ? 40 : 0) + (has.阅读 ? 40 : 0) || undefined,
      facets: { kind: 'set', scope: full ? '四科' : '听力阅读' },
      actions: [
        {
          label: '进入模考',
          doneLabel: '再考一次',
          href: `/mock?start=${t.id}`,
          cost: free,
          desktopOnly: true,
        },
      ],
    }
  })
  return { ...sample.mock, rows }
}

export const getColumn = async (slug: ColumnSlug): Promise<ColumnConfig> => {
  let real: ColumnConfig | null = null
  if (slug === 'listening' || slug === 'reading')
    real = testColumn(slug, ...(await Promise.all([published<Test>('tests'), published<Unit>('units', slug)])))
  if (slug === 'writing') real = writingColumn(await published<WritingTask>('writing-tasks'))
  if (slug === 'speaking')
    real = speakingColumn(await published<SpeakingQuestion>('speaking-questions'))
  if (slug === 'mock') real = mockColumn(await published<Test>('tests'))
  return real ?? { ...sample[slug], isSample: true }
}

export { listeningType, readingType }
