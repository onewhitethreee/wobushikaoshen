// 题型（data-model.md 题型表）
export const questionTypes = [
  { value: 'single_choice', label: '单选' },
  { value: 'multi_choice', label: '多选（选 N 项）' },
  { value: 'tfng', label: 'TRUE / FALSE / NOT GIVEN' },
  { value: 'ynng', label: 'YES / NO / NOT GIVEN' },
  { value: 'matching_headings', label: '段落标题匹配' },
  { value: 'matching_information', label: '信息匹配（对应段落）' },
  { value: 'matching_features', label: '特征匹配' },
  { value: 'matching_endings', label: '句子结尾匹配' },
  { value: 'completion', label: '填空（表格 / 笔记 / 表单 / 流程图 / 摘要 / 句子）' },
  { value: 'short_answer', label: '简答' },
  { value: 'labelling', label: '图表 / 地图标注' },
] as const

export const typeLabel: Record<string, string> = Object.fromEntries(questionTypes.map((t) => [t.value, t.label]))
