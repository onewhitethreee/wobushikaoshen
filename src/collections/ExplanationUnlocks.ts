import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 讲解查看权（015 data-model）：考生付过费的讲解，本人再看不扣（FR-033）。key = {memberId}:{缓存键指纹}，唯一
export const ExplanationUnlocks: CollectionConfig = {
  slug: 'explanation-unlocks',
  labels: { singular: '讲解查看权', plural: '讲解查看权' },
  access: {
    read: authenticated,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: { hidden: true },
  fields: [
    { name: 'member', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'cacheKey', type: 'text', required: true },
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'spendEntry', type: 'relationship', relationTo: 'credit-entries' },
  ],
}
