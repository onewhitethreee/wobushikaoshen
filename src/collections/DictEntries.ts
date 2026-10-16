import type { CollectionConfig } from 'payload'

// 站内词典（013 data-model "dict-entries"）：ECDICT 由 scripts/import-dict.ts 整表导入，约 40 万行。
// 后台不显示、任何人都不能经 Payload 读写；只由 /api/dict 直接查表
const deny = () => false

export const DictEntries: CollectionConfig = {
  slug: 'dict-entries',
  admin: { hidden: true },
  access: { read: deny, create: deny, update: deny, delete: deny },
  timestamps: false,
  fields: [
    { name: 'word', type: 'text', required: true, unique: true, index: true },
    { name: 'phonetic', type: 'text' },
    { name: 'translation', type: 'textarea' },
    { name: 'exchange', type: 'text' },
    // 只在"词典里没有单独一行的变形"上设置，指向原形
    { name: 'lemma', type: 'text' },
  ],
}
