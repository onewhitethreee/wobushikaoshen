'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import React, { useEffect, useState } from 'react'

// 审核页的题目信息（031 contracts/api.md context）：当前答案、去改题、前台打开、同题其他举报、已有相同举报通过的提示
type Context = {
  missing: boolean
  currentAnswers: string | null
  editHref: string | null
  practiceHref: string
  sameCount: number
  sameHref: string
  duplicateApproved: boolean
}

const box: React.CSSProperties = { marginBottom: 24, padding: 16, border: '1px solid var(--theme-elevation-150)', display: 'flex', flexDirection: 'column', gap: 8 }

export const ReportReview: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo()
  const snapshot = useFormFields(([fields]) => fields.keySnapshot?.value) as string | undefined
  const [ctx, setCtx] = useState<Context | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/answer-reports/context?id=${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCtx)
      .catch(() => {})
  }, [id])

  if (!ctx) return null
  const changed = !ctx.missing && (ctx.currentAnswers ?? '').trim() !== (snapshot ?? '').trim()
  return (
    <div style={box}>
      {ctx.missing ? (
        <strong>题目已不存在（已删除或未发布）</strong>
      ) : (
        <div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>当前标准答案{changed && '（提交后已修改）'}</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ctx.currentAnswers}</pre>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {ctx.editHref && (
          <a href={ctx.editHref} rel="noreferrer" target="_blank">
            去改这道题
          </a>
        )}
        <a href={ctx.practiceHref} rel="noreferrer" target="_blank">
          前台打开
        </a>
        {ctx.sameCount > 0 && <a href={ctx.sameHref}>同题其他举报 {ctx.sameCount} 条</a>}
      </div>
      {ctx.duplicateApproved && <strong>已有相同作答的举报通过，建议按“重复举报”驳回</strong>}
    </div>
  )
}
