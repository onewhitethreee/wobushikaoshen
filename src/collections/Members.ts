import type { CollectionConfig } from 'payload'
import { Forbidden } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdminOrSelf } from '../access/isAdminOrSelf'

// 考生账号（009）。只能用邮箱验证码登录（src/endpoints/auth.ts 签发令牌）；
// 本地策略保留是因为 Payload 的 JWT 策略依赖它，密码在建号时随机生成、无人知道，密码相关操作一律拒绝（research R1）
const BLOCKED = new Set(['login', 'forgotPassword', 'resetPassword'])

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
    defaultColumns: ['email', 'lastLoginAt', 'createdAt'],
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
    // 删除考生时连同学习数据一起删（站长代为注销账号）
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({ collection: 'member-data', overrideAccess: true, req, where: { member: { equals: id } } })
      },
    ],
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.email === 'string') data.email = data.email.trim().toLowerCase()
        return data
      },
    ],
  },
  fields: [{ name: 'lastLoginAt', label: '最近登录', type: 'date', admin: { readOnly: true } }],
  timestamps: true,
}
