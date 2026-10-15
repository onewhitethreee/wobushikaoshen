import type { Access } from 'payload'

import { isAdmin } from './authenticated'

// 管理员看全部；考生只看自己那一条
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true
  if (user?.collection === 'members') return { id: { equals: user.id } }
  return false
}
