import { revalidatePath } from 'next/cache'
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
    int('signupReward', '注册赠送', 10, 0, '新用户注册时得多少额度；通过邀请链接注册的另得被邀请人奖励'),
    int('inviterReward', '邀请人奖励', 3, 0, '每成功邀请 1 位新用户，邀请人得多少额度'),
    int('inviteeReward', '被邀请人奖励', 3, 0, '通过邀请链接注册的新用户得多少额度'),
    int('inviterCap', '邀请奖励上限（次）', 10, 0, '每位邀请人最多得几次邀请奖励；之后被邀请人照常得'),
    int('noteDefault', '笔记奖励默认值', 10, 1, '审核笔记时预填的额度，可逐篇修改'),
    int('reportDefault', '答案举报奖励默认值', 3, 1, '审核答案举报时预填的额度，可逐条修改'),
    // 032：去别的平台推广时，"小红书"会被当成广告——可以换成别的平台名或整个关掉
    {
      name: 'noteMode',
      label: '笔记平台',
      type: 'select',
      required: true,
      defaultValue: 'xhs',
      options: [
        { label: '小红书', value: 'xhs' },
        { label: '其他平台', value: 'other' },
        { label: '关闭', value: 'off' },
      ],
      admin: { description: '关闭后前台不再出现发笔记领额度；已在审核中的提交照常审核' },
    },
    {
      name: 'notePlatform',
      label: '平台名称',
      type: 'text',
      maxLength: 10,
      admin: { condition: (d) => d?.noteMode === 'other', description: '前台文案里的"小红书"都换成这个名称，如：抖音' },
      hooks: { beforeChange: [({ value }) => (typeof value === 'string' ? value.trim() : value)] },
      validate: (v: unknown, { siblingData }: { siblingData: { noteMode?: string } }) =>
        siblingData?.noteMode !== 'other' || (typeof v === 'string' && v.trim()) ? true : '请填写平台名称',
    },
  ],
  hooks: {
    // 首页、帮助页有 ISR 缓存（60 / 600 秒），设置改了马上失效（032 research R4）。
    // 测试、脚本里不在 Next 请求中，revalidatePath 会抛错；那里也没有页面缓存，忽略即可
    afterChange: [
      ({ doc, req: { context } }) => {
        if (!context.disableRevalidate) {
          try {
            revalidatePath('/', 'layout')
          } catch {}
        }
        return doc
      },
    ],
  },
}
