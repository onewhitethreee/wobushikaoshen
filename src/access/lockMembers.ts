import type { PayloadRequest, SanitizedConfig } from 'payload'

// 考生（members）只通过自定义接口写数据（overrideAccess）。插件和 Payload 内部集合没写的权限，默认是"有登录用户就放行"，
// 考生也算登录用户，于是能改跳转规则、搜索结果、页头页脚、迁移记录。在配置最后统一兜底：任何集合 / 全局的写操作都不对考生开放，
// payload-* 内部集合连读也不开放（010 research R6-F3）。逐个补 access 会漏，以后新加插件也会漏
const WRITE = ['create', 'update', 'delete', 'unlock', 'readVersions'] as const

type AccessFn = (args: { req: PayloadRequest }) => unknown

const deny = (access: Record<string, unknown>, ops: readonly string[]) => {
  for (const op of ops) {
    const fn = access[op] as AccessFn | undefined
    if (fn) access[op] = (args: { req: PayloadRequest }) => (args.req.user?.collection === 'members' ? false : fn(args))
  }
}

export const lockMembers = (config: SanitizedConfig): SanitizedConfig => {
  for (const c of config.collections) deny(c.access, c.slug.startsWith('payload-') ? [...WRITE, 'read'] : WRITE)
  for (const g of config.globals) deny(g.access, WRITE)
  return config
}
