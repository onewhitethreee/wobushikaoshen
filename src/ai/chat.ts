import type { Payload } from 'payload'

// 一次 OpenAI 兼容的 chat 请求（015 research R8）。写作批改、错题讲解、图表转文字共用；
// 离线抽答案的 scripts/convert/answers.ts 自带重试和缓存，不走这里

export type Ai = { baseUrl: string; model: string; visionModel: string; apiKey: string }
export type Usage = { prompt: number; completion: number; ms: number; model: string }
export type Message = { role: 'system' | 'user' | 'assistant'; content: string | unknown[] }

// key 为空 = 不可用（FR-013）
export const loadAi = async (payload: Payload): Promise<Ai | null> => {
  const s = await payload.findGlobal({ slug: 'ai-settings', overrideAccess: true })
  if (!s.apiKey) return null
  return { baseUrl: s.baseUrl.replace(/\/+$/, ''), model: s.model, visionModel: s.visionModel || 'deepseek-flash', apiKey: s.apiKey }
}

export const chat = async (
  ai: Ai,
  {
    model = ai.model,
    messages,
    json = false,
    timeoutMs,
    maxTokens,
    thinking,
  }: { model?: string; messages: Message[]; json?: boolean; timeoutMs: number; maxTokens: number; thinking?: false },
): Promise<{ content: string; usage: Usage }> => {
  const t0 = Date.now()
  const res = await fetch(`${ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ai.apiKey}` },
    // max_tokens 给单次输出封顶，防止输出失控刷成本；思考 token 也算在 max_tokens 里
    // thinking 只在调用方明确传 false 时才发（DeepSeek 认；别的 OpenAI 兼容接口不一定认）
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      messages,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      ...(thinking === false ? { thinking: { type: 'disabled' } } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  // 错误信息里只放状态码和响应开头，不带请求头（key）
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回为空')
  return {
    content,
    usage: { prompt: body.usage?.prompt_tokens ?? 0, completion: body.usage?.completion_tokens ?? 0, ms: Date.now() - t0, model },
  }
}
