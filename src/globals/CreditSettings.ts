import type { Field, GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 额度设置（011 research R10）。改动只影响之后发放的额度：流水里存的是发放时的实际数额
const int = (name: string, label: string, defaultValue: number, min: number, description: string): Field => ({
  name,
  label,
  type: 'number',
  required: true,
  defaultValue,
  min,
  admin: { description },
  validate: (v: unknown) => (Number.isInteger(v) && (v as number) >= min ? true : `必须是 ≥ ${min} 的整数`),
})

export const CreditSettings: GlobalConfig = {
  slug: 'credit-settings',
  label: '额度设置',
  access: { read: authenticated, update: authenticated },
  fields: [
    int('inviterReward', '邀请人奖励', 3, 0, '每成功邀请 1 位新用户，邀请人得多少额度'),
    int('inviteeReward', '被邀请人奖励', 3, 0, '通过邀请链接注册的新用户得多少额度'),
    int('inviterCap', '邀请奖励上限（次）', 10, 0, '每位邀请人最多得几次邀请奖励；之后被邀请人照常得'),
    int('noteDefault', '笔记奖励默认值', 10, 1, '审核小红书笔记时预填的额度，可逐篇修改'),
  ],
}
