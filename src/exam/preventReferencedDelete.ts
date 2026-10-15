import type { CollectionBeforeDeleteHook, Where } from 'payload'
import { APIError } from 'payload'

// 被套题（或口语 Part 2 题卡）引用的写作题 / 口语题不能删除（FR-052）
export const preventReferencedDelete =
  (slug: 'writing-tasks' | 'speaking-questions'): CollectionBeforeDeleteHook =>
  async ({ id, req }) => {
    const { payload } = req
    const refs: string[] = []

    const testWhere: Where =
      slug === 'writing-tasks'
        ? { or: [{ 'writing.task1': { equals: id } }, { 'writing.task2': { equals: id } }] }
        : {
            or: [
              { 'speaking.part1': { equals: id } },
              { 'speaking.part2': { equals: id } },
              { 'speaking.part3': { equals: id } },
            ],
          }
    const tests = await payload.find({ collection: 'tests', where: testWhere, draft: true, depth: 0, limit: 50, req })
    refs.push(...tests.docs.map((t) => `套题 ${t.code}`))

    if (slug === 'speaking-questions') {
      const cards = await payload.find({
        collection: 'speaking-questions',
        where: { followUps: { equals: id } },
        draft: true,
        depth: 0,
        limit: 50,
        req,
      })
      refs.push(...cards.docs.map((c) => `口语题卡「${c.topic}」`))
    }

    if (refs.length) throw new APIError(`被以下内容引用，不能删除：${refs.join('、')}`, 400, null, true)
  }
