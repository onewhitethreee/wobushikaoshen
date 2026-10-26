// 练习页取数：按单位标识从已发布套题 / 练习单元里取题组（含答案、解析、媒体地址），一次传给页面（research R1、R2、R9；007 R9）
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { listeningDefaults, readingDefaults } from '@/exam/bandScaleDefaults'
import { cetPartName, EXAM_NAME, IELTS, isCet, paperLabel } from '@/exam/cet'
import {
  FIXED_OPTIONS,
  groupKey,
  groupNumbers,
  parseUnitId,
  unitId,
  unitGroupKey,
  type GroupView,
  type Module,
  type ParsedUnit,
  type PracticeUnit,
  type Section,
  type TranscriptLine,
} from '@/exam/practice'
import type { Media, Test, Unit } from '@/payload-types'

type RawGroup =
  | NonNullable<NonNullable<NonNullable<Test['listening']>['parts']>[number]['groups']>[number]
  | NonNullable<Unit['groups']>[number]
type Paragraph = { label?: string | null; text: string; sentences?: { n: number; text: string }[]; translation?: string }

const url = (m: number | Media | null | undefined) => (m && typeof m === 'object' ? (m.url ?? undefined) : undefined)
const text = (s: string | null | undefined) => s || undefined
const kv = (o: { key: string; text: string }[] | null | undefined) => (o ?? []).map(({ key, text }) => ({ key, text }))

const findPublished = async (id: number) => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'tests',
    where: { and: [{ id: { equals: id } }, { _status: { equals: 'published' } }] },
    depth: 1,
    limit: 1,
  })
  return { payload, test: res.docs[0] as Test | undefined }
}

// bySentence：原文 / 文章按句拆分（练习单元）时才带出处句号；套题的段落没有句子 id，定位用段落字母
const toGroup = (g: RawGroup, key: string, paragraphs: Paragraph[], bySentence = false): GroupView => ({
  key,
  type: g.type,
  instructions: g.instructions,
  content: text(g.content),
  imageUrl: url(g.image),
  maxWords: g.maxWords ?? undefined,
  numberAllowed: g.numberAllowed ?? undefined,
  options:
    FIXED_OPTIONS[g.type] ??
    (g.type === 'matching_information'
      ? paragraphs.filter((p) => p.label).map((p) => ({ key: p.label!, text: `段落 ${p.label}` }))
      : kv(g.options)),
  questions: (g.questions ?? []).map((q) => ({
    number: q.number,
    span: Math.max(q.span ?? 1, 1),
    prompt: text(q.prompt),
    options: kv(q.options),
    answers: q.answers,
    explanation: text(q.explanation),
    tip: text(q.tip),
    evidence: bySentence ? text(q.evidence) : undefined,
  })),
})

/** 题号范围后缀：" · 第 11–14 题" */
const rangeSuffix = (g: GroupView) => {
  const nums = groupNumbers(g)
  const [a, b] = [Math.min(...nums), Math.max(...nums)]
  return a === b ? ` · 第 ${a} 题` : ` · 第 ${a}–${b} 题`
}

// 练习单元（007）：一篇阅读 / 一个听力 Part；不给 band（不足 40 题）
const getUnit = async (p: Extract<ParsedUnit, { kind: 'unit' }>): Promise<PracticeUnit | null> => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'units',
    where: { and: [{ id: { equals: p.docId } }, { _status: { equals: 'published' } }] },
    depth: 1,
    limit: 1,
  })
  const u = res.docs[0] as Unit | undefined
  if (!u) return null
  const isL = u.module === 'listening'
  const raw = (Array.isArray(u.passage) ? u.passage : []) as { label?: string; sentences?: { n: number; text: string }[]; translation?: string }[]
  const paragraphs: Paragraph[] = raw.map((x) => ({
    label: x.label || undefined,
    sentences: x.sentences ?? [],
    text: (x.sentences ?? []).map((s) => s.text).join(' '),
    ...(x.translation ? { translation: x.translation } : {}),
  }))
  const cet = isCet(u.exam) ? u.exam : undefined
  const items = (u.paraphrases as { items?: Record<string, { q: string; s: string }[]> } | null | undefined)?.items ?? {}
  const groups = (u.groups ?? []).map((g, gi) => {
    const view = toGroup(g, unitGroupKey(u.id, gi + 1), paragraphs, true)
    // 033 选词填空：包里的词库是两栏交错顺序（A、I、B、J…），按字母排
    if (cet && view.type === 'completion' && view.options.length) view.options = [...view.options].sort((a, b) => a.key.localeCompare(b.key))
    // 四 / 六级听力：每组说明都带同一段 Section 说明，第 2 组起去掉重复的那段，只留"Questions 3 and 4 are based on…"
    const head = (u.groups?.[0]?.instructions ?? '').split('\n')[0]
    if (cet && isL && gi > 0 && head && view.instructions.startsWith(head + '\n')) view.instructions = view.instructions.slice(head.length + 1)
    // 026 同义替换：按题号带进每道题
    view.questions = view.questions.map((q) => (items[q.number]?.length ? { ...q, paraphrases: items[q.number] } : q))
    return view
  })
  const only = p.group ? groups[p.group - 1] : undefined
  if (p.group && !only) return null

  const label = cet ? cetPartName(u.module, u.part) : `${isL ? 'Part' : 'Passage'} ${u.part}`
  const section: Section = {
    label,
    groups: only ? [only] : groups,
    ...(isL
      ? {
          audioUrl: url(u.audio),
          transcript: ((Array.isArray(u.transcript) ? u.transcript : []) as TranscriptLine[]).map(({ n, speaker, text, announce, start, end, p }) => ({ n, speaker, text, announce, start, end, p })),
          ...(Array.isArray(u.transcriptTranslations) ? { transcriptTranslations: u.transcriptTranslations as string[] } : {}),
        }
      : // 四 / 六级没有标题的文章，包里用首句截断（以…结尾）当标题，正文上方不再重复
        { passage: { title: cet && u.title.endsWith('…') ? '' : u.title, paragraphs: paragraphs.map((x) => ({ ...x, label: x.label ?? undefined })) } }),
  }
  return {
    id: unitId(p),
    docId: u.id,
    source: 'unit',
    version: u.updatedAt,
    module: u.module,
    // 四 / 六级标题带考试和试卷，错题本、收藏、进步曲线里也能看出是哪一套
    title: cet
      ? `${EXAM_NAME[cet]} ${paperLabel(u.paper)} · ${cetPartName(u.module, u.part)}${only ? rangeSuffix(only) : ''}`
      : `${u.title} · ${label}${only ? rangeSuffix(only) : ''}`,
    whole: false,
    sections: [section],
    ...(cet ? { exam: cet, paper: u.paper ?? undefined } : {}),
  }
}

