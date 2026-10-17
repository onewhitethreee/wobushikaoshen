// 014 做题高亮（research R2、R9）：一段高亮记成区域计数文本里的 [start, end)。
// 计数文本 = 区域根下的文本节点按文档顺序拼接，跳过 [data-hl-skip] 里的（交卷后才出现、随作答变化的文字）

export type Span = [number, number]
/** 键 `${section}:${region}`，如 "0:p"；区间按起点升序、互不重叠也不相接 */
export type Marks = Record<string, Span[]>

export const addMark = (list: Span[], [s, e]: Span): Span[] => {
  if (s >= e) return list
  const out: Span[] = []
  for (const [a, b] of list) {
    if (b < s || a > e) out.push([a, b])
    else {
      s = Math.min(s, a)
      e = Math.max(e, b)
    }
  }
  out.push([s, e])
  return out.sort((x, y) => x[0] - y[0])
}

export const removeMark = (list: Span[], i: number): Span[] => list.filter((_, j) => j !== i)

/** 区域里参与计数的文本节点 */
export const textNodes = (root: Element): Text[] => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const skip = n.parentElement?.closest('[data-hl-skip]')
      return skip && root.contains(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })
  const out: Text[] = []
  while (w.nextNode()) out.push(w.currentNode as Text)
  return out
}

export const regionText = (root: Element) => textNodes(root).map((n) => n.data).join('')

/** 边界点 (node, offset) 在计数文本里的位置：落在被跳过的节点或元素边界时，按文档顺序就近取 */
const offsetOf = (nodes: Text[], node: Node, offset: number): number => {
  const point = document.createRange()
  point.setStart(node, offset)
  let pos = 0
  for (const t of nodes) {
    if (t === node) return pos + Math.min(offset, t.length)
    // 文本节点在边界点之后：边界点落在它前面
    if (point.comparePoint(t, 0) > 0) return pos
    pos += t.length
  }
  return pos
}

export const toOffsets = (root: Element, range: Range): Span | null => {
  const nodes = textNodes(root)
  const s = offsetOf(nodes, range.startContainer, range.startOffset)
  const e = offsetOf(nodes, range.endContainer, range.endOffset)
  return s < e ? [s, e] : null
}

export const toRange = (root: Element, [s, e]: Span, nodes = textNodes(root)): Range | null => {
  const r = document.createRange()
  let pos = 0
  let started = false
  for (const t of nodes) {
    const end = pos + t.length
    if (!started && s < end) {
      r.setStart(t, s - pos)
      started = true
    }
    if (started && e <= end) {
      r.setEnd(t, e - pos)
      return r.collapsed ? null : r
    }
    pos = end
  }
  if (!started) return null
  const last = nodes[nodes.length - 1]
  r.setEnd(last, last.length) // 文本变短：截断到末尾
  return r.collapsed ? null : r
}
