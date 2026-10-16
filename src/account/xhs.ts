// 从小红书分享文本里取笔记链接（011 research R7）。key 用于去重：
// 完整链接按笔记 ID；短链接不在服务端解析（那要访问外网），按短链路径——同一篇用不同短链重复提交时由管理员看截图判断
const FULL = /https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/([0-9a-f]{24})[^\s，。！？、）)】]*/i
const SHORT = /https?:\/\/xhslink\.com\/([\w/]+)[^\s，。！？、）)】]*/i

export const parseNote = (text: unknown): { url: string; key: string } | null => {
  if (typeof text !== 'string') return null
  const full = FULL.exec(text)
  const short = SHORT.exec(text)
  // 两种都有时取先出现的那个
  const m = full && (!short || full.index <= short.index) ? full : short
  if (!m) return null
  const url = m[0].replace(/[.,;:!?'"]+$/, '')
  return { url, key: m === full ? `xhs:${m[1].toLowerCase()}` : `xhslink:${m[1].replace(/\/+$/, '')}` }
}
