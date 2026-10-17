import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 错题讲解缓存（015 data-model）：同一题、同一单元版本、同一错误答案只生成一次，考生之间共用。
// 只由服务端代码写；管理员可改正文、可删除（删掉后下次请求重新生成，FR-036）
export const AnswerExplanations: CollectionConfig = {
  slug: 'answer-explanations',
  labels: { singular: '错题讲解', plural: '错题讲解' },
  access: {
    read: authenticated,
    create: () => false,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'cacheKey',
    defaultColumns: ['unitId', 'number', 'answer', 'createdAt'],
    description: 'AI 生成的错题讲解，按题目和错误答案缓存。可以改正文；删掉后下次有人请求会重新生成。',
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'cacheKey', label: '缓存键', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'unitId', label: '单元', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'number', label: '题号', type: 'number', admin: { readOnly: true } },
    { name: 'answer', label: '错误答案', type: 'text', admin: { readOnly: true, description: '规范化后的答案，未作答为 ∅' } },
    { name: 'body', label: '讲解', type: 'textarea', required: true, admin: { description: '**粗体** 显示为粗体' } },
    { name: 'usage', label: 'AI 用量', type: 'json', admin: { readOnly: true } },
  ],
}
