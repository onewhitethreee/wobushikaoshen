import { NextResponse } from 'next/server'

import { getServerSideURL } from '@/utilities/getURL'

// 邀请链接 /i/<码>（011 research R4）：在这个浏览器记住邀请码 7 天，再去首页。
// 不在这里校验码是否有效；首次登录建号时（/api/auth/verify）才查，无效就忽略
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
  const res = NextResponse.redirect(new URL('/', getServerSideURL()), 302)
  if (code) {
    res.cookies.set('ybz_invite', code, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }
  return res
}
