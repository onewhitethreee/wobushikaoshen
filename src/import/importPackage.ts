import type { Payload, PayloadRequest } from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'

import {
  validateSpeakingQuestion,
  validateTest,
  validateUnit,
  validateWritingTask,
  type SpeakingData,
  type TestData,
  type UnitData,
  type WritingData,
} from '../exam/validate'

// 批量导入：全部校验 → 上传媒体 → 事务内写入（001 FR-060 ~ FR-065，007 kind "unit"、按 sourceId 更新、publish）。
// 后台"导入文件夹"（endpoints/import.ts）和命令行 pnpm import:dir（scripts/import-dir.ts）共用。
// 格式见 docs/import-format.md 与 specs/007-question-bank-import/contracts/unit-format.md

export type Kind = 'test' | 'writing' | 'speaking' | 'unit'
export type Created = { collection: string; id: number | string; label: string; updated?: boolean }
export type ImportResult = {
  status: number
  body: { ok: true; kind: Kind; created: Created[] } | { ok: false; errors: string[] }
}
/** 按导入包内的相对路径读文件；不存在返回 null */
export type ReadFile = (path: string) => Promise<{ data: Buffer; size: number } | null>

const UPLOAD_KEYS = new Set(['audio', 'image'])
const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}
const SOURCE_TYPES = ['original', 'ai_rewrite', 'repost', 'ai_generated']

type Json = unknown
type Item = Record<string, unknown> & { sourceId?: string; sourceType?: string }

const fail = (status: number, errors: string[]): ImportResult => ({
  status,
  body: { ok: false, errors },
})
const ext = (p: string) => p.split('.').pop()?.toLowerCase() ?? ''

/** 收集 JSON 中所有上传字段（audio / image）里写的文件路径 */
const uploadPaths = (node: Json, acc: string[] = []): string[] => {
  if (Array.isArray(node)) node.forEach((n) => uploadPaths(n, acc))
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (UPLOAD_KEYS.has(k) && typeof v === 'string' && v) acc.push(v)
      else uploadPaths(v, acc)
    }
  }
  return acc
}

/** 把上传字段里的路径换成媒体 id */
const replacePaths = (node: Json, ids: Map<string, number | string>): Json => {
  if (Array.isArray(node)) return node.map((n) => replacePaths(n, ids))
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [
        k,
        UPLOAD_KEYS.has(k) && typeof v === 'string' && v ? ids.get(v) : replacePaths(v, ids),
      ]),
    )
  }
  return node
}

/** 阶段 1：校验。返回错误列表，空表示通过 */
const validate = async (payload: Payload, kind: Kind, data: Json): Promise<string[]> => {
  const errors: string[] = []
  if (kind === 'test') {
    const test = (data ?? {}) as TestData & { code?: string; title?: string; sourceType?: string }
    if (!test.code) errors.push('缺少套题编号 code')
    if (!test.title) errors.push('缺少套题名称 title')
    if (!SOURCE_TYPES.includes(test.sourceType ?? ''))
      errors.push(`sourceType 必须是 ${SOURCE_TYPES.join(' / ')}`)
    errors.push(...validateTest(test))
    if (test.code) {
      const dup = await payload.find({
        collection: 'tests',
        where: { code: { equals: test.code } },
        limit: 1,
        draft: true,
      })
      if (dup.totalDocs) errors.push(`套题编号 ${test.code} 已存在`)
    }
    return errors
  }

  if (!Array.isArray(data) || data.length === 0) return [`kind 为 ${kind} 时，data 必须是非空数组`]
  const items = data as (Item &
    WritingData &
    SpeakingData &
    UnitData & { followUps?: { ref?: number }[] })[]
  const seen = new Set<string>()
  items.forEach((item, i) => {
    const at = `第 ${i + 1} 项${item.sourceId ? `（${item.sourceId}）` : ''}`
    const errs =
      kind === 'writing'
        ? validateWritingTask(item)
        : kind === 'speaking'
          ? validateSpeakingQuestion(item)
          : validateUnit(item)
    errs.forEach((e) => errors.push(`${at}：${e}`))
    if (!SOURCE_TYPES.includes(item.sourceType ?? ''))
      errors.push(`${at}：sourceType 必须是 ${SOURCE_TYPES.join(' / ')}`)
    if (kind === 'unit' && !item.sourceId) errors.push(`${at}：缺少 sourceId`)
    if (item.sourceId) {
      if (seen.has(item.sourceId)) errors.push(`${at}：sourceId 在本包内重复`)
      seen.add(item.sourceId)
    }
    if (kind === 'speaking') {
      for (const f of item.followUps ?? []) {
        const target = typeof f?.ref === 'number' ? items[f.ref] : undefined
        if (String(item.part) !== '2') errors.push(`${at}：只有 Part 2 题卡可以填 followUps`)
        else if (!target) errors.push(`${at}：followUps 的 ref ${f?.ref} 不是本批题目的下标`)
        else if (String(target.part) !== '3')
          errors.push(`${at}：followUps 指向的第 ${(f.ref as number) + 1} 项不是 Part 3`)
      }
    }
  })
  return errors
}

