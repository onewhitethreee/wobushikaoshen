import type { Endpoint, PayloadRequest } from 'payload'
import { isAdmin } from '../access/authenticated'

import { importPackage } from '../import/importPackage'

// 后台"导入文件夹"：读上传的文件夹，交给 importPackage()（校验 → 上传媒体 → 事务写入）
export const importEndpoint: Endpoint = {
  path: '/import',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!isAdmin(req.user)) return Response.json({ ok: false, errors: ['请先登录后台'] }, { status: 401 })

    const form = await req.formData!()
    const files = new Map<string, File>()
    for (const v of form.getAll('files')) if (v instanceof File) files.set(v.name.replace(/\\/g, '/'), v)

    const manifest = files.get('import.json')
    if (!manifest) return Response.json({ ok: false, errors: ['文件夹根目录缺少 import.json'] }, { status: 400 })

    const { status, body } = await importPackage(req, await manifest.text(), async (p) => {
      const f = files.get(p)
      return f ? { data: Buffer.from(await f.arrayBuffer()), size: f.size } : null
    })
    return Response.json(body, { status })
  },
}
