// 密码规则（012 research R7）。单独成文件，浏览器端也能引用（password.ts 用到了 Node 的 crypto）
/** 前后端共用；返回错误文案，合规时返回 null。不去首尾空格，长度按字符数算 */
export const checkPassword = (password: string, confirm: string, email: string): string | null => {
  const len = [...password].length
  if (len < 8) return '密码至少 8 个字符'
  if (len > 64) return '密码最多 64 个字符'
  const p = password.toLowerCase()
  const e = email.trim().toLowerCase()
  if (p === e || p === e.split('@')[0]) return '密码不能和邮箱相同'
  if (password !== confirm) return '两次输入的密码不一样'
  return null
}
