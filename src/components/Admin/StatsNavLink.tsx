import Link from 'next/link'
import React from 'react'

// 035：后台导航栏"作答统计"入口
export const StatsNavLink: React.FC = () => (
  <Link className="nav__link" href="/admin/stats" style={{ display: 'block', padding: '4px 0' }}>
    作答统计
  </Link>
)
