import type { AuthStrategy, Endpoint, Payload, PayloadRequest } from 'payload'
import { JWTAuthentication, logoutOperation } from 'payload'
import { generateExpiredPayloadCookie, parseCookies } from 'payload/shared'

// 考生与管理员原来共用 Payload 的 payload-token cookie，考生一登录就把后台登录挤掉（2026-10-17 站长发现，与邮箱无关）。
// 考生改用自己的 cookie（payload-member-token），由下面的策略认；后台页面和后台发出的请求不认它，两边可以同时登录

export const memberCookiePrefix = (payload: Payload) => `${payload.config.cookiePrefix}-member`

// 后台页面渲染（initReq）不带 req；后台界面发的接口请求 Referer 在 /admin 下
const fromAdmin = (req: PayloadRequest | undefined, adminRoute: string) => {
  if (!req) return true
  const ref = req.headers.get('referer')
  if (!ref) return false
  try {
    return new URL(ref).pathname.startsWith(adminRoute)
  } catch {
    return false
  }
}

export const memberCookieStrategy: AuthStrategy = {
  name: 'member-cookie',
  authenticate: async (args) => {
    const { headers, payload, req } = args as typeof args & { req?: PayloadRequest }
    if (fromAdmin(req, payload.config.routes.admin)) return { user: null }
    const token = parseCookies(headers).get(`${memberCookiePrefix(payload)}-token`)
    if (!token) return { user: null }
    // 换成 payload-token 交给 Payload 自带的 JWT 策略：签名、会话、Origin / Sec-Fetch-Site 检查都和原来一样
    const h = new Headers(headers)
    h.set('cookie', `${payload.config.cookiePrefix}-token=${token}`)
    h.delete('authorization')
    h.set('DisableAutologin', 'true')
    const result = await JWTAuthentication({ ...args, headers: h })
    return result.user?.collection === 'members' ? result : { user: null }
  },
}

/** 009–016 登录的考生令牌还在 payload-token 里：登录、退出时顺手清掉，管理员的不动 */
export const expiredLegacyCookie = (req: PayloadRequest): string | null =>
  req.user?.collection === 'members' && (req.user as { _strategy?: string })._strategy === 'local-jwt'
    ? (generateExpiredPayloadCookie({ collectionAuthConfig: req.payload.collections.members.config.auth, cookiePrefix: req.payload.config.cookiePrefix }) as string)
    : null

// 代替 Payload 自带的 /api/members/logout（它清的是 payload-token，会把后台一起退出）
export const memberLogout: Endpoint = {
  path: '/logout',
  method: 'post',
  handler: async (req) => {
    const { payload } = req
    if (req.user?.collection === 'members') await logoutOperation({ collection: payload.collections.members, req })
    const headers = new Headers()
    headers.append('Set-Cookie', generateExpiredPayloadCookie({ collectionAuthConfig: payload.collections.members.config.auth, cookiePrefix: memberCookiePrefix(payload) }) as string)
    const legacy = expiredLegacyCookie(req)
    if (legacy) headers.append('Set-Cookie', legacy)
    return Response.json({ ok: true }, { headers })
  },
}
