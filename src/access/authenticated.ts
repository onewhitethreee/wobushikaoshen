import type { AccessArgs } from 'payload'

import type { User } from '@/payload-types'

type isAuthenticated = (args: AccessArgs<User>) => boolean

// 只认后台管理员（users）。考生（members）也会出现在 req.user 上，不能只判断"有没有登录"（009 research R2）
export const isAdmin = (user: unknown): boolean =>
  Boolean(user && (user as { collection?: string }).collection === 'users')

export const authenticated: isAuthenticated = ({ req: { user } }) => isAdmin(user)
