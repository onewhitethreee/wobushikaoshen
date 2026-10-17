import { randomInt } from 'crypto'
import type { CollectionConfig, Field } from 'payload'

import { authenticated } from '../access/authenticated'
import { ALPHABET } from './Members'

// 兑换码：管理员生成，考生在「我的额度」兑换（src/account/credits.ts 的 redeem）。
// 用过几次不存字段，按流水里的 refKey（redeem:<码 id>:<考生 id>）数出来（宪章 II）

// 16 位分 4 组，约 79 位随机，猜不出来；考生输入时大小写、横线、空格都不讲究
export const formatCode = (s: unknown) =>
  (String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/.{1,4}/g) ?? []).join('-')
const newCode = () => formatCode(Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''))

const int = (name: string, label: string, defaultValue: number | undefined, description: string): Field => ({
  name,
  label,
  type: 'number',
  required: true,
  defaultValue,
  min: 1,
  admin: { description },
  validate: (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 ? true : '必须是 ≥ 1 的整数'),
})

export const RedeemCodes: CollectionConfig = {
  slug: 'redeem-codes',
  labels: { singular: '兑换码', plural: '兑换码' },
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'amount', 'used', 'maxUses', 'expiresAt', 'note', 'createdAt'],
    description: '保存后自动生成兑换码，复制发给考生。每位考生每个码只能用一次；想提前作废，把到期时间改成现在。',
  },
  defaultSort: '-createdAt',
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation === 'create' && data) data.code = newCode()
        return data
      },
    ],
  },
  fields: [
    {
      name: 'code',
      label: '兑换码',
      type: 'text',
      required: true,
      unique: true,
      access: { update: () => false },
      admin: { readOnly: true, description: '保存后自动生成' },
    },
    int('amount', '额度', undefined, '兑换一次得多少额度'),
    int('maxUses', '可用次数', 1, '总共能被几位考生兑换'),
    {
      name: 'used',
      label: '已用',
      type: 'number',
      virtual: true,
      admin: { readOnly: true, condition: (data) => Boolean(data?.id) },
      hooks: {
        afterRead: [
          async ({ data, req }) =>
            data?.id
              ? (await req.payload.count({ collection: 'credit-entries', overrideAccess: true, where: { refKey: { like: `redeem:${data.id}:` } } })).totalDocs
              : 0,
        ],
      },
    },
    { name: 'expiresAt', label: '到期时间', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' }, description: '不填就一直有效' } },
    { name: 'note', label: '备注', type: 'text', admin: { description: '发给谁、什么活动，考生看不到' } },
  ],
  timestamps: true,
}
