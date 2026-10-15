import type { Access } from 'payload'

import { isAdmin } from './authenticated'

export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (isAdmin(user)) {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}
