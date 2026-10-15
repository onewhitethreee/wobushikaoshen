import { describe, expect, it } from 'vitest'

import { safeNext } from '@/components/Account/LoginForm'

// 登录后跳转只许站内（009 安全自查）
describe('safeNext', () => {
  it('站内路径原样保留', () => {
    expect(safeNext('/me/mistakes?x=1#q-2')).toBe('/me/mistakes?x=1#q-2')
  })
  it.each(['//evil.com', '/\\evil.com', '/\t/evil.com', 'https://evil.com', 'javascript:alert(1)', '', undefined])('拦下 %j', (n) => {
    expect(safeNext(n)).toBe('/')
  })
})
