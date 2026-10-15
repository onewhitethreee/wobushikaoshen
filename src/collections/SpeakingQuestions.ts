import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { preventReferencedDelete } from '../exam/preventReferencedDelete'
import { validateSpeakingQuestion } from '../exam/validate'
import { sourceType } from '../fields/sourceType'

const isPart = (...parts: string[]) => (_d: unknown, sibling: { part?: string }) => parts.includes(sibling?.part ?? '')

// 口语题：Part 1 / 3 按话题一组问题，Part 2 是题卡并关联 Part 3 追问（FR-040 ~ FR-042）
export const SpeakingQuestions: CollectionConfig = {
  slug: 'speaking-questions',
  labels: { singular: '口语题', plural: '口语题' },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'topic',
    defaultColumns: ['topic', 'part', 'season', 'sourceType', '_status'],
    components: { beforeListTable: ['@/components/ImportButton#ImportButton'] },
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // 批量发布 / 取消发布只带改动的字段（如 { _status }），校验要看合并后的完整文档
        if (data._status === 'published') {
          const errors = validateSpeakingQuestion({ ...originalDoc, ...data })
          if (errors.length) throw new APIError(errors.join('\n'), 400, null, true)
        }
        return data
      },
    ],
    beforeDelete: [preventReferencedDelete('speaking-questions')],
  },
  fields: [
    {
      name: 'part',
      label: 'Part',
      type: 'select',
      required: true,
      options: [
        { label: 'Part 1', value: '1' },
        { label: 'Part 2（题卡）', value: '2' },
        { label: 'Part 3', value: '3' },
      ],
    },
    { name: 'topic', label: '话题', type: 'text', required: true, admin: { description: '如 Hometown' } },
    {
      name: 'questions',
      label: '问题',
      type: 'array',
      fields: [{ name: 'text', label: '问题', type: 'textarea', required: true }],
      admin: { condition: isPart('1', '3') },
    },
    {
      name: 'cueCard',
      label: '题卡',
      type: 'textarea',
      admin: { condition: isPart('2'), description: '如 Describe a conversation that changed your mind.' },
    },
    {
      name: 'cuePoints',
      label: '要点（You should say）',
      type: 'array',
      fields: [{ name: 'text', label: '要点', type: 'text', required: true }],
      admin: { condition: isPart('2') },
    },
    {
      name: 'followUps',
      label: '关联的 Part 3 追问',
      type: 'relationship',
      relationTo: 'speaking-questions',
      hasMany: true,
      filterOptions: { part: { equals: '3' } },
      admin: { condition: isPart('2') },
    },
    { name: 'season', label: '题季', type: 'text', admin: { description: '如 2026年9-12月' } },
    { name: 'sampleAnswer', label: '参考回答', type: 'textarea' },
    sourceType,
  ],
}
