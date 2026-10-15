import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 每个考生一行学习数据（009 research R6）：交卷记录、作答进度、写作草稿、收藏。
// 考生不能直接读写这个集合，只能经 /api/me/data 读写自己的那一行
export const MemberData: CollectionConfig = {
  slug: 'member-data',
  access: { read: authenticated, create: () => false, update: () => false, delete: authenticated },
  admin: { hidden: true },
  fields: [
    { name: 'member', type: 'relationship', relationTo: 'members', required: true, unique: true, index: true },
    { name: 'rev', type: 'number', defaultValue: 0, required: true },
    { name: 'data', type: 'json' },
  ],
  timestamps: true,
}
