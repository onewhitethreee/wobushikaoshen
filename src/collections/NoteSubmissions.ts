import type { Access, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { authenticated, isAdmin } from '../access/authenticated'
import { grant } from '../account/credits'

// 笔记换额度（011 research R8；032 起平台可在「额度设置」里换）。考生经 /api/me/notes 提交；审核就在这个编辑页：
// 选"已通过"（额度已预填，可改）→ 保存，同一事务里写入笔记奖励流水；结论定了以后不能再改
const adminOrOwner: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true
  if (user?.collection === 'members') return { member: { equals: user.id } }
  return false
}

export const REJECT_PRESETS = ['链接打不开', '笔记里没提到本站', '截图和链接对不上', '重复提交', '其他'] as const
const LOCKED = ['status', 'amount', 'rejectPreset', 'rejectReason'] as const

export const NoteSubmissions: CollectionConfig = {
  slug: 'note-submissions',
  labels: { singular: '笔记换额度', plural: '笔记换额度' },
  access: { read: adminOrOwner, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    defaultColumns: ['createdAt', 'member', 'url', 'platform', 'status', 'amount'],
    useAsTitle: 'url',
    components: { beforeList: ['@/components/Account/NotesListFilter#NotesListFilter'] },
  },
  defaultSort: 'createdAt',
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update' || !originalDoc) return data
        const fail = (message: string, path: string) => {
          throw new ValidationError({ collection: 'note-submissions', errors: [{ message, path }] }, req.t)
        }
        if (originalDoc.status !== 'pending') {
          for (const k of LOCKED) if (k in data && (data[k] ?? null) !== (originalDoc[k] ?? null)) fail('已审核的提交不能再修改', k)
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
        const e = await grant(req.payload, { memberId, amount: doc.amount, reason: 'note', refKey: `note:${doc.id}`, note: `${doc.platform || '小红书'}笔记`, req })
        if (!e) throw new Error('这条提交已经发放过额度')
        return doc
      },
    ],
  },
  fields: [
    { name: 'member', label: '考生', type: 'relationship', relationTo: 'members', required: true, admin: { readOnly: true } },
    { name: 'url', label: '笔记链接', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'platform', label: '平台', type: 'text', admin: { readOnly: true, description: '提交时的平台；空 = 小红书' } },
    { name: 'noteKey', type: 'text', index: true, admin: { hidden: true } },
    { name: 'screenshot', label: '截图', type: 'upload', relationTo: 'note-screenshots', required: true, admin: { readOnly: true } },
    { name: 'screenshotPreview', type: 'ui', admin: { components: { Field: '@/components/Account/NoteScreenshotPreview#NoteScreenshotPreview' } } },
    { name: 'remark', label: '考生附言', type: 'textarea', maxLength: 200, admin: { readOnly: true } },
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

// 考生看到的驳回理由
export const rejectText = (d: { rejectPreset?: string | null; rejectReason?: string | null }) =>
  d.rejectPreset === '其他' ? (d.rejectReason ?? '') : (d.rejectPreset ?? '')
