// 生产环境密钥守卫（010 research R13）。代码公开后 .env.example 的示例值人人可见；PAYLOAD_SECRET 同时用于签发登录令牌
// 和验证码 HMAC，照抄示例值就等于谁都能伪造管理员。构建阶段（next build）还没有生产密钥，不检查
const NAMES = ['PAYLOAD_SECRET', 'CRON_SECRET', 'PREVIEW_SECRET'] as const

export const checkSecrets = (env: Record<string, string | undefined> = process.env) => {
  if (env.NODE_ENV !== 'production' || env.NEXT_PHASE === 'phase-production-build') return
  for (const name of NAMES) {
    const v = env[name] ?? ''
    if (v.length < 32 || v.includes('YOUR_')) {
      throw new Error(`生产环境 ${name} 未设置或是示例值：请换成至少 32 位的随机字符串（如 openssl rand -hex 32）`)
    }
  }
}
