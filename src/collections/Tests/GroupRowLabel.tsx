'use client'
import { type RowLabelProps, useRowLabel } from '@payloadcms/ui'

import { typeLabel } from './questionTypes'

type Row = { type?: string; questions?: { number?: number; span?: number }[] }

// 题组折叠标题："单选 · 第 11–15 题"
export const GroupRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<Row>()
  const nums = (data?.questions ?? []).flatMap((q) =>
    typeof q.number === 'number' ? [q.number, q.number + (q.span && q.span > 1 ? q.span - 1 : 0)] : [],
  )
  const range = nums.length ? `第 ${Math.min(...nums)}–${Math.max(...nums)} 题` : '还没有题目'
  const name = (data?.type && typeLabel[data.type]) || `题组 ${(rowNumber ?? 0) + 1}`
  return <div>{`${name} · ${range}`}</div>
}
