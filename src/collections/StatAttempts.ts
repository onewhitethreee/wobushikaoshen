import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 035 题目作答统计：一次交卷中的一个单元（模考已拆回来源单元），算单元级数字和"超过 X%"（research R1）。
// 考生不能直接读写，只经 POST /api/stats/attempts 和回填脚本写入；who 只用于判断首次作答，后台不显示（FR-003）
export const StatAttempts: CollectionConfig = {
  slug: 'stat-attempts',
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  admin: { hidden: true },
  indexes: [{ fields: ['who', 'firstKey'] }, { fields: ['unitId', 'first'] }],
  fields: [
    { name: 'attemptKey', type: 'text', required: true, unique: true },
    { name: 'who', type: 'text', required: true, index: true },
    { name: 'unitId', type: 'text', required: true, index: true },
    { name: 'unitKey', type: 'text', required: true, index: true },
    { name: 'firstKey', type: 'text', required: true },
    {
      name: 'exam',
      type: 'select',
      required: true,
      options: [
        { label: '雅思', value: 'ielts' },
        { label: '四级', value: 'cet4' },
        { label: '六级', value: 'cet6' },
      ],
    },
    {
      name: 'module',
      type: 'select',
      required: true,
      options: [
        { label: '听力', value: 'listening' },
        { label: '阅读', value: 'reading' },
      ],
    },
    { name: 'score', type: 'number', required: true },
    { name: 'total', type: 'number', required: true },
    { name: 'first', type: 'checkbox', required: true, defaultValue: false },
    { name: 'at', type: 'date', required: true, index: true },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'live',
      options: [
        { label: '实时', value: 'live' },
        { label: '回填', value: 'backfill' },
      ],
    },
  ],
}
