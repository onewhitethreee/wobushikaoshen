import type { Endpoint } from 'payload'

import { checkPassword, clearFailures } from '../account/password'

// 设置 / 修改密码（012 contracts/api.md）。不要旧密码：忘记时用验证码登录后重设（spec FR-002）。
// 成功后只留当前会话，其他设备下一次请求就是未登录（research R5）
export const passwordEndpoint: Endpoint = {
  path: '/me/password',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    if (user?.collection !== 'members') return Response.json({ error: '请先登录' }, { status: 401 })
    const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
    const password = typeof body.password === 'string' ? body.password : ''
    const confirm = typeof body.confirm === 'string' ? body.confirm : ''
    const error = checkPassword(password, confirm, user.email)
    if (error) return Response.json({ error }, { status: 400 })

    const { payload } = req
    const id = user.id as number
    const firstTime = !user.passwordSet
    // 带上 req：Payload 改密码时会只留 req.user._sid 这一个会话、清掉其余（collections/operations/utilities/update.js）
    await payload.update({
      collection: 'members',
      id,
      overrideAccess: true,
      req,
      data: { password, passwordSet: true },
    })
    clearFailures(user.email)
    return Response.json({ ok: true, firstTime })
  },
}
