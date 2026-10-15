import type { Field, GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'

// 发信设置（009 research R4）：主用 / 备用两套 SMTP，只发登录验证码。
// 密码任何人都读不到（后台页面也不回显），只有服务端发信时用 overrideAccess 读取
const smtp = (name: 'primary' | 'backup', label: string): Field => ({
  name,
  label,
  type: 'group',
  fields: [
    { name: 'enabled', label: '启用', type: 'checkbox', defaultValue: false },
    {
      type: 'row',
      fields: [
        { name: 'host', label: '服务器', type: 'text', admin: { placeholder: 'smtpdm.aliyun.com', width: '50%' } },
        { name: 'port', label: '端口', type: 'number', defaultValue: 465, admin: { width: '20%' } },
        {
          name: 'secure',
          label: '加密',
          type: 'select',
          defaultValue: 'ssl',
          options: [
            { label: 'SSL（465）', value: 'ssl' },
            { label: 'STARTTLS（587）', value: 'starttls' },
            { label: '不加密（仅本机测试）', value: 'none' },
          ],
          admin: { width: '30%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'user', label: '用户名', type: 'text', admin: { width: '50%' } },
        // 后台不渲染不可读的字段，所以输入框是这个不入库的 newPassword，保存时转存进 password
        {
          name: 'newPassword',
          label: '密码 / 授权码',
          type: 'text',
          virtual: true,
          // virtual 字段 Payload 默认只读，要显式打开
          admin: { width: '50%', placeholder: '留空 = 不修改', autoComplete: 'off', readOnly: false },
        },
        {
          name: 'password',
          type: 'text',
          access: { read: () => false },
          admin: { hidden: true },
          hooks: { beforeChange: [({ value, previousValue, siblingData }) => siblingData?.newPassword || value || previousValue] },
        },
      ],
    },
    {
      name: 'passwordSet',
      label: '密码已设置',
      type: 'checkbox',
      admin: { readOnly: true },
      hooks: { beforeChange: [({ siblingData }) => Boolean(siblingData?.password)] },
    },
    {
      type: 'row',
      fields: [
        { name: 'fromAddress', label: '发件人地址', type: 'email', admin: { width: '50%' } },
        { name: 'fromName', label: '发件人名称', type: 'text', defaultValue: '我不是考神', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'lastErrorAt', label: '最近一次失败', type: 'date', admin: { readOnly: true, width: '30%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'lastError', label: '失败原因', type: 'text', admin: { readOnly: true, width: '70%' } },
      ],
    },
    {
      name: 'test',
      type: 'ui',
      admin: { components: { Field: '@/components/Account/MailTestButton#MailTestButton' } },
    },
  ],
})

export const MailSettings: GlobalConfig = {
  slug: 'mail-settings',
  label: '邮件设置',
  access: { read: authenticated, update: authenticated },
  admin: {
    description: '只用于发送登录验证码；推荐阿里云 / 腾讯云邮件推送，QQ 邮箱可作备用。主用发送失败时自动改用备用。',
  },
  fields: [smtp('primary', '主用'), smtp('backup', '备用')],
}
