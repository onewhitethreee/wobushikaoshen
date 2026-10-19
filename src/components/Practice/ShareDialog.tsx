'use client'

import React, { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { isMember } from '@/practice/syncClient'
import { cardContent, drawCard, fileName, qrTarget, type QrMatrix, type ShareResult } from '@/practice/shareCard'

// 成绩分享卡片对话框（025 contracts/ui.md）：原生 dialog（自带焦点约束和 Esc）；二维码库按需加载
const loadIcon = () =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = '/icon-512.png'
  })

const makeQr = async (text: string): Promise<QrMatrix | null> => {
  try {
    const { default: qrcode } = await import('qrcode-generator')
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    return { size: qr.getModuleCount(), isDark: (r, c) => qr.isDark(r, c) }
  } catch {
    return null
  }
}

export const ShareDialog: React.FC<{ result: ShareResult; open: boolean; onClose: () => void }> = ({ result, open, onClose }) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const [link, setLink] = useState<string | null | undefined>(undefined)
  const [include, setInclude] = useState(true)
  const [image, setImage] = useState<{ url: string; blob: Blob; qr: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // 已登录时取邀请链接；取不到当未登录
  useEffect(() => {
    if (!open || link !== undefined) return
    void isMember()
      .then((m) => (m ? fetch('/api/me/credits', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)) : null))
      .then((d: { invite?: { link?: string } } | null) => setLink(d?.invite?.link ?? null))
      .catch(() => setLink(null))
  }, [open, link])

  useEffect(() => {
    if (!open || link === undefined) return
    let alive = true
    const target = qrTarget({ link, include, origin: window.location.origin })
    void Promise.all([makeQr(target.url), loadIcon()]).then(([qr, icon]) => {
      if (!alive) return
      try {
        const canvas = document.createElement('canvas')
        drawCard(canvas, cardContent(result), target, qr, icon)
        canvas.toBlob((blob) => {
          if (!alive || !blob) return setFailed(!blob)
          const file = new File([blob], fileName(result.at), { type: 'image/png' })
          setCanShare(Boolean(navigator.canShare?.({ files: [file] })))
          setImage({ url: canvas.toDataURL('image/png'), blob, qr: target.url })
        }, 'image/png')
      } catch {
        setFailed(true)
      }
    })
    return () => {
      alive = false
    }
  }, [open, link, include, result])

  const download = () => {
    if (!image) return
    const url = URL.createObjectURL(image.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName(result.at)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const share = () => {
    if (!image) return
    void navigator.share({ files: [new File([image.blob], fileName(result.at), { type: 'image/png' })], title: '我不是考神 · 成绩' }).catch(() => undefined)
  }

  const c = cardContent(result)
  return (
    <dialog
      aria-labelledby="share-title"
      className="m-auto w-[min(92vw,30rem)] border border-border bg-background p-5 text-foreground backdrop:bg-foreground/40"
      data-testid="share-dialog"
      onClose={onClose}
      ref={dialog}
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-[20px] font-medium" id="share-title">
          分享成绩
        </h2>
        {failed ? (
          <p className="text-[15px] text-muted-foreground">这个浏览器生成不了图片。</p>
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element -- 浏览器里刚生成的 data URL
          <img
            alt={`成绩分享图：${c.subject}，答对 ${c.score}`}
            className="aspect-[3/4] w-full border border-border"
            data-qr={image.qr}
            data-testid="share-image"
            src={image.url}
          />
        ) : (
          <p className="flex aspect-[3/4] w-full items-center justify-center bg-muted text-muted-foreground">正在生成…</p>
        )}
        {link && (
          <label className="flex min-h-11 items-center gap-2 text-[15px]">
            <input checked={include} className="size-4" data-testid="share-invite" onChange={(e) => setInclude(e.target.checked)} type="checkbox" />
            带上我的邀请码
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button data-testid="share-save" disabled={!image} onClick={download} type="button">
            保存图片
          </Button>
          {canShare && (
            <Button data-testid="share-native" onClick={share} type="button" variant="outline">
              分享
            </Button>
          )}
          <Button className="ml-auto" onClick={() => dialog.current?.close()} type="button" variant="soft">
            关闭
          </Button>
        </div>
      </div>
    </dialog>
  )
}
