import Link from 'next/link'
import React from 'react'

// 后台「小红书笔记」列表上方的快捷筛选：审核时只看"审核中"，按提交时间先后处理（011 research R8）
export const NotesListFilter: React.FC = () => (
  <p style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
    <Link href="/admin/collections/note-submissions?where[status][equals]=pending&sort=createdAt">只看审核中</Link>
    <Link href="/admin/collections/note-submissions?sort=-createdAt">全部</Link>
  </p>
)
