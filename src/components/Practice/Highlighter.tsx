'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  addMark,
  removeMark,
  textNodes,
  toOffsets,
  toRange,
  type Marks,
  type Span,
} from '@/practice/marks'

// 014 做题高亮（research R1–R5、R10；contracts/ui.md）：只认 [data-hl] 区域和最近的 [data-section]，
// 状态由调用方保管，以后机考页直接挂。用 CSS Custom Highlight API 画，不改页面结构。
type Menu = {
  x: number
  y: number
  add?: { key: string; span: Span }
  clear?: { key: string; i: number }
}

const NAME = 'ybz-hl'
const keyOf = (region: Element) =>
  `${region.closest('[data-section]')?.getAttribute('data-section') ?? 0}:${region.getAttribute('data-hl')}`
// 有鼠标、浏览器支持才启用；触屏完全不挂监听（FR-008）
const supported = () =>
  typeof CSS !== 'undefined' &&
  'highlights' in CSS &&
  matchMedia('(hover: hover) and (pointer: fine)').matches
const regionOf = (n: Node | null) =>
  (n instanceof Element ? n : n?.parentElement)?.closest('[data-hl]') ?? null

export const Highlighter: React.FC<{
  root: React.RefObject<HTMLElement | null>
  marks: Marks
  onChange: (m: Marks) => void
}> = ({ root, marks, onChange }) => {
  const [menu, setMenu] = useState<Menu | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLElement | null>(null)
  // 右键按下那一刻的选区：macOS 右键会先自动选中鼠标下的词（research R4）
  const downSel = useRef<Range | null | undefined>(undefined)

  // 把偏移换成 Range 画出来；切 Part、隐藏原文、交卷等 DOM 变化后下一帧重画（research R3）
  useEffect(() => {
    const el = root.current
    if (!el || !supported()) return
    const paint = () => {
      const h = new Highlight()
      for (const region of el.querySelectorAll('[data-hl]')) {
        const list = marks[keyOf(region)]
        if (!list?.length) continue
        const nodes = textNodes(region)
        for (const s of list) {
          const r = toRange(region, s, nodes)
          if (r) h.add(r)
        }
      }
      CSS.highlights.set(NAME, h)
    }
    paint()
    let frame = 0
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(paint)
    })
    mo.observe(el, { childList: true, characterData: true, subtree: true })
    return () => {
      mo.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [marks, root])

  useEffect(() => () => void (supported() && CSS.highlights.delete(NAME)), [])

  // 右键：满足条件才拦截，否则浏览器菜单照常（FR-002、SC-005）
  useEffect(() => {
    const el = root.current
    if (!el || !supported()) return
    const onDown = (e: MouseEvent) => {
      if (e.button !== 2) return
      const s = getSelection()
      downSel.current = s && s.rangeCount && !s.isCollapsed ? s.getRangeAt(0).cloneRange() : null
    }
    const onMenu = (e: MouseEvent) => {
      const kb = downSel.current === undefined // 菜单键 / Shift+F10 不经过 mousedown
      const s = getSelection()
      const sel = kb
        ? s && s.rangeCount && !s.isCollapsed
          ? s.getRangeAt(0)
          : null
        : downSel.current
      downSel.current = undefined
      const target = e.target as Element
      if (
        !el.contains(target) ||
        target.closest?.('input, textarea, [data-lookup-card], [role="menu"]')
      )
        return

      let add: Menu['add']
      if (sel) {
        const region = regionOf(sel.startContainer)
        // 跨区域、不在区域里：整个不拦截（FR-003）
        if (!region || region !== regionOf(sel.endContainer) || !el.contains(region)) return
        const span = toOffsets(region, sel)
        if (span) add = { key: keyOf(region), span }
      }

      let clear: Menu['clear']
      const region = !kb && regionOf(target)
      if (region && el.contains(region)) {
        const key = keyOf(region)
        const nodes = textNodes(region)
        const i = (marks[key] ?? []).findIndex((sp) =>
          [...(toRange(region, sp, nodes)?.getClientRects() ?? [])].some(
            (r) =>
              e.clientX >= r.left &&
              e.clientX <= r.right &&
              e.clientY >= r.top &&
              e.clientY <= r.bottom,
          ),
        )
        if (i >= 0) clear = { key, i }
      }

      if (!add && !clear) return
      e.preventDefault()
      back.current = document.activeElement as HTMLElement | null
      const at = kb && sel ? sel.getBoundingClientRect() : null
      setMenu({ x: at ? at.right : e.clientX, y: at ? at.bottom : e.clientY, add, clear })
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('contextmenu', onMenu)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('contextmenu', onMenu)
    }
  }, [marks, root])

  const close = (restore: boolean) => {
    setMenu(null)
    if (restore) back.current?.focus({ preventScroll: true })
  }

  // 靠近视口边缘时翻到左 / 上方，离边缘至少 8px；打开时焦点到第一项
  useLayoutEffect(() => {
    const m = box.current
    if (!menu || !m) return
    const { width: w, height: h } = m.getBoundingClientRect()
    const x = menu.x + w > innerWidth - 8 ? Math.max(8, menu.x - w) : menu.x
    const y = menu.y + h > innerHeight - 8 ? Math.max(8, menu.y - h) : menu.y
    m.style.left = `${x}px`
    m.style.top = `${y}px`
    m.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [menu])

  // Esc、点菜单外、滚动、窗口失焦都关闭，不改动任何东西（FR-007）
  useEffect(() => {
    if (!menu) return
    const outside = (e: Event) => !box.current?.contains(e.target as Node) && close(false)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
      }
    }
    const shut = () => close(false)
    document.addEventListener('mousedown', outside, true)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', shut, true)
    window.addEventListener('blur', shut)
    return () => {
      document.removeEventListener('mousedown', outside, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', shut, true)
      window.removeEventListener('blur', shut)
    }
  }, [menu])

  // ::highlight() 写在组件里：Turbopack 的 CSS 解析器（Lightning CSS）不认这个伪元素，放进 globals.css 会报解析失败。
  // 文字统一用正文色：弱文字色（题组说明、播报语）在高亮底上对比度只有 4.2 / 4.4（research R7）
  const style = (
    <style href="ybz-hl" precedence="default">
      {`::highlight(${NAME}) { background-color: var(--highlight); color: var(--foreground); }`}
    </style>
  )
  if (!menu) return style

  const run = (f: () => void) => () => {
    f()
    close(true)
  }
  const arrows = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }
  // 焦点框用全站的 :focus-visible，向内收 2px 免得压在菜单边框上
  const item =
    'flex min-h-11 w-full items-center px-4 text-left hover:bg-muted focus-visible:-outline-offset-2'

  return (
    <>
      {style}
      {createPortal(
        <div
          aria-label="高亮"
          className="fixed z-40 min-w-32 border border-input bg-background py-1 text-[15px]"
          // 焦点移到菜单外的元素（Tab）就关闭；relatedTarget 为空时不算（Safari 点按钮不给焦点，离开窗口另有 blur）
          onBlur={(e) => e.relatedTarget && !box.current?.contains(e.relatedTarget) && close(false)}
          onKeyDown={arrows}
          ref={box}
          role="menu"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.add && (
            <button
              className={item}
              onClick={run(() => {
                const { key, span } = menu.add!
                onChange({ ...marks, [key]: addMark(marks[key] ?? [], span) })
                getSelection()?.removeAllRanges()
              })}
              role="menuitem"
              type="button"
            >
              高亮
            </button>
          )}
          {menu.clear && (
            <button
              className={item}
              onClick={run(() => {
                const { key, i } = menu.clear!
                onChange({ ...marks, [key]: removeMark(marks[key] ?? [], i) })
              })}
              role="menuitem"
              type="button"
            >
              清除高亮
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
