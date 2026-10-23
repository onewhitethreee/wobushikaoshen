// 邀请码（011）：邀请链接 /i/<码> 记在这个 cookie 里 7 天；登录页的"邀请码"输入框优先于它（换了浏览器 cookie 就没了）
export const INVITE_COOKIE = 'ybz_invite'

/** 链接、cookie、输入框里的码统一成大写字母数字（码本身 8 位，最多留 16 位） */
export const normalizeInviteCode = (s: unknown) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
