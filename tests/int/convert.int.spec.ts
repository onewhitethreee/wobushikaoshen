import { describe, expect, it } from 'vitest'

import { dedupe, sourceIdOf, toWritingItem, type RawWriting, type WritingItem } from '../../scripts/convert/writing'

// 007 转换脚本的纯函数（数据为原创示例，不用 out/ 里的题）
describe('写作转换', () => {
  const raw = (patch: Partial<RawWriting> = {}): RawWriting => ({
    task: 'Task 1',
    type: 'task1_map',
    title: 'Park Changes',
    title_zh: '公园变化',
    prompt: 'The maps show a park in 2000 and today.',
    image: '123.png',
    ...patch,
  })

  it('从文件夹名取原始编号', () => {
    expect(sourceIdOf('地图 Park Changes 1000000000000000001')).toBe('1000000000000000001')
    expect(sourceIdOf('没有编号')).toBeNull()
  })

  it('映射分类、字数、用时与配图路径', () => {
    const w = toWritingItem(raw(), '地图 Park Changes 1234567') as WritingItem
    expect(w).toMatchObject({
      taskType: 'task1',
      category: 'map',
      titleZh: '公园变化',
      image: 'img/1234567.png',
      minWords: 150,
      suggestedMinutes: 20,
      sourceType: 'repost',
      sourceId: '1234567',
    })
    const t2 = toWritingItem(raw({ task: 'Task 2', type: 'task2_advantage_disadvantage', image: undefined }), 'x 7654321') as WritingItem
    expect(t2).toMatchObject({ taskType: 'task2', category: 'advantage', minWords: 250, suggestedMinutes: 40 })
    expect(t2.image).toBeUndefined()
  })

  it('Task 1 缺图、未知题型、无编号都报错', () => {
    expect(toWritingItem(raw({ image: undefined }), 'a 1234567')).toContain('缺少配图')
    expect(toWritingItem(raw({ type: 'task1_pie' }), 'a 1234567')).toContain('未知题型')
    expect(toWritingItem(raw(), '没有编号')).toContain('没有原始编号')
  })

  it('标题 + 题目相同的去重，保留第一份', () => {
    const a = toWritingItem(raw(), 'a 1111111') as WritingItem
    const b = toWritingItem(raw(), 'b 2222222') as WritingItem
    const c = toWritingItem(raw({ title: 'Other' }), 'c 3333333') as WritingItem
    const r = dedupe([a, b, c])
    expect(r.items.map((w) => w.sourceId)).toEqual(['1111111', '3333333'])
    expect(r.dropped[0]).toContain('2222222')
  })
})
