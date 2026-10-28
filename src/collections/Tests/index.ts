import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { validateTest, type TestData } from '../../exam/validate'
import { sourceType } from '../../fields/sourceType'
import { questionGroupsField } from './questionGroup'
import { syncOnPublish, testDocQuestions } from '../../stats/keys'

// 套题：听力 4 Part + 阅读 3 篇，题组嵌在文档里（research R1）
export const Tests: CollectionConfig = {
  slug: 'tests',
  labels: { singular: '套题', plural: '套题' },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['code', 'title', 'sourceType', '_status'],
    components: { beforeListTable: ['@/components/ImportButton#ImportButton'] },
  },
  hooks: {
    // 035：发布时比对答案快照，补答案重判、改答案清零
    afterChange: [syncOnPublish(testDocQuestions)],
    // 发布时校验，草稿不校验（FR-014）
    beforeChange: [
      ({ data, originalDoc }) => {
        // 批量发布 / 取消发布只带改动的字段（如 { _status }），校验要看合并后的完整文档
        if (data._status === 'published') {
          const errors = validateTest({ ...originalDoc, ...data } as TestData)
          if (errors.length) throw new APIError(errors.join('\n'), 400, null, true)
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '基本信息',
          fields: [
            { name: 'title', label: '名称', type: 'text', required: true },
            {
              name: 'code',
              label: '编号',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              admin: { description: '如 T-012，导入时用来判断是否重复' },
            },
          ],
        },
        {
          label: '听力',
          fields: [
            {
              name: 'listening',
              label: false,
              type: 'group',
              fields: [
                {
                  name: 'parts',
                  label: 'Part',
                  labels: { singular: 'Part', plural: 'Part' },
                  type: 'array',
                  maxRows: 4,
                  fields: [
                    { name: 'audio', label: '音频', type: 'upload', relationTo: 'media' },
                    { name: 'transcript', label: '原文', type: 'textarea' },
                    questionGroupsField('groups'),
                  ],
                },
              ],
            },
          ],
        },
        {
          label: '阅读',
          fields: [
            {
              name: 'reading',
              label: false,
              type: 'group',
              fields: [
                {
                  name: 'passages',
                  label: '文章',
                  labels: { singular: '文章', plural: '文章' },
                  type: 'array',
                  maxRows: 3,
                  fields: [
                    { name: 'title', label: '标题', type: 'text' },
                    {
                      name: 'paragraphs',
                      label: '段落',
                      type: 'array',
                      fields: [
                        {
                          name: 'label',
                          label: '段落编号',
                          type: 'text',
                          admin: { description: 'A、B、C…（段落匹配题需要）' },
                        },
                        { name: 'text', label: '正文', type: 'textarea', required: true },
                      ],
                    },
                    { name: 'image', label: '配图', type: 'upload', relationTo: 'media' },
                    questionGroupsField('groups'),
                  ],
                },
              ],
            },
          ],
        },
        {
          label: '写作',
          fields: [
            {
              name: 'writing',
              label: false,
              type: 'group',
              fields: [
                {
                  name: 'task1',
                  label: 'Task 1',
                  type: 'relationship',
                  relationTo: 'writing-tasks',
                  filterOptions: { taskType: { equals: 'task1' } },
                },
                {
                  name: 'task2',
                  label: 'Task 2',
                  type: 'relationship',
                  relationTo: 'writing-tasks',
                  filterOptions: { taskType: { equals: 'task2' } },
                },
              ],
            },
          ],
        },
        {
          label: '口语',
          fields: [
            {
              name: 'speaking',
              label: false,
              type: 'group',
              fields: [
                {
                  name: 'part1',
                  label: 'Part 1',
                  type: 'relationship',
                  relationTo: 'speaking-questions',
                  hasMany: true,
                  filterOptions: { part: { equals: '1' } },
                },
                {
                  name: 'part2',
                  label: 'Part 2 题卡',
                  type: 'relationship',
                  relationTo: 'speaking-questions',
                  filterOptions: { part: { equals: '2' } },
                },
                {
                  name: 'part3',
                  label: 'Part 3',
                  type: 'relationship',
                  relationTo: 'speaking-questions',
                  hasMany: true,
                  filterOptions: { part: { equals: '3' } },
                },
              ],
            },
          ],
        },
      ],
    },
    sourceType,
  ],
}
