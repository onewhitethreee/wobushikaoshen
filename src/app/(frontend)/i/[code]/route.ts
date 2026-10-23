import { NextResponse } from 'next/server'

import { INVITE_COOKIE, normalizeInviteCode } from '@/account/invite'
import { getServerSideURL } from '@/utilities/getURL'

// 邀请链接 /i/<码>（011 research R4）：在这个浏览器记住邀请码 7 天，再去登录页（带上码，页面显示邀请提示并预填）。
// 不在这里校验码是否有效；首次登录建号时（/api/auth/verify）才查，无效就忽略
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeInviteCode((await params).code)
  const res = NextResponse.redirect(new URL(code ? `/login?invite=${code}` : '/', getServerSideURL()), 302)
  if (code) {
    res.cookies.set(INVITE_COOKIE, code, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }
  return res
}
