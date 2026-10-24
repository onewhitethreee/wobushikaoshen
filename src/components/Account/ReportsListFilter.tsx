import Link from 'next/link'
import React from 'react'

// 后台「答案举报」列表上方的快捷筛选（031 contracts/ui.md）；栏目、题集用列表自带的筛选
export const ReportsListFilter: React.FC = () => (
  <p style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
    <Link href="/admin/collections/answer-reports?where[status][equals]=pending&sort=createdAt">只看审核中</Link>
    <Link href="/admin/collections/answer-reports?sort=-createdAt">全部</Link>
  </p>
)
