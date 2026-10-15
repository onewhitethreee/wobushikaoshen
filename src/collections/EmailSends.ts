import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 发信记录（009 research R3）：限频按它计数，也供排查。不存邮件正文和验证码
export const EmailSends: CollectionConfig = {
  slug: 'email-sends',
  labels: { singular: '发信记录', plural: '发信记录' },
  access: {
    read: authenticated,
    create: () => false,
    update: () => false,
    delete: authenticated,
  },
  admin: { defaultColumns: ['email', 'kind', 'via', 'ok', 'createdAt'], useAsTitle: 'email' },
  fields: [
    { name: 'email', type: 'text', index: true, required: true },
    { name: 'ip', type: 'text', index: true },
    { name: 'kind', type: 'select', options: [{ label: '验证码', value: 'code' }, { label: '测试', value: 'test' }], required: true },
    {
      name: 'via',
      type: 'select',
      options: [
        { label: '主用', value: 'primary' },
        { label: '备用', value: 'backup' },
        { label: '未发出', value: 'none' },
      ],
    },
    { name: 'ok', type: 'checkbox', defaultValue: false },
    { name: 'error', type: 'text' },
  ],
  timestamps: true,
}
