import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 写作批改记录（015 data-model）：只由服务端代码 overrideAccess 写，pending → done / failed 只写一次。
// 只有管理员能通过接口读；考生读自己的走 /api/me/writing-reviews（宪章 VI）
export const WritingReviews: CollectionConfig = {
  slug: 'writing-reviews',
  labels: { singular: '写作批改', plural: '写作批改' },
  access: {
    read: authenticated,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: {
    defaultColumns: ['member', 'task', 'status', 'overall', 'createdAt'],
    description: '考生的写作批改记录，只读。失败的记录考生看不到，失败原因和用量在详情里。',
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'member', label: '考生', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'task', label: '题目', type: 'relationship', relationTo: 'writing-tasks', required: true, index: true },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'pending',
      options: [
        { label: '批改中', value: 'pending' },
        { label: '完成', value: 'done' },
        { label: '失败', value: 'failed' },
      ],
    },
    { name: 'overall', label: '总分', type: 'number' },
    // 034 四 / 六级：原始分 0–15 和结果主体（档位理由、三方面点评或逐句对照、总体点评）；雅思为空
    { name: 'score', label: '原始分（四六级）', type: 'number', min: 0, max: 15 },
    { name: 'cet', label: '四六级结果', type: 'json' },
    { name: 'essay', label: '作文', type: 'textarea', required: true },
    { name: 'essayHash', label: '作文指纹', type: 'text', index: true, admin: { hidden: true } },
    { name: 'words', label: '词数', type: 'number' },
    { name: 'criteria', label: '四项分', type: 'json' },
    { name: 'paragraphs', label: '逐段建议', type: 'json' },
    { name: 'rewrites', label: '改写示例', type: 'json' },
    { name: 'lengthNote', label: '字数说明', type: 'text' },
    { name: 'failReason', label: '失败原因', type: 'text' },
    { name: 'spendEntry', label: '扣费流水', type: 'relationship', relationTo: 'credit-entries' },
    { name: 'refundEntry', label: '退回流水', type: 'relationship', relationTo: 'credit-entries' },
    { name: 'usage', label: 'AI 用量', type: 'json', admin: { description: '{ prompt, completion, ms, model }' } },
  ],
}
