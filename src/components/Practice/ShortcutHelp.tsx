'use client'

import { Keyboard, X } from 'lucide-react'
import React, { useImperativeHandle, useRef } from 'react'

import { Kbd } from './AudioPlayer'

export type ShortcutHelpHandle = { open: () => void }

const KEYS: [string, string][] = [
  ['空格', '播放 / 暂停'],
  ['←', '回到句首 / 上一句'],
  ['→', '下一句'],
  ['R', '单句循环（交卷后）'],
  ['?', '打开这个说明'],
]

// 快捷键展示第三层（004 research R6）："快捷键"按钮 + 原生 <dialog>，Esc 原生关闭；只在有精确指针的设备上显示按钮
export const ShortcutHelp: React.FC<{ ref?: React.Ref<ShortcutHelpHandle> }> = ({ ref }) => {
  const dialog = useRef<HTMLDialogElement>(null)
  useImperativeHandle(ref, () => ({ open: () => dialog.current?.showModal() }))
  return (
    <>
      <button
        className="hidden min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground pointer-fine:inline-flex"
        onClick={() => dialog.current?.showModal()}
        title="快捷键（?）"
        type="button"
      >
        <Keyboard aria-hidden="true" className="size-4" strokeWidth={1.5} />
        快捷键
        <Kbd>?</Kbd>
      </button>
      <dialog
        aria-label="快捷键"
        className="m-auto w-[min(26rem,calc(100vw-2rem))] border border-foreground bg-card p-0 text-foreground backdrop:bg-background/75"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        ref={dialog}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-2">
          <h2 className="font-semibold">快捷键</h2>
          <button aria-label="关闭" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:bg-muted" onClick={() => dialog.current?.close()} type="button">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2.5 px-5 py-4 text-sm">
          {KEYS.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>
                <kbd className="inline-flex min-w-7 justify-center border border-border bg-muted px-1.5 font-sans text-xs font-semibold">{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p className="border-t border-border px-5 py-3 text-[13px] text-muted-foreground">光标在填空框里时，这些按键用于输入，不控制播放。</p>
      </dialog>
    </>
  )
}
