import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 035：每题上次统计时用的标准答案（research R6）。单元发布时和它比：只多了行 → 重判；改掉 / 删掉行 → 清零并记 resetAt
export const QuestionKeys: CollectionConfig = {
  slug: 'question-keys',
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  admin: { hidden: true },
  indexes: [{ fields: ['unitKey', 'number'], unique: true }],
  fields: [
    { name: 'unitKey', type: 'text', required: true },
    { name: 'number', type: 'number', required: true },
    // 一行一个，已 normalize()
    { name: 'answers', type: 'textarea' },
    { name: 'resetAt', type: 'date' },
  ],
}
