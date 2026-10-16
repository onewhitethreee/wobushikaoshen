import type { Access, CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { authenticated, isAdmin } from '../access/authenticated'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// 小红书笔记截图（011 research R6）：存在服务器磁盘的 private/ 下，不在 public/ 里，
// 只能经 /api/note-screenshots/file/<名> 读取，Payload 读文件前套用下面的 read 权限。不进 S3（payload.config 的 s3Storage 只列了 media）
const adminOrOwner: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true
  if (user?.collection === 'members') return { member: { equals: user.id } }
  return false
}

export const NoteScreenshots: CollectionConfig = {
  slug: 'note-screenshots',
  labels: { singular: '笔记截图', plural: '笔记截图' },
  access: { read: adminOrOwner, create: authenticated, update: authenticated, delete: authenticated },
  admin: { hidden: true },
  upload: {
    staticDir: path.resolve(dirname, '../../private/note-screenshots'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  fields: [{ name: 'member', type: 'relationship', relationTo: 'members', required: true, index: true }],
  timestamps: true,
}