/** 阶段 3：在调用方开启的事务里写入。有 sourceId 且库里已有 → 更新，否则新建 */
const writeDocs = async (
  req: PayloadRequest,
  kind: Kind,
  data: Json,
  publish: boolean,
): Promise<Created[]> => {
  const { payload } = req
  const status = publish ? 'published' : 'draft'
  if (kind === 'test') {
    const t = (await payload.create({
      collection: 'tests',
      data: { ...(data as object), _status: status } as never,
      draft: !publish,
      req,
    })) as { id: number | string; code?: string; title?: string }
    return [{ collection: 'tests', id: t.id, label: `${t.code} · ${t.title}` }]
  }

  const items = data as Item[]
  const collection =
    kind === 'writing' ? 'writing-tasks' : kind === 'speaking' ? 'speaking-questions' : 'units'
  const ids: (number | string)[] = []
  const out: Created[] = []
  // 口语先建 Part 1 / 3，Part 2 题卡的 followUps 才能换成真实 id
  const order = items
    .map((_, i) => i)
    .sort((a, b) => Number(String(items[a].part) === '2') - Number(String(items[b].part) === '2')) // part 可能写成数字
  for (const i of order) {
    const item = { ...items[i] }
    // 033 四 / 六级写作包的范文字段叫 modelAnswer，存进已有的 sampleAnswer
    if (kind === 'writing' && 'modelAnswer' in item) {
      item.sampleAnswer ??= item.modelAnswer
      delete item.modelAnswer
    }
    if (kind === 'speaking' && Array.isArray(item.followUps)) {
      item.followUps = (item.followUps as { ref: number }[]).map((f) => ids[f.ref])
    }
    const existing = item.sourceId
      ? (
          await payload.find({
            collection,
            where: { sourceId: { equals: item.sourceId } },
            limit: 1,
            draft: true,
            depth: 0,
            req,
          })
        ).docs[0]
      : undefined
    const doc = (
      existing
        ? await payload.update({
            collection,
            id: existing.id,
            data: { ...item, _status: status } as never,
            draft: !publish,
            req,
          })
        : await payload.create({
            collection,
            data: { ...item, _status: status } as never,
            draft: !publish,
            req,
          })
    ) as { id: number | string; title?: string; topic?: string }
    ids[i] = doc.id
    out.push({
      collection,
      id: doc.id,
      label: doc.title ?? doc.topic ?? String(doc.id),
      updated: Boolean(existing),
    })
  }
  return out
}

export const importPackage = async (
  req: PayloadRequest,
  manifestText: string,
  readFile: ReadFile,
  /** reuseMedia: false 时同名图片一律重新上传（029 内容接口：同一个文件名的图可能换了内容） */
  { reuseMedia = true }: { reuseMedia?: boolean } = {},
): Promise<ImportResult> => {
  const { payload } = req
  let parsed: { kind?: Kind; data?: Json; publish?: boolean }
  try {
    parsed = JSON.parse(manifestText)
  } catch (e) {
    return fail(400, [`import.json 不是合法的 JSON：${(e as Error).message}`])
  }
  const { kind, data } = parsed
  if (kind !== 'test' && kind !== 'writing' && kind !== 'speaking' && kind !== 'unit') {
    return fail(400, ['import.json 的 kind 必须是 test、writing、speaking 或 unit'])
  }

  // —— 阶段 1：全部校验，有错就整包拒绝，不写任何数据 ——
  const errors = await validate(payload, kind, data)
  const paths = [...new Set(uploadPaths(data))]
  const files = new Map<string, { data: Buffer; size: number }>()
  for (const p of paths) {
    if (!MIME[ext(p)]) {
      errors.push(`文件格式不支持：${p}（只能是 mp3 / m4a / 图片）`)
      continue
    }
    const f = await readFile(p)
    if (!f) errors.push(`缺少文件：${p}`)
    else files.set(p, f)
  }
  if (errors.length) return fail(400, errors)

  // —— 阶段 2：上传媒体。文件名里带本包某条内容 sourceId 的（转换脚本生成的包都是），同一路径已上传过（alt 相同）就复用，
  // 再次导入不重复存音频；手写的通用路径（如 img/figure.png）可能撞名，不复用
  // ponytail: 按路径判断是否同一文件，原文件内容变了需换文件名；要按内容比对时加哈希字段
  const sourceIds = (Array.isArray(data) ? data : [])
    .map((d) => (d as { sourceId?: unknown }).sourceId)
    .filter((id): id is string => typeof id === 'string' && id.length >= 4)
  const reusable = (p: string) => reuseMedia && (kind === 'unit' || kind === 'writing') && sourceIds.some((id) => p.includes(id))
  const created: (number | string)[] = []
  const ids = new Map<string, number | string>()
  try {
    for (const p of paths) {
      const found = reusable(p)
        ? await payload.find({
            collection: 'media',
            where: { alt: { equals: p } },
            limit: 1,
            depth: 0,
          })
        : undefined
      if (found?.docs[0]) {
        ids.set(p, found.docs[0].id)
        continue
      }
      const f = files.get(p)!
      const doc = await payload.create({
        collection: 'media',
        data: { alt: p },
        file: { data: f.data, mimetype: MIME[ext(p)], name: p.split('/').pop()!, size: f.size },
      })
      created.push(doc.id)
      ids.set(p, doc.id)
    }

    // —— 阶段 3：事务内写入 ——
    const shouldCommit = await initTransaction(req)
    try {
      const result = await writeDocs(req, kind, replacePaths(data, ids), Boolean(parsed.publish))
      if (shouldCommit) await commitTransaction(req)
      return { status: 201, body: { ok: true, kind, created: result } }
    } catch (e) {
      await killTransaction(req)
      throw e
    }
  } catch (e) {
    for (const id of created)
      await payload.delete({ collection: 'media', id }).catch(() => undefined)
    return fail(500, [`写入失败：${(e as Error).message}，未保存任何数据`])
  }
}
