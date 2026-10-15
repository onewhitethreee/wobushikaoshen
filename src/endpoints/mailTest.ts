import type { Endpoint, PayloadRequest } from 'payload'

import { isAdmin } from '../access/authenticated'
import { MailUnavailable, sendTest } from '../account/mail'
import { clientIp, isEmail } from '../account/codes'

// 后台"发送测试邮件"（009 contracts/api.md）：只给管理员
export const mailTestEndpoint: Endpoint = {
  path: '/mail-settings/test',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!isAdmin(req.user)) return Response.json({ error: '只有管理员可以测试发信' }, { status: 403 })
    const body = (await req.json?.().catch(() => null)) as { which?: string; to?: string } | null
    const which = body?.which
    const to = String(body?.to ?? '').trim()
    if ((which !== 'primary' && which !== 'backup') || !isEmail(to)) {
      return Response.json({ error: '收件地址格式不对' }, { status: 400 })
    }
    try {
      await sendTest(req.payload, which, to, clientIp(req))
      return Response.json({ ok: true })
    } catch (err) {
      if (err instanceof MailUnavailable) return Response.json({ error: err.message }, { status: 502 })
      throw err
    }
  },
}
