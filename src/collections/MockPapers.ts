import type { CollectionConfig, Field } from 'payload'
import { APIError } from 'payload'

import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { checkPaper, SLOTS, type SlotUnit } from '../exam/mock'
import type { Unit } from '../payload-types'

const NAME = { listening: '听力 Part', reading: '阅读 Passage' } as const

// 一个单元的全部题号（多选占 span 个）
const numbersOf = (u: Unit) =>
  (u.groups ?? []).flatMap((g) => (g.questions ?? []).flatMap((q) => Array.from({ length: Math.max(q.span ?? 1, 1) }, (_, i) => q.number + i)))

const slotField = (s: (typeof SLOTS)[number]): Field => ({
  name: s.key,
  label: `${NAME[s.module]} ${s.part}`,
  type: 'relationship',
  relationTo: 'units',
  required: true,
  filterOptions: { module: { equals: s.module }, part: { equals: s.part }, exam: { equals: 'ielts' } },
})

// 028 模考卷：听力 Part 1–4 + 阅读 Passage 1–3，只引用练习单元（research R1）。
// 组卷脚本 pnpm mock:compose 建草稿，站长看过后发布
export const MockPapers: CollectionConfig = {
  slug: 'mock-papers',
  labels: { singular: '模考卷', plural: '模考卷' },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['no', 'title', '_status'],
  },
  defaultSort: 'no',
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const full = { ...originalDoc, ...data } as Record<string, unknown>
        if (full._status !== 'published') return data
        const ids = SLOTS.map((s) => {
          const v = full[s.key]
          return typeof v === 'object' && v ? (v as { id: number }).id : (v as number | undefined)
        })
        const found = await req.payload.find({
          collection: 'units',
          where: { id: { in: ids.filter(Boolean) } },
          depth: 0,
          pagination: false,
          draft: true,
          req,
        })
        const units: SlotUnit[] = []
        SLOTS.forEach((s, i) => {
          const u = (found.docs as Unit[]).find((d) => d.id === ids[i])
          if (u) units.push({ slot: s.key, module: u.module, part: u.part, numbers: numbersOf(u) })
        })
        const errors = checkPaper(units)
        if (errors.length) throw new APIError(errors.join('\n'), 400, null, true)
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'no', label: '编号', type: 'number', required: true, unique: true, index: true, min: 1 },
        { name: 'title', label: '标题', type: 'text', required: true },
      ],
    },
    { type: 'row', fields: SLOTS.filter((s) => s.module === 'listening').map(slotField) },
    { type: 'row', fields: SLOTS.filter((s) => s.module === 'reading').map(slotField) },
  ],
}
