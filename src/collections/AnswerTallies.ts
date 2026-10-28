import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 035：某题某种作答的计数（research R1、data-model）。补可接受答案时逐行重判 credit，改掉 / 删掉答案时整题删除
export const AnswerTallies: CollectionConfig = {
  slug: 'answer-tallies',
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  admin: { hidden: true },
  indexes: [{ fields: ['unitKey', 'number', 'unknown', 'answer'], unique: true }],
  fields: [
    { name: 'unitKey', type: 'text', required: true },
    { name: 'number', type: 'number', required: true },
    // normalize() 后的作答，截 60 字；多选排序后用 ", " 连接；未作答为 ''；unknown 行存得分的字符串
    { name: 'answer', type: 'text', required: true },
    // 回填时没有作答的旧记录（只知道对错）：不进"最常见错误答案"，重判时跳过
    { name: 'unknown', type: 'checkbox', required: true, defaultValue: false },
    { name: 'qType', type: 'text', required: true },
    { name: 'span', type: 'number', required: true },
    { name: 'credit', type: 'number', required: true },
    { name: 'count', type: 'number', required: true },
    { name: 'firstCount', type: 'number', required: true },
    { name: 'lastAt', type: 'date' },
  ],
}
