import { Shuffle } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'
import { drawHref, safeScope } from '@/practice/randomPick'

// 030：从"随机一题"进入写作页时，标题区放"再抽一题""返回列表"（写作没有交卷，一直显示）；pick 不合法时不显示
export const PickAgain: React.FC<{ pick?: string }> = ({ pick }) => {
  const scope = safeScope(pick)
  if (!scope) return null
  return (
    <div className="flex flex-wrap gap-2" data-testid="pick-again-bar">
      <Button asChild data-testid="pick-again">
        <Link href={drawHref(scope)}>
          <Shuffle aria-hidden="true" strokeWidth={2} />
          再抽一题
        </Link>
      </Button>
      <Button asChild variant="soft">
        <Link href={scope}>返回列表</Link>
      </Button>
    </div>
  )
}
