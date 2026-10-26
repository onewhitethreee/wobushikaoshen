import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { preventReferencedDelete } from '../exam/preventReferencedDelete'
import { validateWritingTask } from '../exam/validate'
import { WRITING_CATEGORIES } from '../exam/writingCategories'
import { examField, paperField } from '../fields/exam'
import { sourceType } from '../fields/sourceType'

// 写作题：可独立存在，也可被套题引用（FR-030 / FR-031）
export const WritingTasks: CollectionConfig = {
  slug: 'writing-tasks',
  labels: { singular: '写作题', plural: '写作题' },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'exam', 'taskType', 'category', 'chartChecked', 'sourceType', '_status'],
    listSearchableFields: ['title', 'titleZh', 'sourceId'],
    components: { beforeListTable: ['@/components/ImportButton#ImportButton'] },
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // 四 / 六级的字数要求可以为空，不补雅思默认值（033）
        if (!data || (data.taskType !== 'task1' && data.taskType !== 'task2')) return data
        const t1 = data.taskType === 'task1'
        data.minWords ??= t1 ? 150 : 250
        data.suggestedMinutes ??= t1 ? 20 : 40
        return data
      },
    ],
    beforeChange: [
      ({ data, originalDoc, req }) => {
        // 后台手改了图表数据 → 来源记为人工（015 data-model）；chart:data 脚本不带后台用户，保持 vision
        if (req.user?.collection === 'users' && data.chartData !== undefined && data.chartData !== originalDoc?.chartData)
          data.chartSource = 'manual'
        // 批量发布 / 取消发布只带改动的字段（如 { _status }），校验要看合并后的完整文档
        if (data._status === 'published') {
          const errors = validateWritingTask({ ...originalDoc, ...data })
          if (errors.length) throw new APIError(errors.join('\n'), 400, null, true)
        }
        return data
      },
    ],
    beforeDelete: [preventReferencedDelete('writing-tasks')],
  },
  fields: [
    {
      name: 'taskType',
      label: '任务类型',
      type: 'select',
      required: true,
      options: [
        { label: 'Task 1（图表）', value: 'task1' },
        { label: 'Task 2（议论文）', value: 'task2' },
        { label: '四六级写作', value: 'cet_writing' },
        { label: '四六级翻译', value: 'cet_translation' },
      ],
    },
    examField,
    paperField,
    {
      name: 'category',
      label: '分类',
      type: 'select',
      options: [...WRITING_CATEGORIES.task1, ...WRITING_CATEGORIES.task2].map((c) => ({ ...c })),
      admin: {
        condition: (_d, sibling) => sibling?.taskType === 'task1' || sibling?.taskType === 'task2',
        description: 'Task 1：数据图 / 地图 / 流程图 / 示意图；Task 2：观点 / 讨论 / 报告 / 混搭 / 比较 / 好坏',
      },
    },
    { name: 'title', label: '标题', type: 'text', required: true, admin: { description: '列表里显示，如"三国家庭能源消耗对比"' } },
    { name: 'titleZh', label: '中文标题', type: 'text' },
    { name: 'prompt', label: '题目', type: 'textarea', required: true },
    {
      name: 'image',
      label: '图表图片',
      type: 'upload',
      relationTo: 'media',
      admin: { condition: (_d, sibling) => sibling?.taskType === 'task1' || sibling?.taskType === 'cet_writing', description: 'Task 1 发布时必填' },
    },
    {
      name: 'chartData',
      label: '图表数据',
      type: 'textarea',
      admin: {
        condition: (_d, sibling) => sibling?.taskType === 'task1',
        description: 'AI 批改读这段文字判断数据是否写对（pnpm chart:data 生成）。没有图表数据的 Task 1 不能批改',
      },
    },
    {
      type: 'row',
      admin: { condition: (_d, sibling) => sibling?.taskType === 'task1' },
      fields: [
        { name: 'chartChecked', label: '图表数据已核对', type: 'checkbox' },
        {
          name: 'chartSource',
          label: '图表数据来源',
          type: 'select',
          options: [
            { label: '看图模型', value: 'vision' },
            { label: '人工', value: 'manual' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'minWords', label: '最低字数', type: 'number', min: 1 },
        { name: 'maxWords', label: '最高字数', type: 'number', min: 1 },
        { name: 'suggestedMinutes', label: '建议用时（分钟）', type: 'number', min: 1 },
      ],
    },
    { name: 'sampleAnswer', label: '范文', type: 'textarea' },
    { name: 'modelAnswerZh', label: '范文译文', type: 'textarea' },
    { name: 'analysis', label: '解析', type: 'textarea', admin: { description: '支持 **粗体**、"## " 小标题和换行' } },
    sourceType,
    {
      name: 'sourceId',
      label: '来源编号',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: '导入的原始数据编号，再次导入时按它更新' },
    },
    { name: 'sourceSets', label: '来源题集', type: 'text', index: true, admin: { position: 'sidebar' } },
  ],
}
