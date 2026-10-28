import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { unitSummary } from '../exam/groupStats'
import { isParaphraseData } from '../exam/paraphrase'
import { countPending, validateUnit, type UnitData } from '../exam/validate'
import { examField, paperField } from '../fields/exam'
import { sourceType } from '../fields/sourceType'
import { questionGroupsField } from './Tests/questionGroup'
import { syncOnPublish, unitDocQuestions } from '../stats/keys'

// 前台显示的中性题集标签（007 FR-032）：不出现来源平台名
export const SOURCE_TAGS = [
  '9月高频',
  '9月中频',
  '10月高频',
  '10月中频',
  '全年高频',
  '增补',
  // 029 内容接口上传的阅读（站长另一个 AI 每日取材改写）
  '每日精选',
] as const

const isListening = (data: Partial<UnitData> | undefined) => data?.module === 'listening'

// 练习单元：一篇阅读或一个听力 Part，不要求成套（specs/007-question-bank-import/data-model.md）
export const Units: CollectionConfig = {
  slug: 'units',
  labels: { singular: '练习单元', plural: '练习单元' },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'exam', 'module', 'part', 'paper', 'sourceTag', '_status'],
    listSearchableFields: ['title', 'sourceId', 'sourceSets', 'paper'],
    components: { beforeListTable: ['@/components/ImportButton#ImportButton'] },
  },
  hooks: {
    // 035：发布时比对答案快照，补答案重判、改答案清零
    afterChange: [syncOnPublish(unitDocQuestions)],
    beforeChange: [
      ({ data, originalDoc }) => {
        // 批量发布 / 取消发布只带改动的字段（如 { _status }），校验要看合并后的完整文档
        const full = { ...originalDoc, ...data } as UnitData
        data.pendingCount = countPending(full)
        data.summary = unitSummary(full.groups)
        if (data._status === 'published') {
          const errors = validateUnit(full)
          if (errors.length) throw new APIError(errors.join('\n'), 400, null, true)
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'module',
          label: '科目',
          type: 'select',
          required: true,
          options: [
            { label: '听力', value: 'listening' },
            { label: '阅读', value: 'reading' },
          ],
        },
        { name: 'part', label: 'Part / Passage', type: 'number', required: true, min: 1, max: 4 },
      ],
    },
    examField,
    paperField,
    { name: 'title', label: '标题', type: 'text', required: true },
    {
      name: 'audio',
      label: '音频',
      type: 'upload',
      relationTo: 'media',
      admin: { condition: isListening },
    },
    {
      name: 'transcript',
      label: '原文（逐句）',
      type: 'json',
      admin: {
        condition: isListening,
        description:
          '[{ n, speaker, start, end, text, announce }]，导入时生成；start / end 为秒，供字幕使用',
      },
    },
    {
      // 033 四 / 六级：每段原文的中文翻译；阅读段落译文在 passage[].translation 里
      name: 'transcriptTranslations',
      label: '原文译文（按段）',
      type: 'json',
      admin: { condition: isListening, description: '["第 0 段译文", …]，下标对应原文行的 p' },
    },
    {
      name: 'passage',
      label: '文章（段 → 句）',
      type: 'json',
      admin: {
        condition: (data) => data?.module === 'reading',
        description: '[{ label, sentences: [{ n, text }] }]，导入时生成；label 为段落字母',
      },
    },
    questionGroupsField('groups'),
    sourceType,
    {
      name: 'sourceId',
      label: '来源编号',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: '原始数据编号，再次导入时按它更新' },
    },
    {
      name: 'sourceSets',
      label: '来源题集',
      type: 'text',
      index: true,
      admin: { position: 'sidebar', description: '完整题集名，多个用逗号分隔；只在后台可见' },
    },
    {
      name: 'sourceTag',
      label: '前台题集标签',
      type: 'select',
      options: SOURCE_TAGS.map((t) => ({ label: t, value: t })),
      admin: { position: 'sidebar' },
    },
    {
      // 029：取材原文（宪章 III 来源可追溯）；接口上传时必填，其余单元可空
      name: 'sourceUrl',
      label: '原文链接',
      type: 'text',
      validate: (v: unknown) => !v || /^https?:\/\/\S+$/i.test(String(v)) || '原文链接必须是 http:// 或 https:// 开头的网址',
      admin: { position: 'sidebar' },
    },
    {
      // 029：由内容接口新建；接口只能更新这类单元
      name: 'viaApi',
      label: '来自接口',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      // 栏目页用的题组摘要 [{ type, count, range }]，保存时由 groups 算出；栏目只读它，不读每道小题
      name: 'summary',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'pendingCount',
      label: '待确认题数',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      // 026 同义替换：scripts/paraphrase.ts 离线生成，站长可直接改 JSON
      name: 'paraphrases',
      label: '同义替换',
      type: 'json',
      validate: (v: unknown) => (isParaphraseData(v) ? true : '格式应为 { at, model, items: { 题号: [{ q, s }] } }，每题最多 3 对、每项不超过 200 字'),
      admin: { position: 'sidebar', description: '交卷后在解析里显示；重新生成会取消"已核对"' },
    },
    {
      name: 'paraphraseChecked',
      label: '同义替换已核对',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar' },
    },
  ],
}
