import type { Field } from 'payload'

// 内容来源（宪章 III）：所有题目类内容必填，后台列表可筛选；转载须另记来源题集（007）
export const sourceType: Field = {
  name: 'sourceType',
  label: '来源',
  type: 'select',
  required: true,
  options: [
    { label: '原创', value: 'original' },
    { label: 'AI 重写', value: 'ai_rewrite' },
    { label: '转载', value: 'repost' },
    { label: 'AI 生成', value: 'ai_generated' },
  ],
  admin: { position: 'sidebar' },
}
