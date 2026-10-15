import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 登录验证码（009 research R3）：只存 HMAC，不存明文；后台隐藏
export const LoginCodes: CollectionConfig = {
  slug: 'login-codes',
  access: { read: authenticated, create: () => false, update: () => false, delete: authenticated },
  admin: { hidden: true },
  fields: [
    { name: 'email', type: 'text', index: true, required: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', defaultValue: 0, required: true },
    { name: 'usedAt', type: 'date' },
  ],
  timestamps: true,
}
