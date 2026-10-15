// 读后台「AI 设置」（global ai-settings）。只在需要 AI 的分支调用，写作转换不连数据库。
import 'dotenv/config'

export type AiSettings = { baseUrl: string; model: string; apiKey: string }

export async function loadAiSettings(): Promise<AiSettings | null> {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config.js')
  const payload = await getPayload({ config })
  const s = await payload.findGlobal({ slug: 'ai-settings' })
  const apiKey = s.apiKey?.trim()
  return apiKey ? { baseUrl: s.baseUrl.replace(/\/+$/, ''), model: s.model, apiKey } : null
}
