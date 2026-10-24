import { randomBytes } from 'crypto'
import { addDataAndFileToRequest, type Endpoint } from 'payload'

import { getSettings } from '../account/credits'
import { platformName } from '../account/notePlatform'
import { parseLink, parseNote } from '../account/xhs'
import { serialQueue } from '../utilities/serial'

// 提交笔记（011 contracts/api.md、research R7）：链接 + 截图必填。平台按「额度设置」（032）：关闭则拒绝，其他平台认任意 https 链接。
// 考生不能直接写 note-submissions / note-screenshots（create 只给管理员），只能走这里
const MAX_FILE = 5 * 1024 * 1024
const MAX_PENDING = 3
const TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const queue = serialQueue()

const fail = (error: string, status: number) => Response.json({ error }, { status })

export const notesEndpoint: Endpoint = {
  path: '/me/notes',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    if (user?.collection !== 'members') return fail('请先登录', 401)
    const settings = await getSettings(req.payload)
    const platform = platformName(settings)
    if (!platform) return fail('暂不开放', 403)
    await addDataAndFileToRequest(req)
    const data = (req.data ?? {}) as Record<string, unknown>
    const xhs = settings.noteMode === 'xhs'
    const note = xhs ? parseNote(data.text) : parseLink(data.text)
    if (!note) return fail(xhs ? '没找到小红书笔记链接' : '没找到链接', 400)
    const remark = typeof data.remark === 'string' ? data.remark.trim() : ''
    if (remark.length > 200) return fail('附言不能超过 200 字', 400)
    const file = req.file
    if (!file) return fail('请附上笔记截图', 400)
    if (file.size > MAX_FILE) return fail('截图不能超过 5MB', 413)
    const ext = TYPES[file.mimetype]
    if (!ext) return fail('截图只支持 jpg、png、webp', 400)

    const { payload } = req
    const memberId = user.id as number
    // 查"待审数、是否重复"和写入排队执行：原来并发提交能同时通过检查，绕过 3 条上限、重复提交同一篇
    return queue(async () => {
      const [pending, dup] = await Promise.all([
        payload.count({ collection: 'note-submissions', overrideAccess: true, where: { member: { equals: memberId }, status: { equals: 'pending' } } }),
        payload.count({ collection: 'note-submissions', overrideAccess: true, where: { noteKey: { equals: note.key }, status: { in: ['pending', 'approved'] } } }),
      ])
      if (pending.totalDocs >= MAX_PENDING) return fail(`还有 ${MAX_PENDING} 条在审核中，审核后再提交`, 429)
      if (dup.totalDocs) return fail('这篇笔记已经提交过', 409)

      // 随机文件名：不把考生电脑上的原文件名带进来
      file.name = randomBytes(12).toString('hex') + ext
      const shot = await payload.create({ collection: 'note-screenshots', overrideAccess: true, req, data: { member: memberId }, file })
      const doc = await payload.create({
        collection: 'note-submissions',
        overrideAccess: true,
        req,
        data: { member: memberId, url: note.url, noteKey: note.key, platform, screenshot: shot.id, remark, status: 'pending', amount: settings.noteDefault },
      })
      return Response.json({ ok: true, id: doc.id }, { status: 201 })
    })
  },
}
