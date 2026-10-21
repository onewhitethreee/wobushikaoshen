import { CircleAlert } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'

// 有未答题时的页内确认条（FR-014），不用弹窗
export const SubmitConfirm: React.FC<{ left: number; flagged?: number; onCancel: () => void; onConfirm: () => void }> = ({ left, flagged = 0, onCancel, onConfirm }) => (
  <div className="container animate-reveal pt-3" role="alert">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-warning-soft px-4 py-2.5">
      <p className="flex items-center gap-2 font-semibold text-warning tabular-nums">
        <CircleAlert aria-hidden="true" className="size-4" strokeWidth={2.2} />
        {left > 0 ? `还有 ${left} 题没做` : '确定交卷？'}
        {flagged > 0 && `，已标记 ${flagged} 题`}
      </p>
      <div className="ml-auto flex gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          继续作答
        </Button>
        <Button onClick={onConfirm} type="button">
          仍然交卷
        </Button>
      </div>
    </div>
  </div>
)
