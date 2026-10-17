'use client'

import React, { useEffect, useState } from 'react'

// 栏目侧栏的余额：已登录读 /api/me/credits，未登录（401）提示登录；加载中不显示，避免闪一下"登录后查看"
export const QuotaBalance: React.FC = () => {
  const [balance, setBalance] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    fetch('/api/me/credits', { credentials: 'include' })
      .then(async (res) => setBalance(res.ok ? ((await res.json()) as { balance: number }).balance : null))
      .catch(() => setBalance(null))
  }, [])

  if (balance === undefined) return <p className="mb-3 min-h-9" />
  if (balance === null) return <p className="mb-3 font-semibold">登录后查看额度</p>
  return (
    <p className="mb-3">
      剩余 <b className="text-3xl font-medium">{balance}</b> 额度
    </p>
  )
}
