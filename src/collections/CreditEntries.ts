import type { Access, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { authenticated, isAdmin } from '../access/authenticated'
import { balance, INTERNAL, purposeOf, USES } from '../account/credits'

// 额度流水（011 research R1）：只追加，余额 = 流水之和（宪章 II）。
// refKey 唯一："同一件事只发一次"交给数据库约束（邀请、笔记审核、退回）
const adminOrOwner: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true
  if (user?.collection === 'members') return { member: { equals: user.id } }
  return false
}

export const REASONS = [
  { label: '邀请奖励', value: 'invite' },
  { label: '被邀请奖励', value: 'invitee' },
  { label: '笔记奖励', value: 'note' },
  { label: '功能消耗', value: 'spend' },
  { label: '失败退回', value: 'refund' },
  { label: '管理员调整', value: 'adjust' },
] as const

export const CreditEntries: CollectionConfig = {
  slug: 'credit-entries',
  labels: { singular: '额度流水', plural: '额度流水' },
  access: {
    read: adminOrOwner,
    create: authenticated,
    update: () => false,
    delete: () => false,
  },
  admin: {
    defaultColumns: ['member', 'reason', 'use', 'amount', 'note', 'createdAt'],
    description: '流水不能修改或删除；发错了就新建一条反向调整。',
  },
  defaultSort: '-createdAt',
  hooks: {
    // 后台新建的流水只能是人工调整（FR-022）：必填备注、非 0 整数、调整后余额不为负。
    // ponytail: 这里的余额检查没加锁——后台只有站长一人操作，撞上考生同时扣减的概率很低；真出现负余额再追加一条调整
    beforeValidate: [
      async ({ data, operation, context, req }) => {
        if (operation !== 'create' || context[INTERNAL] || !data) return data
        data.reason = 'adjust'
        data.refKey = null
        data.relatedMember = null
        data.note = typeof data.note === 'string' ? data.note.trim() : ''
        const fail = (message: string, path: string) => {
          throw new ValidationError({ collection: 'credit-entries', errors: [{ message, path }] }, req.t)
        }
        if (!data.note) fail('人工调整必须填写备注', 'note')
        if (!Number.isInteger(data.amount) || data.amount === 0) fail('必须是非 0 整数', 'amount')
        const memberId = typeof data.member === 'object' ? data.member?.id : data.member
        if (!memberId) fail('请选择考生', 'member')
        const now = await balance(req.payload, Number(memberId))
        if (now + data.amount < 0) fail(`当前余额 ${now}，调整后不能小于 0`, 'amount')
        return data
      },
    ],
  },
  fields: [
    { name: 'member', label: '考生', type: 'relationship', relationTo: 'members', required: true, index: true },
    {
      name: 'amount',
      label: '变动',
      type: 'number',
      required: true,
      validate: (v: unknown) => (Number.isInteger(v) && v !== 0 ? true : '必须是非 0 整数'),
    },
    { name: 'reason', label: '原因', type: 'select', required: true, defaultValue: 'adjust', options: [...REASONS] },
    // 扣费 / 退回的用途，按 refKey 前缀算出来，不存库（015）
    {
      name: 'use',
      label: '用途',
      type: 'text',
      virtual: true,
      admin: { readOnly: true, condition: (data) => Boolean(purposeOf(data?.refKey)) },
      hooks: { afterRead: [({ data }) => (purposeOf(data?.refKey) ? USES[purposeOf(data?.refKey)!] : undefined)] },
    },
    { name: 'refKey', type: 'text', unique: true, admin: { readOnly: true, description: '防重复发放的唯一键' } },
    { name: 'relatedMember', label: '关联考生', type: 'relationship', relationTo: 'members', admin: { readOnly: true } },
    { name: 'note', label: '备注', type: 'text' },
  ],
  timestamps: true,
}
