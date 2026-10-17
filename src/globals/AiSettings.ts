import type { GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// AI 服务设置（OpenAI 兼容接口，默认 DeepSeek）。离线转换抽答案、写作批改、错题讲解、图表转文字都读它。
// 只给后台账号读写，前台不读取（specs/007 research R13）
export const AiSettings: GlobalConfig = {
  slug: 'ai-settings',
  label: 'AI 设置',
  access: { read: authenticated, update: authenticated },
  fields: [
    {
      name: 'baseUrl',
      label: '接口地址',
      type: 'text',
      required: true,
      defaultValue: 'https://api.deepseek.com',
      admin: { description: 'OpenAI 兼容接口，请求 {接口地址}/chat/completions' },
    },
    { name: 'model', label: '模型', type: 'text', required: true, defaultValue: 'deepseek-chat' },
    {
      name: 'visionModel',
      label: '看图模型',
      type: 'text',
      defaultValue: 'deepseek-flash',
      admin: { description: '只用于 Task 1 图表转文字（pnpm chart:data）' },
    },
    {
      name: 'apiKey',
      label: 'API key',
      type: 'text',
      admin: { description: '留空 = 不调用 AI。密钥存数据库，只有登录后台可见' },
    },
  ],
}
