// 写作题分类（007 data-model「写作题」）：后台选项、发布校验、栏目页筛选、转换脚本共用
export const WRITING_CATEGORIES = {
  task1: [
    { value: 'data', label: '数据图' },
    { value: 'map', label: '地图' },
    { value: 'process', label: '流程图' },
    { value: 'diagram', label: '示意图' },
  ],
  task2: [
    { value: 'opinion', label: '观点型' },
    { value: 'discussion', label: '讨论型' },
    { value: 'report', label: '报告型' },
    { value: 'mixed', label: '混合型' },
    { value: 'comparison', label: '比较型' },
    { value: 'advantage', label: '利弊型' },
  ],
} as const

export const categoryLabel: Record<string, string> = Object.fromEntries(
  [...WRITING_CATEGORIES.task1, ...WRITING_CATEGORIES.task2].map((c) => [c.value, c.label]),
)
