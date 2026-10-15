import type { ArrayField, Condition, Field } from 'payload'

import { questionTypes } from './questionTypes'

const GROUP_OPTION_TYPES = [
  'multi_choice',
  'matching_headings',
  'matching_features',
  'matching_endings',
  'completion',
  'labelling',
]

// 取出当前题目所在题组的 type（condition 的 path 是到当前字段为止的数组路径）
const groupTypeAt = (path: (string | number)[], data: unknown): string | undefined => {
  const i = path.lastIndexOf('questions')
  let node: unknown = data
  for (const seg of path.slice(0, i)) node = (node as Record<string | number, unknown> | undefined)?.[seg]
  return (node as { type?: string } | undefined)?.type
}

const onlySingleChoice: Condition = (data, _sibling, { path }) => groupTypeAt(path, data) === 'single_choice'

const keyText = (): Field[] => [
  { name: 'key', label: '字母 / 编号', type: 'text', required: true },
  { name: 'text', label: '内容', type: 'text', required: true },
]

// 题组（听力 Part 和阅读文章共用），见 data-model.md「QuestionGroup」
export const questionGroupsField = (name: string): ArrayField => ({
  name,
  // 嵌套数组的表名会超过 Postgres 63 字符上限，逐层缩短（保留父表前缀）
  dbName: ({ tableName }) => `${tableName}_g`,
  label: '题组',
  labels: { singular: '题组', plural: '题组' },
  type: 'array',
  admin: { initCollapsed: true, components: { RowLabel: '@/collections/Tests/GroupRowLabel#GroupRowLabel' } },
  fields: [
    { name: 'type', label: '题型', type: 'select', required: true, options: [...questionTypes] },
    {
      name: 'instructions',
      label: '题目说明',
      type: 'textarea',
      required: true,
      admin: { description: '如 Choose the correct letter, A, B or C.' },
    },
    {
      name: 'content',
      label: '题组正文',
      type: 'textarea',
      admin: { description: '填空类题组的表格 / 笔记 / 摘要。空位写成 {{14}} 表示第 14 题' },
    },
    { name: 'image', label: '配图（地图 / 平面图 / 流程图）', type: 'upload', relationTo: 'media' },
    {
      type: 'row',
      fields: [
        { name: 'maxWords', label: '字数上限', type: 'number', min: 1 },
        { name: 'numberAllowed', label: 'AND/OR A NUMBER（数字不计字数）', type: 'checkbox' },
      ],
    },
    {
      name: 'options',
      label: '选项表',
      type: 'array',
      dbName: ({ tableName }) => `${tableName}_o`,
      fields: keyText(),
      admin: {
        description: '多选、各类匹配题共用的选项；带词库的摘要填空、选字母的标注题也填这里',
        condition: (_d, sibling) => GROUP_OPTION_TYPES.includes(sibling?.type),
      },
    },
    {
      name: 'questions',
      dbName: ({ tableName }) => `${tableName}_q`,
      label: '题目',
      labels: { singular: '题目', plural: '题目' },
      type: 'array',
      minRows: 1,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'number', label: '题号', type: 'number', required: true, min: 1, max: 40 },
            {
              name: 'span',
              label: '占几个题号',
              type: 'number',
              defaultValue: 1,
              min: 1,
              admin: { description: '多选「选 N 项」填 N' },
            },
          ],
        },
        {
          name: 'prompt',
          label: '题干',
          type: 'textarea',
          admin: { description: '填空题可空，空位写在题组正文里' },
        },
        {
          name: 'options',
          label: '选项',
          type: 'array',
          dbName: ({ tableName }) => `${tableName}_o`,
          fields: keyText(),
          admin: { condition: onlySingleChoice },
        },
        {
          name: 'answers',
          label: '标准答案',
          type: 'textarea',
          required: true,
          admin: { description: '一行一个可接受答案；可选词写成 (the) river bank；选择题写字母' },
        },
        { name: 'explanation', label: '解析', type: 'textarea' },
        // 007：导入题库带来的解析细节，手工录入的题可不填
        { name: 'tip', label: '易错点', type: 'textarea', admin: { description: '干扰项提示，交卷后显示在解析下方' } },
        { name: 'quote', label: '引用原句', type: 'textarea' },
        {
          type: 'row',
          fields: [
            { name: 'evidence', label: '出处句号', type: 'text', admin: { description: '如 10-16 或 7，对应原文 / 文章的句子编号' } },
            {
              name: 'answerStatus',
              label: '答案状态',
              type: 'select',
              defaultValue: 'confirmed',
              options: [
                { label: '自动通过', value: 'auto' },
                { label: '待确认', value: 'pending' },
                { label: '人工确认', value: 'confirmed' },
              ],
            },
          ],
        },
        { name: 'trial', type: 'ui', admin: { components: { Field: '@/components/AnswerTrial#AnswerTrial' } } },
      ],
    },
  ],
})
