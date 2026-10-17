import { randomInt } from 'crypto'
import type { CollectionConfig, Payload } from 'payload'
import { Forbidden } from 'payload'

import { authenticated, isAdmin } from '../access/authenticated'
import { balance } from '../account/credits'
import { isAdminOrSelf } from '../access/isAdminOrSelf'

// 考生账号（009）。用邮箱验证码或密码登录（012），两种都由 src/endpoints/auth.ts 签发令牌；
// 密码只能经 /api/me/password 设置（passwordSet = true）。建号时写入的随机密码无人知道，passwordSet 为 false 时密码登录不认它。
// Payload 自带的 login / forgotPassword / resetPassword 仍一律拒绝（009 research R1、012 research R1）
const BLOCKED = new Set(['login', 'forgotPassword', 'resetPassword'])

// 邀请码（011 research R4）：8 位，去掉 0/O/1/I/L 免得看错
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const newInviteCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

// 009 建的账号没有邀请码，第一次打开"我的额度"时补上；撞码（概率极低）就再试一次
export const ensureInviteCode = async (payload: Payload, memberId: number): Promise<string> => {
  const m = await payload.findByID({ collection: 'members', id: memberId, overrideAccess: true, depth: 0 })
  if (m.inviteCode) return m.inviteCode
  for (let i = 0; ; i++) {
    try {
      const code = newInviteCode()
      await payload.update({ collection: 'members', id: memberId, overrideAccess: true, data: { inviteCode: code } })
      return code
    } catch (err) {
      if (i >= 2) throw err
    }
  }
}

export const Members: CollectionConfig = {
  slug: 'members',
  labels: { singular: '考生', plural: '考生账号' },
  access: {
    admin: () => false,
    create: authenticated,
    delete: authenticated,
    read: isAdminOrSelf,
    unlock: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['email', 'passwordSet', 'lastLoginAt', 'createdAt'],
    useAsTitle: 'email',
  },
  // 生产环境只走 HTTPS 时发 cookie
  auth: { tokenExpiration: 60 * 60 * 24 * 30, cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' } },
  hooks: {
    beforeOperation: [
      ({ operation, args }) => {
        if (BLOCKED.has(operation)) throw new Forbidden(args.req?.t)
      },
    ],
    // 删除考生时连同学习数据、额度流水一起删（站长代为注销账号）
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({ collection: 'member-data', overrideAccess: true, req, where: { member: { equals: id } } })
        // 011：流水、笔记提交和截图随账号一起删（流水本身不允许删，这里是唯一的例外）
        await req.payload.delete({ collection: 'credit-entries', overrideAccess: true, req, where: { member: { equals: id } } })
        await req.payload.delete({ collection: 'note-submissions', overrideAccess: true, req, where: { member: { equals: id } } })
        // 删上传文档时 Payload 会一并删掉磁盘上的文件
        await req.payload.delete({ collection: 'note-screenshots', overrideAccess: true, req, where: { member: { equals: id } } })
      },
    ],
    beforeValidate: [
      ({ data, operation }) => {
        if (typeof data?.email === 'string') data.email = data.email.trim().toLowerCase()
        if (operation === 'create' && data && !data.inviteCode) data.inviteCode = newInviteCode()
        return data
      },
    ],
  },
  fields: [
    { name: 'lastLoginAt', label: '最近登录', type: 'date', admin: { readOnly: true } },
    { name: 'passwordSet', label: '已设密码', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    { name: 'inviteCode', label: '邀请码', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    { name: 'invitedBy', label: '邀请人', type: 'relationship', relationTo: 'members', admin: { readOnly: true } },
    // 后台考生详情（011 research R9）：余额现算、流水列表；在流水列表里可以直接新建一条人工调整
    {
      name: 'balance',
      label: '额度余额',
      type: 'number',
      virtual: true,
      admin: { readOnly: true },
      hooks: { afterRead: [({ data, req }) => (isAdmin(req.user) && data?.id ? balance(req.payload, data.id) : undefined)] },
    },
    { name: 'credits', label: '额度流水', type: 'join', collection: 'credit-entries', on: 'member', defaultSort: '-createdAt',
      admin: { defaultColumns: ['reason', 'amount', 'note', 'createdAt'] } },
  ],
  timestamps: true,
}
