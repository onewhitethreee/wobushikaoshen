import type { GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 029 内容接口（specs/029-content-api/data-model.md）：站长另一个 AI 上传阅读题用的密钥与每日上限。
// 密钥只存 sha256 摘要，任何人读不到；生成 / 停用走后台接口 /api/content-api/admin/key，不经这里的保存
export const ContentApiSettings: GlobalConfig = {
  slug: 'content-api-settings',
  label: '内容接口',
  access: { read: authenticated, update: authenticated },
  fields: [
    {
      name: 'panel',
      type: 'ui',
      admin: { components: { Field: '@/components/Admin/ContentApiPanel#ContentApiPanel' } },
    },
    {
      name: 'keyHash',
      type: 'text',
      access: { read: () => false },
      admin: { hidden: true },
      hooks: {
        // 后台表单读不到它、保存时不带它：没传（undefined）就保留旧值，否则改每日上限一保存就清掉了密钥。
        // 停用时传空字符串照常清空，所以不能写成 value || previousValue
        beforeChange: [({ value, previousValue }) => (value === undefined ? previousValue : value)],
      },
    },
    // 面板里显示；表单里隐藏（由后台接口写入，表单不会刷新，显示了反而是空的）
    { name: 'keyLast4', type: 'text', admin: { hidden: true } },
    { name: 'keyCreatedAt', type: 'date', admin: { hidden: true } },
    { name: 'lastUsedAt', type: 'date', admin: { hidden: true } },
    {
      name: 'dailyLimit',
      label: '每日新建上限',
      type: 'number',
      required: true,
      defaultValue: 20,
      min: 0,
      admin: { description: '每天（北京时间）最多新建多少个单元；0 = 暂停接收。更新已有单元不计' },
    },
  ],
}
