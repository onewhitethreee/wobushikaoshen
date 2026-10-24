import type { Access, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { authenticated, isAdmin } from '../access/authenticated'
import { grant } from '../account/credits'
import { reportContextEndpoint } from '../endpoints/answerReports'

// 答案纠错举报（031 research R1）：考生经 /api/me/answer-reports 提交；审核同小红书笔记：
// 选"已通过"（额度已预填，可改）→ 保存，同一事务里写入奖励流水；结论定了以后不能再改
const adminOrOwner: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true
  if (user?.collection === 'members') return { member: { equals: user.id } }
  return false
}

export const REJECT_PRESETS = ['判分正确', '超出字数限制', '拼写错误', '重复举报', '其他'] as const
const LOCKED = ['status', 'amount', 'rejectPreset', 'rejectReason'] as const

export const REPORT_KINDS = [
  { label: '我的答案也应该算对', value: 'accept' },
  { label: '标准答案错了', value: 'wrong' },
  { label: '其他', value: 'other' },
] as const

const readOnly = { readOnly: true }

export const AnswerReports: CollectionConfig = {
  slug: 'answer-reports',
  labels: { singular: '答案举报', plural: '答案举报' },
  access: { read: adminOrOwner, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    defaultColumns: ['createdAt', 'member', 'unitKey', 'number', 'kind', 'status', 'pendingOnSame'],
    useAsTitle: 'unitKey',
    components: { beforeList: ['@/components/Account/ReportsListFilter#ReportsListFilter'] },
  },
  defaultSort: 'createdAt',
  endpoints: [reportContextEndpoint],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update' || !originalDoc) return data
        const fail = (message: string, path: string) => {
          throw new ValidationError({ collection: 'answer-reports', errors: [{ message, path }] }, req.t)
        }
        if (originalDoc.status !== 'pending') {
          for (const k of LOCKED) if (k in data && (data[k] ?? null) !== (originalDoc[k] ?? null)) fail('已审核的举报不能再修改', k)
          return data
        }
        if (data.status === 'approved' && !(Number.isInteger(data.amount) && data.amount > 0)) fail('通过时额度必须是正整数', 'amount')
        if (data.status === 'rejected') {
          if (!data.rejectPreset) fail('请选择驳回理由', 'rejectPreset')
          if (data.rejectPreset === '其他' && !String(data.rejectReason ?? '').trim()) fail('选"其他"时请填写理由', 'rejectReason')
        }
        if (data.status && data.status !== 'pending') {
          data.reviewedBy = req.user?.collection === 'users' ? req.user.id : null
          data.reviewedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || previousDoc?.status !== 'pending' || doc.status !== 'approved') return doc
        const memberId = typeof doc.member === 'object' ? doc.member.id : doc.member
        const e = await grant(req.payload, {
          memberId,
          amount: doc.amount,
          reason: 'report',
          refKey: `report:${doc.id}`,
          note: `答案举报 ${doc.unitKey}#${doc.number}`,
          req,
        })
        if (!e) throw new Error('这条举报已经发放过额度')
        return doc
      },
    ],
  },
  fields: [
    { name: 'member', label: '考生', type: 'relationship', relationTo: 'members', required: true, admin: readOnly },
    {
      type: 'row',
      fields: [
        { name: 'unitKey', label: '单元', type: 'text', required: true, index: true, admin: readOnly },
        { name: 'number', label: '题号', type: 'number', required: true, admin: readOnly },
        {
          name: 'module',
          label: '栏目',
          type: 'select',
          options: [
            { label: '听力', value: 'listening' },
            { label: '阅读', value: 'reading' },
          ],
          admin: readOnly,
        },
        { name: 'sourceTag', label: '题集', type: 'text', admin: readOnly },
      ],
    },
    { name: 'review', type: 'ui', admin: { components: { Field: '@/components/Account/ReportReview#ReportReview' } } },
    { name: 'kind', label: '类型', type: 'select', required: true, options: [...REPORT_KINDS], admin: readOnly },
    { name: 'answer', label: '考生作答', type: 'text', maxLength: 200, admin: readOnly },
    { name: 'answerKey', type: 'text', index: true, admin: { hidden: true } },
    { name: 'keySnapshot', label: '提交时的标准答案', type: 'textarea', admin: readOnly },
    {
      type: 'row',
      fields: [
        { name: 'qType', label: '题型', type: 'text', admin: readOnly },
        { name: 'maxWords', label: '字数上限', type: 'number', admin: readOnly },
        { name: 'numberAllowed', label: '数字不计字数', type: 'checkbox', admin: readOnly },
      ],
    },
    { name: 'remark', label: '考生说明', type: 'textarea', maxLength: 200, admin: readOnly },
    // ponytail: 每行一次 count，列表每页 10–50 行可以忽略；举报多了再改成一条分组查询
    {
      name: 'pendingOnSame',
      label: '同题审核中',
      type: 'number',
      virtual: true,
      admin: { readOnly: true, position: 'sidebar' },
      hooks: {
        afterRead: [
          async ({ data, req }) =>
            data?.unitKey
              ? (
                  await req.payload.count({
                    collection: 'answer-reports',
                    overrideAccess: true,
                    req,
                    where: { unitKey: { equals: data.unitKey }, number: { equals: data.number }, status: { equals: 'pending' } },
                  })
                ).totalDocs
              : undefined,
        ],
      },
    },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: '审核中', value: 'pending' },
        { label: '已通过', value: 'approved' },
        { label: '已驳回', value: 'rejected' },
      ],
    },
    {
      name: 'amount',
      label: '发放额度',
      type: 'number',
      admin: { description: '通过时按这个数发放；已按「额度设置」预填，可修改', condition: (d) => d?.status !== 'rejected' },
    },
    {
      name: 'rejectPreset',
      label: '驳回理由',
      type: 'select',
      options: REJECT_PRESETS.map((v) => ({ label: v, value: v })),
      admin: { condition: (d) => d?.status === 'rejected' },
    },
    { name: 'rejectReason', label: '其他理由', type: 'text', admin: { condition: (d) => d?.status === 'rejected' && d?.rejectPreset === '其他' } },
    { name: 'reviewedBy', label: '审核人', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'reviewedAt', label: '审核时间', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
  timestamps: true,
}
