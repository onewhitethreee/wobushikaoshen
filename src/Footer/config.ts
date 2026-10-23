import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [
    {
      // 页脚"反馈与投诉"（mailto）；留空不显示。会公开显示，用专门的地址
      name: 'contactEmail',
      label: '反馈与投诉邮箱',
      type: 'email',
      admin: { description: '显示在页脚，考生反馈题目错误、版权方投诉都发到这里；留空不显示' },
    },
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