export const getPracticeUnit = async (id: string): Promise<PracticeUnit | null> => {
  const p = parseUnitId(id)
  if (!p) return null
  if (p.kind === 'unit') return getUnit(p)
  const { payload, test } = await findPublished(p.docId)
  if (!test) return null

  const isL = p.module === 'l'
  const raw = isL
    ? (test.listening?.parts ?? []).map((s, i) => ({
        label: `Part ${i + 1}`,
        groups: s.groups ?? [],
        paragraphs: [] as Paragraph[],
        extra: { audioUrl: url(s.audio), transcript: text(s.transcript) },
      }))
    : (test.reading?.passages ?? []).map((s, i) => {
        const paragraphs = (s.paragraphs ?? []).map((x) => ({ label: x.label ?? undefined, text: x.text }))
        return {
          label: `Passage ${i + 1}`,
          groups: s.groups ?? [],
          paragraphs,
          extra: { passage: { title: s.title ?? '', paragraphs, imageUrl: url(s.image) } },
        }
      })
  if (!raw.length) return null

  const picked = p.section ? [p.section] : raw.map((_, i) => i + 1)
  const sections: Section[] = []
  for (const n of picked) {
    const s = raw[n - 1]
    if (!s) return null
    const groups = s.groups.map((g, gi) => toGroup(g, groupKey(p.docId, p.module, n, gi + 1), s.paragraphs))
    const only = p.group ? groups[p.group - 1] : undefined
    if (p.group && !only) return null
    sections.push({ label: s.label, ...s.extra, groups: only ? [only] : groups })
  }

  const name = isL ? '听力' : '阅读'
  const whole = !p.section
  let title = whole ? `${test.title} · 整套${name}` : `${test.title} · ${name} ${sections[0].label}`
  if (p.group) title += rangeSuffix(sections[0].groups[0])

  let bandScale: PracticeUnit['bandScale']
  if (whole) {
    const g = await payload.findGlobal({ slug: 'band-scales' })
    const rows = isL ? g.listening : g.reading
    bandScale = rows?.length ? rows.map(({ min, max, band }) => ({ min, max, band })) : isL ? listeningDefaults : readingDefaults
  }

  return {
    id: unitId(p),
    docId: p.docId,
    source: 'test',
    version: test.updatedAt,
    module: isL ? 'listening' : 'reading',
    title,
    whole,
    sections,
    bandScale,
  }
}

/** 编号最新、且该模块有内容的已发布套题的 Part 1 / Passage 1；没有套题时用练习单元 */
export const latestUnitId = async (module: Module): Promise<string | null> => {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'tests',
    where: { _status: { equals: 'published' } },
    depth: 0,
    limit: 100,
    sort: '-code',
  })
  const t = (res.docs as Test[]).find((d) => (module === 'l' ? d.listening?.parts?.length : d.reading?.passages?.length))
  if (t) return `t${t.id}-${module}1`
  // 没有套题时落到最近发布的练习单元 Part 1 / Passage 1（007）
  const u = await payload.find({
    collection: 'units',
    where: { _status: { equals: 'published' }, module: { equals: module === 'l' ? 'listening' : 'reading' }, part: { equals: 1 }, ...IELTS },
    depth: 0,
    limit: 1,
    sort: '-updatedAt',
    select: { title: true },
  })
  return u.docs[0] ? `u${u.docs[0].id}` : null
}
