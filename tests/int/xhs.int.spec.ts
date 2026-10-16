import { describe, expect, it } from 'vitest'

import { parseNote } from '@/account/xhs'

const ID = '66f1a2b3c4d5e6f708192a3b'

describe('parseNote', () => {
  it('App 分享文本（前后有中文和表情）', () => {
    const text = `78 我不是考神发布了一篇小红书笔记，快来看吧！😆 http://xhslink.com/a/AbC123，复制本条信息，打开【小红书】App查看精彩内容！`
    expect(parseNote(text)).toEqual({ url: 'http://xhslink.com/a/AbC123', key: 'xhslink:a/AbC123' })
  })

  it('explore 链接带查询参数，按笔记 ID 去重', () => {
    const a = parseNote(`https://www.xiaohongshu.com/explore/${ID}?xsec_token=abc&xsec_source=pc_share`)
    const b = parseNote(`看看 https://xiaohongshu.com/explore/${ID.toUpperCase()}`)
    expect(a?.url).toBe(`https://www.xiaohongshu.com/explore/${ID}?xsec_token=abc&xsec_source=pc_share`)
    expect(a?.key).toBe(`xhs:${ID}`)
    expect(b?.key).toBe(`xhs:${ID}`)
  })

  it('discovery/item 链接', () => {
    expect(parseNote(`https://www.xiaohongshu.com/discovery/item/${ID}`)?.key).toBe(`xhs:${ID}`)
  })

  it('末尾标点不算进链接', () => {
    expect(parseNote(`链接：https://www.xiaohongshu.com/explore/${ID}。`)?.url).toBe(`https://www.xiaohongshu.com/explore/${ID}`)
  })

  it('不是小红书笔记链接返回 null', () => {
    expect(parseNote('https://www.xiaohongshu.com/user/profile/123')).toBeNull()
    expect(parseNote('https://example.com/explore/' + ID)).toBeNull()
    expect(parseNote('')).toBeNull()
    expect(parseNote(undefined)).toBeNull()
  })
})
