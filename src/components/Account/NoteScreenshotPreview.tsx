'use client'

import { useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import React, { useEffect, useState } from 'react'

// 审核页的截图大图（011 US3 场景 9）：upload 字段只有小缩略图，这里按原图显示，点击新窗口打开
export const NoteScreenshotPreview: UIFieldClientComponent = () => {
  const value = useFormFields(([fields]) => fields.screenshot?.value) as number | { id: number } | undefined
  const id = typeof value === 'object' ? value?.id : value
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/note-screenshots/${id}?depth=0`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { url?: string }) => setUrl(d.url ?? ''))
      .catch(() => {})
  }, [id])

  if (!url) return null
  return (
    <a href={url} rel="noreferrer" style={{ display: 'inline-block', marginBottom: 24 }} target="_blank">
      <img alt="笔记截图" src={url} style={{ maxHeight: 640, maxWidth: '100%', border: '1px solid var(--theme-elevation-150)' }} />
    </a>
  )
}
